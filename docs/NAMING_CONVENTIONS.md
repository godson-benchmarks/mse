# MSE Naming Conventions

## Overview

The MSE API uses a **hybrid naming strategy** across different layers to accommodate both JavaScript/TypeScript and Python/database ecosystems.

## Layer-Specific Conventions

| Layer | Convention | Rationale |
|-------|-----------|-----------|
| **Database** | `snake_case` | PostgreSQL standard, consistent with SQL naming |
| **Internal Logic** | `snake_case` | Matches database, reduces transformations |
| **REST API** (Request/Response) | `camelCase` | JavaScript/JSON convention, frontend expectation |
| **TypeScript Types** | `camelCase` | TypeScript/JavaScript standard |

## Parameter Aliases

For backward compatibility and multi-language support, the API accepts both naming conventions:

| Canonical (camelCase) | Alias (snake_case) | Description |
|-----------------------|-------------------|-------------|
| `version` | `exam_version` | Exam version code (e.g., 'v2.1') |
| `itemsPerAxis` | `max_items_per_axis` | Number of items per moral axis |
| `examVersionId` | `exam_version_id` | Internal database ID reference |

## When to Use Which

### JavaScript/TypeScript Clients
Use **camelCase** for API requests:
```javascript
await mse.startEvaluation(agentId, {
  version: 'v2.1',
  itemsPerAxis: 18,
  language: 'en'
});
```

### Python Clients
Either convention works, but **snake_case** may feel more natural:
```python
evaluation = client.start_evaluation(
    agent_id=agent_uuid,
    exam_version='v2.1',      # or version='v2.1'
    max_items_per_axis=18,    # or itemsPerAxis=18
    language='en'
)
```

### Database Queries
Always use **snake_case**:
```sql
SELECT exam_version, max_items_per_axis
FROM mse_evaluations
WHERE agent_id = $1;
```

### Internal Modules
Use **snake_case** for consistency with the database layer:
```javascript
this.config = {
  exam_version: config.exam_version || config.version,
  max_items_per_axis: config.max_items_per_axis || config.itemsPerAxis
};
```

## Migration Guide

### For New Projects
- **JavaScript/TypeScript**: Use `camelCase` in API requests
- **Python**: Use either convention (both work)
- **Database**: Always use `snake_case`

### For Existing Projects
No migration required. Both conventions are supported indefinitely:
- Existing code using `version` and `itemsPerAxis` will continue to work
- Existing code using `exam_version` and `max_items_per_axis` will continue to work
- You can mix both conventions in the same request (though not recommended for clarity)

## Rationale

This hybrid approach balances:

1. **Ecosystem Conventions**
   - PostgreSQL naturally uses `snake_case`
   - JavaScript/TypeScript naturally use `camelCase`
   - Supporting both reduces friction for diverse client languages

2. **Backward Compatibility**
   - Multiple tools already use different conventions
   - Breaking changes would harm scientific trust and external consumers

3. **Clear Boundaries**
   - Each layer has a canonical convention
   - Aliases are explicitly documented
   - Transformation happens at layer boundaries (API ↔ Internal ↔ Database)

## No Deprecation Planned

Both naming conventions will be supported **indefinitely** because:

1. **No Technical Cost** - Defensive fallback code already exists
2. **Multi-Language Ecosystem** - Python prefers snake_case, JavaScript prefers camelCase
3. **Backward Compatibility** - Breaking external tools violates scientific trust
4. **Clear Documentation** - Users know which is canonical vs alias

## References

- [REST API Naming Conventions](https://restfulapi.net/resource-naming/)
- [PostgreSQL Naming Conventions](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
- [JavaScript Style Guide - Naming Conventions](https://google.github.io/styleguide/jsguide.html#naming)
