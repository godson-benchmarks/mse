# @godson/mse-dilemmas

> **Part of the [MSE monorepo](https://github.com/godson-benchmarks/mse).** This package lives at `packages/dilemmas/`.

Ethical dilemma content for the Moral Spectrometry Engine - 225+ parametric scenarios across 15 moral tension axes.

## Overview

This package contains the dilemma bank used by the MSE to evaluate AI agent ethical profiles. All content is in English and licensed under CC-BY-SA 4.0.

## Contents

- **225+ Parametric Dilemmas** — Calibrated across 5 pressure levels
- **15 Moral Tension Axes** — From rights-vs-consequences to privacy-vs-security
- **Consistency Groups** — For gaming detection
- **Exam Versions** — Multiple coexisting versions (v0.1b, v2.1)
- **8 Contextual Parameters** — Severity, certainty, immediacy, relationship, consent, reversibility, legality, num_affected
- **7 Dilemma Types** — Base, framing, pressure, consistency_trap, particularist, dirty_hands, tragic

## Data Format

```json
{
  "version": "2.0",
  "license": "CC-BY-SA-4.0",
  "stats": {
    "total_items": 225,
    "axes_count": 15,
    "consistency_groups": 60,
    "exam_versions": 2
  },
  "axes": [...],
  "items": [...],
  "consistency_groups": [...],
  "exam_versions": [...]
}
```

## Usage

```javascript
const dilemmas = require('@godson/mse-dilemmas');

// Access complete dataset
console.log(dilemmas.stats);

// Filter by axis
const rightsItems = dilemmas.items.filter(i => i.axis_id === 1);

// Filter by pressure level
const highPressure = dilemmas.items.filter(i => i.pressure_level >= 0.8);
```

## Scripts

### Export from Database

If you have an MSE database with dilemmas:

```bash
DATABASE_URL="postgresql://..." npm run export
```

### Import to Database

To load the dilemma bank into your MSE database:

```bash
DATABASE_URL="postgresql://..." npm run import
```

### Validate Data

To validate the structure and integrity of the JSON data files:

```bash
npm run validate
```

## License

**CC-BY-SA 4.0** — Attribution-ShareAlike

You may share and adapt this content with proper attribution and under the same license.

### Attribution

When using these dilemmas, please include:

```
Moral Spectrometry Engine Dilemmas by Godson Network (https://godson.ai)
Licensed under CC-BY-SA 4.0
```

## Contributing New Dilemmas

See the [Dilemma Authoring Guide](https://github.com/godson-benchmarks/mse/blob/main/docs/DILEMMA_AUTHORING_GUIDE.md) for guidelines on creating new dilemmas.

## Links

- [MSE Core Engine](https://github.com/godson-benchmarks/mse/tree/main/packages/core)
- [MSE React Components](https://github.com/godson-benchmarks/mse/tree/main/packages/react)
- [Documentation](https://github.com/godson-benchmarks/mse/tree/main/docs)
