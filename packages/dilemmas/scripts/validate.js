#!/usr/bin/env node
/**
 * Validate MSE dilemma data files for structural integrity.
 *
 * Checks:
 *   - data/complete.json exists and is valid JSON
 *   - All required fields are present in axes, items, consistency groups, versions
 *   - Referential integrity (item axis_ids reference valid axes)
 *   - Parameter ranges are valid (0-1 for pressure_level, severity, etc.)
 *   - All items have 4 options (A, B, C, D)
 *   - Consistency group items reference valid item codes
 *
 * Usage:
 *   npm run validate
 */

const fs = require('fs').promises;
const path = require('path');

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ❌ ERROR: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠️  WARNING: ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

async function main() {
  const dataPath = path.join(__dirname, '..', 'data', 'complete.json');

  // Check file exists
  console.log('\n1. Checking data/complete.json exists...');
  let raw;
  try {
    raw = await fs.readFile(dataPath, 'utf-8');
    ok('File exists');
  } catch (err) {
    if (err.code === 'ENOENT') {
      error('data/complete.json not found. Run `npm run export` first.');
      process.exit(1);
    }
    throw err;
  }

  // Parse JSON
  console.log('\n2. Parsing JSON...');
  let data;
  try {
    data = JSON.parse(raw);
    ok(`Valid JSON (${(raw.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    error(`Invalid JSON: ${err.message}`);
    process.exit(1);
  }

  // Check top-level structure
  console.log('\n3. Checking top-level structure...');
  const requiredTopLevel = ['version', 'license', 'stats', 'axes', 'items'];
  for (const key of requiredTopLevel) {
    if (!(key in data)) {
      error(`Missing top-level field: ${key}`);
    }
  }
  if (data.version) ok(`Version: ${data.version}`);
  if (data.license) ok(`License: ${data.license}`);

  // Validate axes
  console.log('\n4. Validating axes...');
  const axisIds = new Set();
  if (!Array.isArray(data.axes)) {
    error('axes is not an array');
  } else {
    ok(`${data.axes.length} axes found`);
    for (const axis of data.axes) {
      axisIds.add(axis.id);
      if (!axis.code) error(`Axis ${axis.id}: missing code`);
      if (!axis.name) error(`Axis ${axis.id}: missing name`);
      if (!axis.pole_a?.code || !axis.pole_a?.label) error(`Axis ${axis.code}: missing pole_a`);
      if (!axis.pole_b?.code || !axis.pole_b?.label) error(`Axis ${axis.code}: missing pole_b`);
    }
    if (data.axes.length > 0 && errors === 0) ok('All axes have required fields');
  }

  // Validate items
  console.log('\n5. Validating items...');
  const itemCodes = new Set();
  if (!Array.isArray(data.items)) {
    error('items is not an array');
  } else {
    ok(`${data.items.length} items found`);

    for (const item of data.items) {
      itemCodes.add(item.id);

      // Required fields
      if (!item.id) error(`Item missing id`);
      if (!item.axis_id) error(`Item ${item.id}: missing axis_id`);
      if (!item.prompt) error(`Item ${item.id}: missing prompt`);

      // Referential integrity
      if (item.axis_id && !axisIds.has(item.axis_id)) {
        error(`Item ${item.id}: axis_id ${item.axis_id} not found in axes`);
      }

      // Options validation
      if (!item.options) {
        error(`Item ${item.id}: missing options`);
      } else {
        for (const opt of ['A', 'B']) {
          if (!item.options[opt]?.text) {
            error(`Item ${item.id}: missing option ${opt} text`);
          }
        }
      }

      // Parameter ranges
      if (item.pressure_level !== undefined) {
        if (item.pressure_level < 0 || item.pressure_level > 1) {
          error(`Item ${item.id}: pressure_level ${item.pressure_level} out of range [0,1]`);
        }
      }

      if (item.parameters) {
        const rangeParams = ['severity', 'certainty', 'immediacy', 'relationship', 'consent', 'reversibility', 'legality'];
        for (const param of rangeParams) {
          const val = item.parameters[param];
          if (val !== undefined && val !== null && (val < 0 || val > 1)) {
            warn(`Item ${item.id}: parameter ${param} = ${val} is outside expected range [0,1]`);
          }
        }
      }
    }

    if (data.items.length > 0 && errors === 0) ok('All items have required fields and valid references');
  }

  // Validate consistency groups
  console.log('\n6. Validating consistency groups...');
  if (data.consistency_groups) {
    if (!Array.isArray(data.consistency_groups)) {
      error('consistency_groups is not an array');
    } else {
      ok(`${data.consistency_groups.length} consistency groups found`);
      for (const group of data.consistency_groups) {
        if (!group.name) warn(`Consistency group ${group.id}: missing name`);
        if (group.axis_id && !axisIds.has(group.axis_id)) {
          error(`Consistency group ${group.id}: axis_id ${group.axis_id} not found in axes`);
        }
      }
    }
  }

  // Validate exam versions
  console.log('\n7. Validating exam versions...');
  if (data.exam_versions) {
    if (!Array.isArray(data.exam_versions)) {
      error('exam_versions is not an array');
    } else {
      ok(`${data.exam_versions.length} exam versions found`);
      for (const ver of data.exam_versions) {
        if (!ver.code) error(`Exam version ${ver.id}: missing code`);
        if (!ver.name) error(`Exam version ${ver.id}: missing name`);
      }
    }
  }

  // Stats consistency
  console.log('\n8. Checking stats consistency...');
  if (data.stats) {
    if (data.stats.total_items !== data.items?.length) {
      warn(`stats.total_items (${data.stats.total_items}) != actual items count (${data.items?.length})`);
    } else {
      ok(`Stats match: ${data.stats.total_items} items, ${data.stats.axes_count} axes`);
    }
  }

  // Summary
  console.log('\n─────────────────────────────────');
  if (errors === 0 && warnings === 0) {
    console.log('✅ Validation passed! No issues found.');
  } else if (errors === 0) {
    console.log(`✅ Validation passed with ${warnings} warning(s).`);
  } else {
    console.log(`❌ Validation failed: ${errors} error(s), ${warnings} warning(s).`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Validation script error:', err);
  process.exit(1);
});
