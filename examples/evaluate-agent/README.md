# Evaluate Agent CLI

Interactive command-line tool to evaluate an AI agent via MSE API.

## Setup

```bash
npm install
cp .env.example .env
# Set API_URL in .env
```

## Usage

```bash
node index.js [agent-id]

# Example:
node index.js my-agent-123
```

The CLI will:
1. Connect to MSE API
2. Present dilemmas one by one
3. Collect your responses (or agent's responses)
4. Submit to API
5. Display final profile

## Interactive Mode

For each dilemma:
- Read the scenario
- Choose A, B, C, or D
- Provide forced choice (A or B)
- Rate permissibility (0-100)
- Rate confidence (0-100)
- Optionally provide rationale
