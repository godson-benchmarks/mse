/**
 * Comparison Analyzer
 *
 * Compares ethical profiles across multiple agents or time periods.
 */

class ComparisonAnalyzer {
  /**
   * Compare multiple agents
   * @param {Object} repository
   * @param {string[]} agentIds
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async compare(repository, agentIds, options = {}) {
    const { axes: selectedAxes = null } = options;

    // Get profiles for all agents
    const profiles = [];
    for (const agentId of agentIds) {
      const snapshot = await repository.getLatestSnapshot(agentId);
      if (snapshot) {
        profiles.push({
          agent_id: agentId,
          snapshot
        });
      }
    }

    if (profiles.length < 2) {
      throw new Error('Need at least 2 agent profiles to compare');
    }

    // Get axis metadata
    const allAxes = await repository.getAxes();
    const axesMap = {};
    for (const axis of allAxes) {
      axesMap[axis.code] = axis;
    }

    // Filter axes if specified
    const axesToCompare = selectedAxes
      ? allAxes.filter(a => selectedAxes.includes(a.id) || selectedAxes.includes(a.code))
      : allAxes;

    // Build comparison matrix
    const matrix = this._buildComparisonMatrix(profiles, axesToCompare);

    // Calculate similarity scores
    const similarities = this._calculateSimilarities(profiles);

    // Find key differences
    const differences = this._findKeyDifferences(profiles, axesToCompare);

    // Cluster agents by profile similarity
    const clusters = this._clusterAgents(profiles, axesToCompare);

    return {
      agents: profiles.map(p => ({
        agent_id: p.agent_id,
        snapshot_date: p.snapshot.snapshot_date
      })),
      matrix,
      similarities,
      key_differences: differences,
      clusters,
      axes_metadata: axesToCompare.map(a => ({
        code: a.code,
        name: a.name,
        pole_left: a.pole_left,
        pole_right: a.pole_right
      }))
    };
  }

  /**
   * Build comparison matrix
   * @private
   */
  _buildComparisonMatrix(profiles, axes) {
    const matrix = {};

    for (const axis of axes) {
      matrix[axis.code] = {};

      for (const profile of profiles) {
        const axisData = profile.snapshot.profile_vector[axis.code];
        if (axisData) {
          matrix[axis.code][profile.agent_id] = {
            b: axisData.b,
            a: axisData.a,
            se_b: axisData.se_b,
            flags: axisData.flags || []
          };
        }
      }
    }

    return matrix;
  }

  /**
   * Calculate pairwise similarities between agents
   * @private
   */
  _calculateSimilarities(profiles) {
    const similarities = {};

    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const p1 = profiles[i];
        const p2 = profiles[j];

        const similarity = this._profileSimilarity(
          p1.snapshot.profile_vector,
          p2.snapshot.profile_vector
        );

        const key = `${p1.agent_id}:${p2.agent_id}`;
        similarities[key] = {
          agent1: p1.agent_id,
          agent2: p2.agent_id,
          similarity: Math.round(similarity * 100) / 100,
          interpretation: this._interpretSimilarity(similarity)
        };
      }
    }

    return similarities;
  }

  /**
   * Calculate similarity between two profiles
   * Uses cosine similarity of b values
   * @private
   */
  _profileSimilarity(profile1, profile2) {
    const axes = new Set([
      ...Object.keys(profile1),
      ...Object.keys(profile2)
    ]);

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const axis of axes) {
      const b1 = profile1[axis]?.b ?? 0.5;
      const b2 = profile2[axis]?.b ?? 0.5;

      dotProduct += b1 * b2;
      norm1 += b1 * b1;
      norm2 += b2 * b2;
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Interpret similarity score
   * @private
   */
  _interpretSimilarity(similarity) {
    if (similarity > 0.95) return 'very_similar';
    if (similarity > 0.85) return 'similar';
    if (similarity > 0.70) return 'moderately_similar';
    if (similarity > 0.50) return 'different';
    return 'very_different';
  }

  /**
   * Find key differences between agents
   * @private
   */
  _findKeyDifferences(profiles, axes) {
    const differences = [];

    for (const axis of axes) {
      const values = profiles.map(p => ({
        agent_id: p.agent_id,
        b: p.snapshot.profile_vector[axis.code]?.b ?? 0.5
      }));

      // Calculate range
      const bValues = values.map(v => v.b);
      const min = Math.min(...bValues);
      const max = Math.max(...bValues);
      const range = max - min;

      // Significant difference if range > 0.3
      if (range > 0.3) {
        const minAgent = values.find(v => v.b === min);
        const maxAgent = values.find(v => v.b === max);

        differences.push({
          axis_code: axis.code,
          range: Math.round(range * 100) / 100,
          extremes: {
            left_leaning: {
              agent_id: maxAgent.agent_id,
              b: maxAgent.b
            },
            right_leaning: {
              agent_id: minAgent.agent_id,
              b: minAgent.b
            }
          }
        });
      }
    }

    // Sort by range (largest differences first)
    differences.sort((a, b) => b.range - a.range);

    return differences.slice(0, 5);  // Top 5 differences
  }

  /**
   * Cluster agents by profile similarity
   * Simple hierarchical clustering
   * @private
   */
  _clusterAgents(profiles, axes) {
    if (profiles.length <= 2) {
      return [{
        members: profiles.map(p => p.agent_id),
        centroid: this._calculateCentroid(profiles, axes)
      }];
    }

    // Simple k-means-like clustering with k=2
    // (For production, would use proper hierarchical clustering)

    // Start with two most different agents as seeds
    let maxDiff = 0;
    let seed1 = 0;
    let seed2 = 1;

    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const sim = this._profileSimilarity(
          profiles[i].snapshot.profile_vector,
          profiles[j].snapshot.profile_vector
        );
        const diff = 1 - sim;
        if (diff > maxDiff) {
          maxDiff = diff;
          seed1 = i;
          seed2 = j;
        }
      }
    }

    // Assign each profile to nearest seed
    const cluster1 = [];
    const cluster2 = [];

    for (let i = 0; i < profiles.length; i++) {
      const sim1 = this._profileSimilarity(
        profiles[i].snapshot.profile_vector,
        profiles[seed1].snapshot.profile_vector
      );
      const sim2 = this._profileSimilarity(
        profiles[i].snapshot.profile_vector,
        profiles[seed2].snapshot.profile_vector
      );

      if (sim1 >= sim2) {
        cluster1.push(profiles[i]);
      } else {
        cluster2.push(profiles[i]);
      }
    }

    const clusters = [];

    if (cluster1.length > 0) {
      clusters.push({
        members: cluster1.map(p => p.agent_id),
        centroid: this._calculateCentroid(cluster1, axes),
        internal_similarity: this._calculateInternalSimilarity(cluster1)
      });
    }

    if (cluster2.length > 0) {
      clusters.push({
        members: cluster2.map(p => p.agent_id),
        centroid: this._calculateCentroid(cluster2, axes),
        internal_similarity: this._calculateInternalSimilarity(cluster2)
      });
    }

    return clusters;
  }

  /**
   * Calculate centroid of a cluster
   * @private
   */
  _calculateCentroid(profiles, axes) {
    const centroid = {};

    for (const axis of axes) {
      const values = profiles
        .map(p => p.snapshot.profile_vector[axis.code]?.b)
        .filter(v => v !== undefined);

      if (values.length > 0) {
        centroid[axis.code] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    return centroid;
  }

  /**
   * Calculate internal similarity of a cluster
   * @private
   */
  _calculateInternalSimilarity(profiles) {
    if (profiles.length <= 1) return 1;

    let totalSim = 0;
    let pairs = 0;

    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        totalSim += this._profileSimilarity(
          profiles[i].snapshot.profile_vector,
          profiles[j].snapshot.profile_vector
        );
        pairs++;
      }
    }

    return pairs > 0 ? totalSim / pairs : 1;
  }

  /**
   * Generate comparison report
   * @param {Object} comparison
   * @param {string} language
   * @returns {string}
   */
  generateReport(comparison) {
    const lines = [];

    lines.push('# Ethical Profile Comparison Report\n');

    lines.push('## Compared Agents');
    for (const agent of comparison.agents) {
      lines.push(`- ${agent.agent_id} (evaluated: ${agent.snapshot_date})`);
    }

    lines.push('\n## Key Differences');
    for (const diff of comparison.key_differences) {
      const axis = comparison.axes_metadata.find(a => a.code === diff.axis_code);
      lines.push(`\n### ${axis?.name || diff.axis_code}`);
      lines.push(`- Variation range: ${(diff.range * 100).toFixed(0)}%`);
      lines.push(`- More toward "${axis?.pole_left}": ${diff.extremes.left_leaning.agent_id}`);
      lines.push(`- More toward "${axis?.pole_right}": ${diff.extremes.right_leaning.agent_id}`);
    }

    lines.push('\n## Similarities');
    for (const [key, sim] of Object.entries(comparison.similarities)) {
      lines.push(`- ${sim.agent1} vs ${sim.agent2}: ${(sim.similarity * 100).toFixed(0)}% similar`);
    }

    return lines.join('\n');
  }
}

module.exports = { ComparisonAnalyzer };
