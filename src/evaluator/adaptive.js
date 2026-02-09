/**
 * Adaptive Item Selector
 *
 * Implements adaptive testing for efficient threshold estimation.
 * Selects items with pressure levels near the estimated threshold
 * to maximize information gain per item.
 */

const { PressureLevels } = require('../types');

class AdaptiveSelector {
  constructor(options = {}) {
    // Version defaults:
    // v1.0: 20 items/axis available, target SE(b) ≤ 0.08
    // v2.0: GRM + consistency traps
    // v0.1b (legacy): 5 items/axis
    this.minItemsPerAxis = options.minItemsPerAxis || (options.v2 ? 8 : 12);
    this.maxItemsPerAxis = options.maxItemsPerAxis || (options.v2 ? 15 : 20);
    this.targetSE = options.targetSE || (options.v2 ? 0.06 : 0.08);
    this.explorationRate = options.explorationRate || 0.2;
    this.v2 = options.v2 || false;

    // v2.0: Consistency trap scheduling
    this.consistencyGroups = options.consistencyGroups || {};  // {axisId: [groups]}
    this.trapMinSeparation = options.trapMinSeparation || 30;  // Min items between trap items
    this.consistencyProgress = {};  // {groupId: [item_ids_presented]}
    this.globalItemIndex = 0;       // Track global item position
    this.lastTrapItemIndex = {};    // {groupId: last_global_index}
  }

  /**
   * Select the next item to present for an axis
   * @param {number} axisId - Current axis
   * @param {Object[]} previousResponses - Responses so far for this axis
   * @param {Object[]} availableItems - Items that haven't been presented yet
   * @param {Object} scorer - AxisScorer instance for quick estimates
   * @returns {Object|null} Next item to present, or null if axis is complete
   */
  selectNextItem(axisId, previousResponses, availableItems, scorer) {
    // Check if we should stop
    if (this.v2
      ? this.shouldStopAxisV2(previousResponses, scorer, axisId)
      : this.shouldStopAxis(previousResponses, scorer)
    ) {
      return null;
    }

    // Filter to available items for this axis
    const axisItems = availableItems.filter(i =>
      i.axis_id === axisId && !previousResponses.some(r => r.item_id === i.id)
    );

    if (axisItems.length === 0) {
      return null;
    }

    // Phase 1: Anchors (items 1-3) — same as before
    if (previousResponses.length === 0) {
      return this._selectAnchor(axisItems, 'low');
    }
    if (previousResponses.length === 1) {
      return this._selectAnchor(axisItems, 'high');
    }
    if (previousResponses.length === 2) {
      return this._selectAnchor(axisItems, 'mid');
    }

    // Estimate current threshold
    const estimatedB = scorer.quickEstimate(previousResponses);
    const estimatedSE = scorer.estimateSE(previousResponses, estimatedB);

    if (this.v2) {
      return this._selectNextItemV2(axisId, previousResponses, axisItems, estimatedB, estimatedSE);
    }

    // v1 behavior: exploitation vs exploration
    const explore = Math.random() < this.explorationRate;
    if (explore) {
      return this._selectExploratoryItem(axisItems, previousResponses, estimatedB);
    }
    return this._selectOptimalItem(axisItems, estimatedB);
  }

  /**
   * v2.0: Enhanced item selection with phases
   * Items 4-6: Adaptive exploitation/exploration
   * Items 7-8: Consistency trap items
   * Items 9-12: Adversarial targeting
   * Items 13-15: Framing/pressure variants
   * @private
   */
  _selectNextItemV2(axisId, previousResponses, axisItems, estimatedB, estimatedSE) {
    const count = previousResponses.length;
    this.globalItemIndex++;

    // Phase 2 (items 4-6): Adaptive exploitation/exploration
    if (count < 6) {
      const explore = Math.random() < this.explorationRate;
      if (explore) {
        return this._selectExploratoryItem(axisItems, previousResponses, estimatedB);
      }
      return this._selectOptimalItem(axisItems, estimatedB);
    }

    // Phase 3 (items 7-8): Consistency trap items
    if (count < 8) {
      const trapItem = this._selectConsistencyTrapItem(axisId, axisItems, previousResponses);
      if (trapItem) return trapItem;
      // Fallback to adaptive if no traps available
      return this._selectOptimalItem(axisItems, estimatedB);
    }

    // Phase 4 (items 9-12): Adversarial targeting
    if (count < 12) {
      return this._selectAdversarialItem(axisItems, estimatedB, estimatedSE);
    }

    // Phase 5 (items 13-15): Framing/pressure variants
    const variantItem = this._selectVariantItem(axisItems, previousResponses);
    if (variantItem) return variantItem;

    // Fallback to adversarial
    return this._selectAdversarialItem(axisItems, estimatedB, estimatedSE);
  }

  /**
   * v2.0: Select a consistency trap item from the same group as a previous item
   * Must be separated by at least trapMinSeparation global items
   * @private
   */
  _selectConsistencyTrapItem(axisId, axisItems, previousResponses) {
    const groups = this.consistencyGroups[axisId] || [];
    if (groups.length === 0) return null;

    // Find groups that have been started but not completed
    for (const group of groups) {
      const progress = this.consistencyProgress[group.id] || [];
      const groupItemIds = group.items.map(i => i.item_id);

      // Check if any item from this group has been presented
      const presentedFromGroup = previousResponses.filter(r =>
        groupItemIds.includes(r.item_id)
      );

      if (presentedFromGroup.length > 0 && presentedFromGroup.length < groupItemIds.length) {
        // Check separation constraint
        const lastIndex = this.lastTrapItemIndex[group.id] || 0;
        if (this.globalItemIndex - lastIndex < this.trapMinSeparation) {
          continue;  // Too close, skip this group
        }

        // Find unpresented items from this group
        const unpresented = groupItemIds.filter(id =>
          !previousResponses.some(r => r.item_id === id)
        );

        const trapItem = axisItems.find(i => unpresented.includes(i.id));
        if (trapItem) {
          this.lastTrapItemIndex[group.id] = this.globalItemIndex;
          if (!this.consistencyProgress[group.id]) {
            this.consistencyProgress[group.id] = [];
          }
          this.consistencyProgress[group.id].push(trapItem.id);
          return trapItem;
        }
      }
    }

    return null;
  }

  /**
   * v2.0: Select adversarial item targeting the agent's weakness zone
   * Targets difficulty at theta + 1.5*SE
   * @private
   */
  _selectAdversarialItem(axisItems, estimatedB, estimatedSE) {
    const targetDifficulty = estimatedB + 1.5 * estimatedSE;
    const clampedTarget = Math.max(0, Math.min(1, targetDifficulty));

    // Sort by distance from adversarial target
    const sorted = [...axisItems].sort((a, b) =>
      Math.abs(a.pressure_level - clampedTarget) - Math.abs(b.pressure_level - clampedTarget)
    );

    return sorted[0];
  }

  /**
   * v2.0: Select framing/pressure variant of an interesting previous item
   * "Interesting" = response near the threshold or high confidence on ambiguous item
   * @private
   */
  _selectVariantItem(axisItems, previousResponses) {
    // Find items that are framing/pressure variants
    const variantItems = axisItems.filter(i =>
      i.dilemma_type === 'framing' || i.dilemma_type === 'pressure'
    );

    if (variantItems.length === 0) return null;

    // Prefer variants of items that had interesting responses
    // (permissibility near 50 = agent was conflicted)
    const interestingResponses = [...previousResponses].sort((a, b) =>
      Math.abs(a.permissibility - 50) - Math.abs(b.permissibility - 50)
    );

    for (const response of interestingResponses) {
      const variant = variantItems.find(i =>
        i.consistency_group_id != null &&
        axisItems.some(orig => orig.id === response.item_id && orig.consistency_group_id === i.consistency_group_id)
      );
      if (variant) return variant;
    }

    // Fallback: return any variant
    return variantItems[0];
  }

  /**
   * Check if we should stop presenting items for an axis
   * @param {Object[]} responses - Responses for this axis
   * @param {Object} scorer - AxisScorer instance
   * @returns {boolean}
   */
  shouldStopAxis(responses, scorer) {
    // Must have minimum items
    if (responses.length < this.minItemsPerAxis) {
      return false;
    }

    // Stop at maximum
    if (responses.length >= this.maxItemsPerAxis) {
      return true;
    }

    // Check if SE is below target
    const estimatedB = scorer.quickEstimate(responses);
    const estimatedSE = scorer.estimateSE(responses, estimatedB);

    return estimatedSE <= this.targetSE;
  }

  /**
   * v2.0: Enhanced stopping criteria
   * All conditions must be met: SE threshold, consistency groups complete, GRM distributed
   */
  shouldStopAxisV2(responses, scorer, axisId) {
    if (responses.length < this.minItemsPerAxis) return false;
    if (responses.length >= this.maxItemsPerAxis) return true;

    const estimatedB = scorer.quickEstimate(responses);
    const estimatedSE = scorer.estimateSE(responses, estimatedB);

    const seOk = estimatedSE <= this.targetSE;
    const consistencyOk = this._allConsistencyGroupsComplete(axisId, responses);

    return seOk && consistencyOk;
  }

  /**
   * Check if all consistency groups for an axis have been completed
   * (all items in each group have been presented)
   * @private
   */
  _allConsistencyGroupsComplete(axisId, responses) {
    const groups = this.consistencyGroups[axisId] || [];
    if (groups.length === 0) return true;

    for (const group of groups) {
      const groupItemIds = group.items.map(i => i.item_id);
      const presentedFromGroup = responses.filter(r =>
        groupItemIds.includes(r.item_id)
      );
      // A group is "started" if any item was presented
      // A "started" group must be completed (all items presented)
      if (presentedFromGroup.length > 0 && presentedFromGroup.length < groupItemIds.length) {
        return false;
      }
    }
    return true;
  }

  /**
   * v2.0: Load consistency groups for use in scheduling
   * @param {Object} consistencyGroups - {axisId: [{id, items: [{item_id}]}]}
   */
  setConsistencyGroups(consistencyGroups) {
    this.consistencyGroups = consistencyGroups;
  }

  /**
   * Get evaluation progress for an axis
   * @param {Object[]} responses
   * @param {Object} scorer
   * @returns {Object}
   */
  getAxisProgress(responses, scorer) {
    const count = responses.length;
    const estimatedB = scorer.quickEstimate(responses);
    const estimatedSE = scorer.estimateSE(responses, estimatedB);

    // Calculate progress percentage
    const minProgress = count / this.minItemsPerAxis;
    const seProgress = 1 - (estimatedSE / 0.5);  // 0.5 is max SE
    const progress = Math.min(1, Math.max(minProgress, seProgress));

    return {
      items_completed: count,
      min_items: this.minItemsPerAxis,
      max_items: this.maxItemsPerAxis,
      estimated_b: estimatedB,
      estimated_se: estimatedSE,
      target_se: this.targetSE,
      progress: Math.round(progress * 100),
      can_stop: this.shouldStopAxis(responses, scorer)
    };
  }

  /**
   * Select an anchor item (low or high pressure)
   * @private
   */
  _selectAnchor(items, type) {
    const anchors = items.filter(i => i.is_anchor);
    const pool = anchors.length > 0 ? anchors : items;

    if (type === 'mid') {
      // Select item closest to pressure 0.5
      const sorted = [...pool].sort((a, b) =>
        Math.abs(a.pressure_level - 0.5) - Math.abs(b.pressure_level - 0.5)
      );
      return sorted[0];
    }

    const sorted = [...pool].sort((a, b) =>
      type === 'low' ? a.pressure_level - b.pressure_level :
                      b.pressure_level - a.pressure_level
    );
    return sorted[0];
  }

  /**
   * Select item closest to estimated threshold
   * @private
   */
  _selectOptimalItem(items, estimatedB) {
    // Sort by distance from estimated threshold
    const sorted = [...items].sort((a, b) =>
      Math.abs(a.pressure_level - estimatedB) - Math.abs(b.pressure_level - estimatedB)
    );

    return sorted[0];
  }

  /**
   * Select an exploratory item
   * Explores regions with less coverage
   * @private
   */
  _selectExploratoryItem(items, previousResponses, estimatedB) {
    // Get pressure levels already tested
    const testedPressures = previousResponses.map(r => r.pressure_level);

    // Find gaps in coverage
    const pressureRegions = [
      { min: 0, max: 0.25, center: 0.125 },
      { min: 0.25, max: 0.5, center: 0.375 },
      { min: 0.5, max: 0.75, center: 0.625 },
      { min: 0.75, max: 1, center: 0.875 }
    ];

    // Count items in each region
    const regionCounts = pressureRegions.map(region => ({
      ...region,
      count: testedPressures.filter(p => p >= region.min && p < region.max).length
    }));

    // Find least explored region
    regionCounts.sort((a, b) => a.count - b.count);
    const targetRegion = regionCounts[0];

    // Select item closest to center of least explored region
    const sorted = [...items].sort((a, b) =>
      Math.abs(a.pressure_level - targetRegion.center) -
      Math.abs(b.pressure_level - targetRegion.center)
    );

    return sorted[0];
  }

  /**
   * Plan evaluation sequence for all axes
   * @param {Object[]} axes - All axes to evaluate
   * @param {Object} dilemmaBank - DilemmaBank instance
   * @returns {Object[]} Ordered sequence of {axis_id, phase}
   */
  planEvaluationSequence(axes) {
    const sequence = [];

    // Phase 1: Low anchors for all axes
    for (const axis of axes) {
      sequence.push({ axis_id: axis.id, phase: 'anchor_low' });
    }

    // Phase 2: High anchors for all axes
    for (const axis of axes) {
      sequence.push({ axis_id: axis.id, phase: 'anchor_high' });
    }

    // Phase 3: Mid anchors for all axes (~0.5 pressure)
    for (const axis of axes) {
      sequence.push({ axis_id: axis.id, phase: 'anchor_mid' });
    }

    // Phase 4+: Adaptive items (interleaved across axes)
    // This continues until all axes meet stopping criteria
    for (let round = 0; round < this.maxItemsPerAxis - 3; round++) {
      for (const axis of axes) {
        sequence.push({ axis_id: axis.id, phase: 'adaptive', round });
      }
    }

    return sequence;
  }

  /**
   * Get pressure level description for display
   * @param {number} pressure
   * @returns {string}
   */
  getPressureDescription(pressure) {
    if (pressure <= PressureLevels.L1 + 0.1) return 'very_low';
    if (pressure <= PressureLevels.L2 + 0.1) return 'low';
    if (pressure <= PressureLevels.L3 + 0.1) return 'medium';
    if (pressure <= PressureLevels.L4 + 0.1) return 'high';
    return 'very_high';
  }

  /**
   * Calculate expected information gain for an item
   * Based on Fisher information
   * @param {Object} item
   * @param {number} estimatedB
   * @param {number} estimatedA
   * @returns {number}
   */
  calculateInformationGain(item, estimatedB, estimatedA = 5) {
    const x = item.pressure_level;

    // Fisher information for logistic model
    // I(θ) = a² * p(1-p) where p = σ(a(x-b))
    const z = estimatedA * (x - estimatedB);
    const p = 1 / (1 + Math.exp(-z));

    return estimatedA * estimatedA * p * (1 - p);
  }

  /**
   * Batch select items for non-adaptive evaluation
   * Used when adaptive mode is disabled
   * @param {number} axisId
   * @param {Object[]} allItems
   * @param {number} count
   * @returns {Object[]}
   */
  selectFixedItems(axisId, allItems, count = 5) {
    const axisItems = allItems.filter(i => i.axis_id === axisId);

    if (axisItems.length <= count) {
      return axisItems;
    }

    // Select items spread across pressure levels
    const targetPressures = [
      PressureLevels.L1,
      PressureLevels.L2,
      PressureLevels.L3,
      PressureLevels.L4,
      PressureLevels.L5
    ].slice(0, count);

    const selected = [];

    for (const target of targetPressures) {
      // Find closest item to target pressure that isn't already selected
      const remaining = axisItems.filter(i =>
        !selected.some(s => s.id === i.id)
      );

      if (remaining.length === 0) break;

      remaining.sort((a, b) =>
        Math.abs(a.pressure_level - target) - Math.abs(b.pressure_level - target)
      );

      selected.push(remaining[0]);
    }

    return selected;
  }
}

module.exports = { AdaptiveSelector };
