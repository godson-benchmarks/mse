# MSE Database Migrations

This directory contains the consolidated MSE database schema and seed data.

## Structure

### Core Migrations

- **001_core_tables.sql** — Base tables (axes, items, runs, responses, snapshots, profiles)
- **002_v2_enhancements.sql** — v2.0 features (consistency groups, gaming, capacities, coherence)
- **003_ratings.sql** — Moral Rating (MR) system with Elo-like dynamics
- **004_sophistication.sql** — Sophistication Index (SI) tables
- **005_ism.sql** — ISM (Índice de Sofisticación Moral) composite scores
- **006_population_stats.sql** — Calibration and population statistics

### Seed Data

- **seed/001_axes.sql** — 15 moral tension axes with metadata
- **seed/002_dilemmas.sql** — 225+ parametric dilemmas (bilingual EN/ES)
- **seed/003_consistency_groups.sql** — Gaming detection consistency groups
- **seed/004_exam_versions.sql** — Exam version definitions (v0.1b, v2.1)

## Setup

```bash
# Run all migrations + seeds
npm run migrate

# Or manually:
./scripts/setup-db.sh
```

## Reset (Development Only)

```bash
# Drop and recreate all tables
./scripts/reset-db.sh
```

⚠️ **WARNING:** This will DELETE ALL DATA

## Requirements

- PostgreSQL 14+
- Extensions: `uuid-ossp`, `pg_trgm`

## Migration Order

Migrations must be run in numeric order (001 → 006). Seed data should be loaded after all migrations are complete.

## Versioning

Database schema changes are versioned separately from the code. Breaking schema changes require a new migration file and may require application code updates.

## See Also

- [Database Schema Documentation](../../docs/DATABASE_SCHEMA.md)
- [API Reference](../../docs/API_REFERENCE.md)
