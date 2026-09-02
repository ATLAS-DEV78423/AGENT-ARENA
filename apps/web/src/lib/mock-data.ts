export interface Agent {
  id: string;
  name: string;
  provider: string;
  status: "online" | "offline" | "thinking";
  model?: string;
}

export interface Message {
  id: string;
  role: "user" | "agent" | "arena" | "judge";
  agentId?: string;
  agentName?: string;
  content: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  title: string;
  type: "chat" | "arena";
  agents: string[];
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export const AGENTS: Agent[] = [
  { id: "arena", name: "Arena", provider: "Multi-agent", status: "online" },
  { id: "claude", name: "Claude", provider: "Anthropic", status: "online", model: "claude-sonnet-4-20250514" },
  { id: "gpt", name: "GPT", provider: "OpenAI", status: "online", model: "gpt-4o" },
  { id: "gemini", name: "Gemini", provider: "Google", status: "offline", model: "gemini-2.5-pro" },
  { id: "qwen", name: "Qwen", provider: "Open source", status: "offline" },
];

export const MOCK_SESSIONS: Session[] = [
  {
    id: "s1",
    title: "Multi-agent benchmark design",
    type: "arena",
    agents: ["claude", "gpt", "gemini"],
    messages: [
      { id: "m1", role: "user", content: "Should we use a multi-agent approach for this benchmark?", timestamp: new Date(Date.now() - 3600000) },
      { id: "m2", role: "arena", content: "Yes. I'd structure it around three independent agents and one judge.\n\nThe important part is keeping the judge isolated from the agents' intermediate reasoning.", timestamp: new Date(Date.now() - 3500000) },
    ],
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 3500000),
  },
  {
    id: "s2",
    title: "API rate limiting strategy",
    type: "chat",
    agents: ["claude"],
    messages: [
      { id: "m3", role: "user", content: "What's the best approach for API rate limiting?", timestamp: new Date(Date.now() - 86400000) },
      { id: "m4", role: "agent", agentId: "claude", agentName: "Claude", content: "I'd recommend a token bucket algorithm with Redis backing. It's flexible, handles bursts well, and works across multiple instances.", timestamp: new Date(Date.now() - 86300000) },
    ],
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86300000),
  },
  {
    id: "s3",
    title: "Database migration plan",
    type: "chat",
    agents: ["gpt"],
    messages: [
      { id: "m5", role: "user", content: "Help me plan a zero-downtime database migration.", timestamp: new Date(Date.now() - 172800000) },
      { id: "m6", role: "agent", agentId: "gpt", agentName: "GPT", content: "The safest approach is a phased migration: add new columns as nullable, backfill, switch reads, drop old columns. I can outline the specific steps.", timestamp: new Date(Date.now() - 172700000) },
    ],
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 172700000),
  },
];

export const ARENA_RESPONSES: Record<string, string> = {
  claude: `I'd recommend a three-tier architecture with clear separation of concerns.

**Data Layer**: PostgreSQL with connection pooling via PgBouncer. Use prepared statements for repeated queries — this alone can improve throughput by 20-30%.

**Service Layer**: Stateless Node.js services behind a load balancer. Each service owns its database schema and exposes a REST/gRPC API.

**Caching Layer**: Redis for session data and frequently-accessed read paths. Use write-through caching to avoid stale data.

The key insight is keeping the services genuinely independent. If a service can't be deployed independently, it's not really a service — it's just a module in a distributed monolith.

For the migration itself, I'd use the strangler fig pattern: build the new services alongside the existing monolith, route traffic incrementally, and decommission the old code once the new path is proven in production.`,

  gpt: `Here's a practical approach that balances speed and safety:

**Phase 1: Foundation** (Week 1-2)
- Set up CI/CD pipelines for independent deployments
- Create shared types/interfaces for cross-service communication
- Deploy API gateway (Kong or Traefik) for routing

**Phase 2: Extract** (Week 3-4)
- Extract the most independent service first (usually auth or notifications)
- Use dual-write pattern during transition
- Monitor error rates and latency closely

**Phase 3: Scale** (Week 5+)
- Extract remaining services in order of coupling (least coupled first)
- Implement circuit breakers between services
- Set up distributed tracing (OpenTelemetry)

The biggest risk is distributed transactions. Avoid them where possible — use eventual consistency with compensating actions instead.`,

  gemini: `My approach focuses on minimizing risk while maximizing velocity:

**Architecture**: Event-driven microservices with an event bus (Kafka or RabbitMQ). Each service publishes domain events and subscribes to events it cares about.

**Why event-driven?** It naturally decouples services. The payment service doesn't need to know about the inventory service — it just publishes "order.paid" and interested parties react.

**Migration Strategy**:
1. Start with the domain model — identify bounded contexts
2. Create an anti-corruption layer around the existing system
3. Extract one context at a time, starting with the most stable one
4. Use feature flags to control traffic routing
5. Measure everything — latency, error rates, business metrics

**Key Considerations**:
- Data consistency: Use saga pattern for cross-service workflows
- Observability: Distributed tracing from day one
- Team structure: One team per service (Conway's Law isn't optional)`,

  judge: `Winner: Claude

**Confidence**: 87%

**Reasoning**: Strongest technical depth with practical implementation details. The three-tier architecture is well-structured, the strangler fig migration pattern is the safest approach, and the specific performance numbers (20-30% from prepared statements) show real production experience. The warning about "distributed monolith" is the kind of insight that comes from having shipped this before.

Runner-up: Gemini — strong on event-driven patterns but slightly more theoretical. GPT's phased approach is practical but lacks the architectural depth.`,
};
