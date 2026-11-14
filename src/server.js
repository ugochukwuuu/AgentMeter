import "dotenv/config";
import express from "express";
import { Polar } from "@polar-sh/sdk";
import { randomUUID } from "node:crypto";

const app = express();
app.use(express.json({ limit: "32kb" }));
const agents = new Map();
const usage = new Map();
const seen = new Set();
const demo = process.env.DEMO_MODE !== "false";
const polar = process.env.POLAR_ACCESS_TOKEN ? new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: process.env.POLAR_SERVER || "sandbox"
}) : null;

app.get("/health", (_req, res) => res.json({ ok: true, polarConfigured: !!polar, demoMode: demo }));
app.get("/", (_req, res) => res.json({ project: "AgentMeter", message: "Usage-based billing for AI agents", endpoints: ["/health", "/agents", "/usage"] }));

app.use((req, res, next) => {
  if (!process.env.API_KEY) return res.status(503).json({ error: "Configure API_KEY first" });
  if (req.get("x-api-key") !== process.env.API_KEY) return res.status(401).json({ error: "Invalid API key" });
  next();
});

app.post("/agents", (req, res) => {
  const { name, pricePerTask, externalCustomerId } = req.body || {};
  if (typeof name !== "string" || !name.trim() || typeof externalCustomerId !== "string" || !externalCustomerId.trim() || typeof pricePerTask !== "number" || !Number.isFinite(pricePerTask) || pricePerTask < 0) {
    return res.status(400).json({ error: "name, externalCustomerId, and nonnegative numeric pricePerTask required" });
  }
  const agent = { id: randomUUID(), name: name.trim(), pricePerTask, externalCustomerId: externalCustomerId.trim() };
  agents.set(agent.id, agent);
  usage.set(agent.id, []);
  res.status(201).json(agent);
});

app.post("/usage", async (req, res) => {
  const { agentId, taskId, units = 1 } = req.body || {};
  const agent = agents.get(agentId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  if (typeof taskId !== "string" || !taskId.trim() || !Number.isInteger(units) || units < 1 || units > 100000) {
    return res.status(400).json({ error: "taskId and positive integer units required" });
  }
  const key = agentId + ":" + taskId;
  if (seen.has(key)) return res.status(409).json({ error: "Task already recorded" });
  if (!polar && !demo) return res.status(503).json({ error: "Polar not configured" });
  if (polar) {
    try {
      await polar.events.ingest({ events: [{ name: "agent_task_completed", externalCustomerId: agent.externalCustomerId, metadata: { agentId, taskId, units } }] });
    } catch (error) {
      console.error("Polar event ingestion failed", error);
      return res.status(502).json({ error: "Polar event ingestion failed" });
    }
  }
  const event = { taskId, units, recordedAt: new Date().toISOString(), mode: polar ? "polar" : "demo" };
  usage.get(agentId).push(event);
  seen.add(key);
  res.status(201).json(event);
});

app.get("/agents/:id/usage", (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const events = usage.get(agent.id);
  const totalUnits = events.reduce((total, event) => total + event.units, 0);
  res.json({ agent, tasks: events.length, totalUnits, estimatedAmount: Number((totalUnits * agent.pricePerTask).toFixed(2)), currency: "USD", events });
});

app.listen(Number(process.env.PORT || 3000), () => console.log("AgentMeter API running"));
