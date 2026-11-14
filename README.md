# AgentMeter

Usage-based billing API for AI agents, powered by Polar.

## Quick start

Requires Node.js 20+.

```bash
npm install
cp .env.example .env
# Set API_KEY in .env
npm start
```

## API

- `GET /health` — health and Polar configuration
- `POST /agents` — register agent (`name`, `pricePerTask`, `externalCustomerId`)
- `POST /usage` — record a task (`agentId`, `taskId`, `units`)
- `GET /agents/:id/usage` — view tasks and estimated costs

All non-health endpoints require an `x-api-key` header.

## Polar setup

Configure a Polar meter for the `agent_task_completed` event and aggregate `metadata.units`. Attach it to a metered product. Set `POLAR_ACCESS_TOKEN`, `POLAR_SERVER=sandbox`, and `DEMO_MODE=false`. Ensure `externalCustomerId` matches a customer in Polar. The API ingests events using the Polar SDK.

Without Polar credentials, `DEMO_MODE=true` records events locally for demonstration. Local estimated charges are **not** real Polar invoices or payments. Data is stored in memory and resets on restart.

## Test

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/agents -H 'Content-Type: application/json' -H 'x-api-key: YOUR_KEY' -d '{"name":"Support Bot","pricePerTask":0.05,"externalCustomerId":"demo-user"}'
# Use the returned agent ID below
curl -X POST http://localhost:3000/usage -H 'Content-Type: application/json' -H 'x-api-key: YOUR_KEY' -d '{"agentId":"AGENT_ID","taskId":"task-1","units":1}'
curl -H 'x-api-key: YOUR_KEY' http://localhost:3000/agents/AGENT_ID/usage
```

Hackathon MVP; not production billing infrastructure.
