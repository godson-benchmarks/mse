#!/usr/bin/env node
/**
 * Export MSE dilemmas, axes, consistency groups, and exam versions from database to JSON
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/export-from-db.js
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function exportAxes() {
  console.log('Exporting axes...');
  const { rows } = await db.query(`
    SELECT
      id,
      code,
      name,
      category,
      pole_a_code,
      pole_a_label,
      pole_b_code,
      pole_b_label,
      description,
      philosophical_sources
    FROM mse_axes
    WHERE is_active = true
    ORDER BY id
  `);

  return rows.map(row => ({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    pole_a: {
      code: row.pole_a_code,
      label: row.pole_a_label
    },
    pole_b: {
      code: row.pole_b_code,
      label: row.pole_b_label
    },
    description: row.description,
    philosophical_sources: row.philosophical_sources || []
  }));
}

async function exportItems() {
  console.log('Exporting items...');
  const { rows } = await db.query(`
    SELECT
      id,
      axis_id,
      code,
      pressure_level,
      dilemma_type,
      variant_type,
      prompt,
      option_a_text,
      option_b_text,
      option_c_text,
      option_d_text,
      option_a_alignment,
      option_b_alignment,
      option_c_alignment,
      option_d_alignment,
      severity,
      certainty,
      immediacy,
      relationship,
      consent,
      reversibility,
      legality,
      num_affected,
      non_obvious_factors,
      expert_disagreement,
      requires_residue_recognition,
      meta_ethical_type,
      consistency_group_id
    FROM mse_items
    ORDER BY axis_id, pressure_level
  `);

  return rows.map(row => ({
    id: row.code,
    axis_id: row.axis_id,
    pressure_level: parseFloat(row.pressure_level),
    dilemma_type: row.dilemma_type,
    variant_type: row.variant_type,
    prompt: row.prompt,
    options: {
      A: {
        text: row.option_a_text,
        alignment: row.option_a_alignment,
        forced_pole: 'A'
      },
      B: {
        text: row.option_b_text,
        alignment: row.option_b_alignment,
        forced_pole: 'B'
      },
      C: {
        text: row.option_c_text,
        alignment: row.option_c_alignment
      },
      D: {
        text: row.option_d_text,
        alignment: row.option_d_alignment
      }
    },
    parameters: {
      severity: parseFloat(row.severity),
      certainty: parseFloat(row.certainty),
      immediacy: parseFloat(row.immediacy),
      relationship: parseFloat(row.relationship),
      consent: parseFloat(row.consent),
      reversibility: parseFloat(row.reversibility),
      legality: parseFloat(row.legality),
      num_affected: row.num_affected
    },
    v2_metadata: {
      non_obvious_factors: row.non_obvious_factors || [],
      expert_disagreement: row.expert_disagreement ? parseFloat(row.expert_disagreement) : null,
      requires_residue_recognition: row.requires_residue_recognition || false,
      meta_ethical_type: row.meta_ethical_type,
      consistency_group_id: row.consistency_group_id
    }
  }));
}

async function exportConsistencyGroups() {
  console.log('Exporting consistency groups...');
  const { rows } = await db.query(`
    SELECT
      cg.id,
      cg.name,
      cg.axis_id,
      json_agg(json_build_object(
        'item_id', cgi.item_id,
        'item_code', i.code,
        'variant_type', cgi.variant_type,
        'role', cgi.role
      ) ORDER BY cgi.role) as items
    FROM mse_consistency_groups cg
    LEFT JOIN mse_consistency_group_items cgi ON cg.id = cgi.group_id
    LEFT JOIN mse_items i ON cgi.item_id = i.id
    GROUP BY cg.id, cg.name, cg.axis_id
    ORDER BY cg.axis_id, cg.id
  `);

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    axis_id: row.axis_id,
    items: row.items || []
  }));
}

async function exportVersions() {
  console.log('Exporting exam versions...');
  const { rows } = await db.query(`
    SELECT
      id,
      code,
      name,
      description,
      status,
      is_current,
      released_at,
      retired_at,
      comparable_with,
      breaking_changes
    FROM mse_exam_versions
    ORDER BY released_at DESC
  `);

  return rows.map(row => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    is_current: row.is_current,
    released_at: row.released_at,
    retired_at: row.retired_at,
    comparable_with: row.comparable_with || [],
    breaking_changes: row.breaking_changes
  }));
}

async function main() {
  try {
    // Export all data
    const axes = await exportAxes();
    const items = await exportItems();
    const consistencyGroups = await exportConsistencyGroups();
    const versions = await exportVersions();

    // Build complete dataset
    const dataset = {
      version: "2.0",
      license: "CC-BY-SA-4.0",
      generated_at: new Date().toISOString(),
      stats: {
        total_items: items.length,
        axes_count: axes.length,
        consistency_groups: consistencyGroups.length,
        exam_versions: versions.length
      },
      axes,
      items,
      consistency_groups: consistencyGroups,
      exam_versions: versions
    };

    // Write to data directory
    const dataDir = path.join(__dirname, '..', 'data');
    await fs.mkdir(dataDir, { recursive: true });

    // Write complete dataset
    await fs.writeFile(
      path.join(dataDir, 'complete.json'),
      JSON.stringify(dataset, null, 2)
    );

    // Write individual files
    await fs.writeFile(
      path.join(dataDir, 'axes.json'),
      JSON.stringify({ axes }, null, 2)
    );
    await fs.writeFile(
      path.join(dataDir, 'items.json'),
      JSON.stringify({ items }, null, 2)
    );
    await fs.writeFile(
      path.join(dataDir, 'consistency-groups.json'),
      JSON.stringify({ consistency_groups: consistencyGroups }, null, 2)
    );
    await fs.writeFile(
      path.join(dataDir, 'versions.json'),
      JSON.stringify({ versions }, null, 2)
    );

    console.log('\n✅ Export complete!');
    console.log(`   Total items: ${items.length}`);
    console.log(`   Axes: ${axes.length}`);
    console.log(`   Consistency groups: ${consistencyGroups.length}`);
    console.log(`   Exam versions: ${versions.length}`);
    console.log(`\nFiles written to: ${dataDir}/`);

  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
