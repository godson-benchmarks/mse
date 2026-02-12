# Contributing to MSE

Thank you for your interest in contributing to the Moral Spectrometry Engine! This document provides guidelines for contributing code, dilemmas, and documentation.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How to Contribute](#how-to-contribute)
3. [Reporting Bugs](#reporting-bugs)
4. [Proposing New Dilemmas](#proposing-new-dilemmas)
5. [Contributing Code](#contributing-code)
6. [Coding Standards](#coding-standards)
7. [Review Process](#review-process)
8. [RFCs for Major Changes](#rfcs-for-major-changes)

---

## Code of Conduct

Given that MSE deals with ethical reasoning, we expect contributors to model the behavior we're trying to evaluate. Please:

- **Be respectful** in all interactions
- **Assume good faith** when disagreements arise
- **Focus on substance** not personal attacks
- **Acknowledge uncertainty** in moral questions
- **Credit others' work** appropriately

**Enforcement:** Violations will be addressed by maintainers through warnings, temporary bans, or permanent bans depending on severity.

---

## How to Contribute

### Quick Links

- 🐛 [Report a bug](https://github.com/godson-benchmarks/mse/issues/new?template=bug_report.md)
- ✨ [Request a feature](https://github.com/godson-benchmarks/mse/issues/new?template=feature_request.md)
- 📝 [Propose a new dilemma](https://github.com/godson-benchmarks/mse/issues/new?template=new_dilemma.md)
- 🔬 [Discuss research questions](https://github.com/godson-benchmarks/mse/discussions)
- 💬 [Ask questions](https://github.com/godson-benchmarks/mse/discussions/categories/q-a)

---

## Reporting Bugs

### Before Submitting

1. **Search existing issues** to avoid duplicates
2. **Try the latest version** to confirm bug persists
3. **Collect reproduction steps** (minimal example that triggers bug)

### Bug Report Template

```markdown
**Bug Description**
Clear description of what's wrong.

**Steps to Reproduce**
1. Start evaluation with...
2. Submit response...
3. Observe error...

**Expected Behavior**
What should have happened.

**Actual Behavior**
What actually happened (include error messages).

**Environment**
- MSE version: 1.0.0
- Node version: 20.x
- Database: PostgreSQL 16
- OS: Ubuntu 22.04

**Additional Context**
Screenshots, logs, etc.
```

---

## Proposing New Dilemmas

### Guidelines

**Good dilemmas:**
- ✅ Test a specific moral tension (one of the 15 axes)
- ✅ Have clear Pole A and Pole B options
- ✅ Work at multiple pressure levels
- ✅ Avoid cultural specificity
- ✅ Include non-obvious moral factors

**Bad dilemmas:**
- ❌ Too culture-specific (e.g., "Should you bribe officials?")
- ❌ No clear poles (ambiguous what A/B represent)
- ❌ Only work at one pressure level
- ❌ Trivial edge cases
- ❌ Loaded language that presupposes answer

### Dilemma Proposal Template

Use the [new_dilemma.md](https://github.com/godson-benchmarks/mse/issues/new?template=new_dilemma.md) issue template:

```markdown
**Axis:** (e.g., Rights vs Consequences)

**Pressure Level:** (L1-L5, or "works at multiple levels")

**Dilemma Text (English):**
[Your scenario here]

**Option A:** [Pole A choice]
**Option B:** [Pole B choice]
**Option C:** [Neutral/context-dependent]
**Option D:** [Creative alternative]

**Parameters:**
- severity: 0.7
- certainty: 0.8
- immediacy: 0.6
- relationship: 0.3
- consent: 0.5
- reversibility: 0.4
- legality: 0.9
- num_affected: 100

**Non-Obvious Factors:**
- [Subtle consideration 1]
- [Subtle consideration 2]

**Philosophical Justification:**
Why this dilemma tests the axis. Cite sources if possible.

**Dilemma Type:**
Base, framing, pressure, consistency_trap, particularist, dirty_hands, or tragic.
```

### Review Process for Dilemmas

1. **Community discussion** (7 days minimum)
2. **Two reviewer approval** required
3. **Philosophical validation** (does it genuinely test the axis?)
4. **Pressure calibration** (does expected permit rate match level?)
5. **Bilingual translation** (English + Spanish, community can contribute other languages)
6. **Merge to core package**

---

## Contributing Code

### Setup

```bash
git clone https://github.com/godson-benchmarks/mse.git
cd mse
npm install
```

### Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make your changes**
4. **Write tests** (required for all new code)
5. **Run tests**: `npm test`
6. **Run linter**: `npm run lint`
7. **Commit with clear messages**: `git commit -m "Add XYZ feature"`
8. **Push to your fork**: `git push origin feature/your-feature`
9. **Open a Pull Request**

### PR Guidelines

**Title:** Clear, concise description (< 60 chars)

**Description:**
- What problem does this solve?
- How does it work?
- Any breaking changes?
- Related issues (#123)

**Checklist:**
- [ ] Tests pass
- [ ] Linter passes
- [ ] Documentation updated
- [ ] No breaking changes (or BREAKING CHANGE noted in commit)
- [ ] Added to CHANGELOG.md

---

## Coding Standards

### JavaScript (Core Package)

- **Style:** Vanilla ES6+, no frameworks
- **Formatting:** Prettier (configured in `.prettierrc`)
- **Linting:** ESLint 9+ (configured in `eslint.config.js`)

```javascript
// Example: Good
class AxisScorer {
  constructor(options = {}) {
    this.lambda = options.lambda || 0.3;
  }

  async scoreAxis(responses, items) {
    // ... implementation
  }
}

// Example: Bad
var AxisScorer = function(options) {  // use class, not function
  this.lambda = options.lambda ? options.lambda : 0.3;  // use ||
};
```

### General Principles

- **Adapter pattern:** All database operations go through `PostgresAdapter`
- **Provider pattern:** LLM operations go through `LLMProvider`
- **Pure functions:** Prefer pure functions over stateful classes
- **No magic numbers:** Use named constants
- **Explicit > implicit:** Clear intent over clever code

---

## Review Process

### Code Review

**Timeline:**
- Initial review within 48 hours
- Follow-up reviews within 24 hours

**Criteria:**
- ✅ Tests pass and cover new code
- ✅ Follows coding standards
- ✅ Documentation updated
- ✅ No security vulnerabilities
- ✅ Performance acceptable (no O(n²) where O(n) exists)

**Approval:**
- 1 maintainer approval required for bug fixes
- 2 maintainer approvals for new features

### Dilemma Review

**Timeline:**
- 7 day discussion period minimum
- 2 reviewer approvals required

**Criteria:**
- ✅ Philosophically sound
- ✅ Tests the intended axis
- ✅ Avoids cultural bias
- ✅ Parameters calibrated
- ✅ Bilingual (EN + ES)

---

## RFCs for Major Changes

**Require RFC (Request for Comments) for:**
- Changes to scoring model (RLTM parameters, regularization)
- Addition of new axes
- Changes to ISM or SI formulas
- Breaking API changes
- New psychometric models

### RFC Process

1. **Open RFC issue** with label `rfc`
2. **Describe proposal** (problem, solution, alternatives)
3. **Community discussion** (minimum 14 days)
4. **Maintainer decision** (accept, reject, request changes)
5. **If accepted:** Implementation in separate PR

### RFC Template

```markdown
# RFC: [Title]

## Summary
One-paragraph summary.

## Motivation
Why is this needed? What problem does it solve?

## Detailed Design
How will this work? Include:
- Mathematical formulas (if applicable)
- Code examples
- Migration path (if breaking change)

## Alternatives Considered
What other approaches were considered and why were they rejected?

## Validation
How will we know if this works? What evidence supports this approach?

## Impact
- Breaking changes?
- Performance implications?
- Affects which components?

## Open Questions
What's still uncertain?
```

---

## Getting Help

- 💬 **[GitHub Discussions](https://github.com/godson-benchmarks/mse/discussions)** for questions
- 📧 **opensource@godson.ai** for sensitive issues
- 📚 **[Documentation](https://github.com/godson-benchmarks/mse/tree/main/docs)** for technical details

---

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Acknowledged in release notes
- Invited to co-author academic papers (for research contributions)

---

**Thank you for making MSE better!** 🙏
