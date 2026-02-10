# MSE Examples

Practical examples showing how to use the Moral Spectrometry Engine in different scenarios.

## Available Examples

### 1. [Standalone Server](./standalone-server/)
Complete Express.js server with MSE integration and PostgreSQL database. Perfect starting point for building an MSE-powered API.

**Features:**
- REST API endpoints for evaluation
- PostgreSQL + Docker Compose setup
- Complete evaluation workflow
- Profile retrieval and comparison

### 2. [Evaluate Agent](./evaluate-agent/)
Command-line tool to evaluate an AI agent via the MSE REST API.

**Features:**
- Interactive CLI interface
- Presents dilemmas to the user
- Submits responses via API
- Displays final profile

### 3. [Evaluate OpenAI Model](./evaluate-openai-model/)
Direct integration with OpenAI API to evaluate GPT models using the MSE.

**Features:**
- Evaluates GPT-4, GPT-3.5, or compatible models
- Automatic response formatting
- Saves results to database
- Generates profile report

### 4. [Custom Storage Adapter](./custom-storage-adapter/)
Example of implementing a custom storage adapter using SQLite instead of PostgreSQL.

**Features:**
- Complete SQLite adapter implementation
- Migration scripts for SQLite
- Example usage
- Test suite

### 5. [Next.js Dashboard](./nextjs-dashboard/)
Minimal Next.js application using @godson/mse-react components to visualize ethical profiles.

**Features:**
- Profile visualization with @godson/mse-react
- Comparison view
- Responsive design
- Tailwind CSS styling

## Quick Start

Each example has its own README with setup instructions. Generally:

```bash
cd examples/[example-name]
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

## Requirements

Most examples require:
- Node.js 18+
- PostgreSQL 14+ (except SQLite example)
- Optional: Anthropic or OpenAI API key for LLM Judge

## See Also

- [Core Package Documentation](../packages/core/README.md)
- [API Reference](../docs/API_REFERENCE.md)
- [Complete Documentation](../docs/)
