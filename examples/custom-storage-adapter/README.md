# Custom Storage Adapter - SQLite Example

Example implementation of MSEStorageAdapter using SQLite instead of PostgreSQL.

## Why SQLite?

- Lighter weight for testing
- No database server required
- Single file storage
- Perfect for prototyping

## Implementation

See `src/sqlite-adapter.js` for the complete implementation of all ~40 required methods:

```javascript
const { MSEStorageAdapter } = require('@godson/mse');

class SQLiteAdapter extends MSEStorageAdapter {
  async getAxes() { /* ... */ }
  async createRun(data) { /* ... */ }
  // ... 38 more methods
}
```

## Usage

```bash
npm install
node example.js
```

This will:
1. Create `mse.db` SQLite file
2. Run migrations
3. Seed dilemmas
4. Run a test evaluation
5. Generate profile

## Files

- `src/sqlite-adapter.js` - Adapter implementation
- `migrations/` - SQLite schema
- `example.js` - Usage example
- `test/` - Test suite
