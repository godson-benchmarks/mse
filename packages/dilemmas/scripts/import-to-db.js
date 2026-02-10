#!/usr/bin/env node
/**
 * Import MSE dilemmas from JSON data files into a PostgreSQL database.
 *
 * Reads the exported data from data/complete.json and inserts axes, items,
 * consistency groups, and exam versions into the MSE database tables.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/import-to-db.js
 *
 * Prerequisites:
 *   - MSE database tables must already exist (run migrations first)
 *   - data/complete.json must exist (run `npm run export` first, or use the shipped data)
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function loadData() {
  const dataPath = path.join(__dirname, '..', 'data', 'complete.json');
  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('Error: data/complete.json not found.');
      console.error('Run `npm run export` first to generate the data files,');
      console.error('or ensure the package ships with pre-built data.');
      process.exit(1);
    }
    throw err;
  }
}

async function importAxes(axes) {
  console.log(`Importing ${axes.length} axes...`);
  let imported = 0;

  for (const axis of axes) {
    await db.query(`
      INSERT INTO mse_axes (id, code, name, category, pole_a_code, pole_a_label, pole_b_code, pole_b_label, description, philosophical_sources, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        pole_a_code = EXCLUDED.pole_a_code,
        pole_a_label = EXCLUDED.pole_a_label,
        pole_b_code = EXCLUDED.pole_b_code,
        pole_b_label = EXCLUDED.pole_b_label,
        description = EXCLUDED.description,
        philosophical_sources = EXCLUDED.philosophical_sources
    `, [
      axis.id,
      axis.code,
      axis.name,
      axis.category,
      axis.pole_a.code,
      axis.pole_a.label,
      axis.pole_b.code,
      axis.pole_b.label,
      axis.description,
      JSON.stringify(axis.philosophical_sources)
    ]);
    imported++;
  }

  console.log(`  ✓ ${imported} axes imported`);
}

async function importItems(items) {
  console.log(`Importing ${items.length} items...`);
  let imported = 0;

  for (const item of items) {
    await db.query(`
      INSERT INTO mse_items (
        code, axis_id, pressure_level, dilemma_type, variant_type,
        prompt,
        option_a_text, option_b_text, option_c_text, option_d_text,
        option_a_alignment, option_b_alignment, option_c_alignment, option_d_alignment,
        severity, certainty, immediacy, relationship, consent, reversibility, legality, num_affected,
        non_obvious_factors, expert_disagreement, requires_residue_recognition,
        meta_ethical_type, consistency_group_id
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25,
        $26, $27
      )
      ON CONFLICT (code) DO UPDATE SET
        axis_id = EXCLUDED.axis_id,
        pressure_level = EXCLUDED.pressure_level,
        dilemma_type = EXCLUDED.dilemma_type,
        variant_type = EXCLUDED.variant_type,
        prompt = EXCLUDED.prompt,
        option_a_text = EXCLUDED.option_a_text,
        option_b_text = EXCLUDED.option_b_text,
        option_c_text = EXCLUDED.option_c_text,
        option_d_text = EXCLUDED.option_d_text,
        option_a_alignment = EXCLUDED.option_a_alignment,
        option_b_alignment = EXCLUDED.option_b_alignment,
        option_c_alignment = EXCLUDED.option_c_alignment,
        option_d_alignment = EXCLUDED.option_d_alignment,
        severity = EXCLUDED.severity,
        certainty = EXCLUDED.certainty,
        immediacy = EXCLUDED.immediacy,
        relationship = EXCLUDED.relationship,
        consent = EXCLUDED.consent,
        reversibility = EXCLUDED.reversibility,
        legality = EXCLUDED.legality,
        num_affected = EXCLUDED.num_affected
    `, [
      item.id, item.axis_id, item.pressure_level, item.dilemma_type, item.variant_type,
      item.prompt,
      item.options.A.text, item.options.B.text, item.options.C.text, item.options.D.text,
      item.options.A.alignment, item.options.B.alignment, item.options.C.alignment, item.options.D.alignment,
      item.parameters.severity, item.parameters.certainty, item.parameters.immediacy,
      item.parameters.relationship, item.parameters.consent, item.parameters.reversibility,
      item.parameters.legality, item.parameters.num_affected,
      JSON.stringify(item.v2_metadata?.non_obvious_factors || []),
      item.v2_metadata?.expert_disagreement,
      item.v2_metadata?.requires_residue_recognition || false,
      item.v2_metadata?.meta_ethical_type,
      item.v2_metadata?.consistency_group_id
    ]);
    imported++;
  }

  console.log(`  ✓ ${imported} items imported`);
}

async function importVersions(versions) {
  console.log(`Importing ${versions.length} exam versions...`);
  let imported = 0;

  for (const ver of versions) {
    await db.query(`
      INSERT INTO mse_exam_versions (id, code, name, description, status, is_current, released_at, retired_at, comparable_with, breaking_changes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        is_current = EXCLUDED.is_current,
        comparable_with = EXCLUDED.comparable_with,
        breaking_changes = EXCLUDED.breaking_changes
    `, [
      ver.id, ver.code, ver.name, ver.description, ver.status,
      ver.is_current, ver.released_at, ver.retired_at,
      JSON.stringify(ver.comparable_with || []),
      ver.breaking_changes
    ]);
    imported++;
  }

  console.log(`  ✓ ${imported} exam versions imported`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is required.');
    console.error('Usage: DATABASE_URL="postgresql://..." node scripts/import-to-db.js');
    process.exit(1);
  }

  try {
    const data = await loadData();

    console.log(`\nImporting MSE dilemma bank v${data.version}`);
    console.log(`  Items: ${data.stats.total_items}`);
    console.log(`  Axes: ${data.stats.axes_count}`);
    console.log(`  Consistency groups: ${data.stats.consistency_groups}`);
    console.log(`  Exam versions: ${data.stats.exam_versions}\n`);

    await importAxes(data.axes);
    await importItems(data.items);
    await importVersions(data.exam_versions);

    console.log('\n✅ Import complete!');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
