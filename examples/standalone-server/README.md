# Standalone MSE Server

Complete Express.js server with MSE integration and PostgreSQL.

## Setup

```bash
npm install
cp .env.example .env
docker-compose up -d  # Start PostgreSQL
npm run migrate       # Run migrations
npm start            # Start server
```

## API Endpoints

```
POST   /evaluations              # Start new evaluation
POST   /evaluations/:id/responses # Submit response
GET    /evaluations/:id          # Get evaluation status
GET    /profiles/:agentId        # Get agent profile
GET    /compare?agents=id1,id2   # Compare agents
```

## Example Usage

```bash
# Start evaluation
curl -X POST http://localhost:3000/evaluations \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"abc","version":"v2.1","language":"en"}'

# Submit response
curl -X POST http://localhost:3000/evaluations/{id}/responses \
  -H "Content-Type: application/json" \
  -d '{"item_id":"rvc-001","choice":"A","forced_choice":"A","permissibility":20,"confidence":80}'
```
