# Evaluate OpenAI Model

Direct integration with OpenAI API to evaluate GPT models using MSE.

## Setup

```bash
npm install
cp .env.example .env
# Set OPENAI_API_KEY and DATABASE_URL in .env
```

## Usage

```bash
# Evaluate GPT-4
node index.js --model gpt-4o --agent-id gpt-4-eval-1

# Evaluate with custom config
node index.js --model gpt-3.5-turbo --items-per-axis 10 --language en
```

## How It Works

1. Initialize MSE Engine with database
2. Start evaluation session
3. For each dilemma:
   - Format as OpenAI prompt
   - Call GPT model
   - Parse structured response
   - Submit to MSE
4. Generate and save profile

## Output

Results saved to database and printed to console:
- Threshold scores per axis
- Sophistication Index
- ISM composite score
- Full profile JSON
