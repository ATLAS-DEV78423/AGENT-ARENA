# Graph Report - AGENTARENA  (2026-08-30)

## Corpus Check
- Corpus is ~23,124 words - fits in a single context window. You may not need a graph.

## Summary
- 553 nodes · 816 edges · 38 communities (28 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Agent Adapters
- Core Types & Sessions
- Documentation & Blueprints
- State Machine & Errors
- Root Package Config
- TypeScript Base Config
- Orchestrator
- CLI Application
- PTY Process Manager
- Core Package
- Config Package
- Logging Package
- Agents Package
- Policy Package
- PTY Package
- Workspace Package
- Budget Enforcer
- Workspace Detector
- CLI TypeScript Config
- Agents TypeScript Config
- Config TypeScript Config
- Core TypeScript Config
- Logging TypeScript Config
- Policy TypeScript Config
- PTY TypeScript Config
- Workspace TypeScript Config
- Path Validator
- Config Schema
- Logger Factory
- CLI Entry Point
- Project README
- Agent Reasoning Loops
- Agent Tool Strategies
- pnpm Workspace
- Agent A Template
- Agent B Template

## God Nodes (most connected - your core abstractions)
1. `agentId` - 26 edges
2. `AgentAdapter` - 21 edges
3. `compilerOptions` - 21 edges
4. `sessionId` - 20 edges
5. `ArenaState` - 17 edges
6. `AI Agent Arena Complete Development Blueprint` - 17 edges
7. `AgentSessionHandle` - 16 edges
8. `OpenCodeAdapter` - 14 edges
9. `FakeAgentAdapter` - 13 edges
10. `ClaudeAdapter` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Ponytail / Lazy Senior Dev Mode` --conceptually_related_to--> `Arena Planning Protocol`  [INFERRED]
  AGENTS(1).md → reference md's/Arena_Agent_Instruction_Pack/arena_agent_instructions/core/PLANNING_PROTOCOL.md
- `Senior Dev Ladder` --conceptually_related_to--> `Arena Planning Protocol`  [INFERRED]
  AGENTS(1).md → reference md's/Arena_Agent_Instruction_Pack/arena_agent_instructions/core/PLANNING_PROTOCOL.md
- `Arena Planning Protocol` --references--> `YAGNI Principle`  [EXTRACTED]
  reference md's/Arena_Agent_Instruction_Pack/arena_agent_instructions/core/PLANNING_PROTOCOL.md → AGENTS(1).md
- `Arena Core Rules` --references--> `Root Cause Fixing`  [EXTRACTED]
  reference md's/Arena_Agent_Instruction_Pack/arena_agent_instructions/core/ARENA_CORE.md → AGENTS(1).md
- `AGENTS.md Size Limit` --rationale_for--> `Arena Engineering Instructions`  [INFERRED]
  reference md's/The Master Architect's Guide to AGENTS.md_ Precision Instruction Engineering for AI Agents.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Arena Session Protocol Flow** — reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_readme_md_arena_operating_loop, reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_core_discussion_protocol_arena_discussion_protocol, reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_core_planning_protocol_arena_planning_protocol, reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_core_implementation_protocol_arena_implementation_protocol, reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_core_review_protocol_arena_review_protocol, reference_md_s_ai_agent_arena_complete_development_blueprint_arena_state_machine [INFERRED 0.95]
- **Agent Dual Role System** — reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_agents_agent_a_agent_md_agent_a_profile, reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_agents_agent_b_agent_md_agent_b_profile, reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_agents_agent_a_strategy_agent_a_reasoning_loop, reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_agents_agent_b_strategy_agent_b_reasoning_loop, reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_agents_agent_a_tools_agent_a_tool_strategy, reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_agents_agent_b_tools_agent_b_tool_strategy, reference_md_s_arena_agent_instruction_pack_arena_agent_instructions_core_arena_core_arena_core_rules [INFERRED 0.95]
- **Arena Blueprint Architecture** — reference_md_s_ai_agent_arena_complete_development_blueprint_arena_state_machine, reference_md_s_ai_agent_arena_complete_development_blueprint_arena_protocol_v1, reference_md_s_ai_agent_arena_complete_development_blueprint_arena_agent_adapter_interface, reference_md_s_ai_agent_arena_complete_development_blueprint_arena_security_model, reference_md_s_ai_agent_arena_complete_development_blueprint_arena_verification_system, reference_md_s_ai_agent_arena_complete_development_blueprint_arena_cost_controls, reference_md_s_ai_agent_arena_complete_development_blueprint_arena_fake_agent_harness, reference_md_s_ai_agent_arena_complete_development_blueprint_arena_terminal_ux, reference_md_s_ai_agent_arena_complete_development_blueprint_builder_reviewer_role_system [INFERRED 0.85]

## Communities (38 total, 10 thin omitted)

### Community 0 - "Agent Adapters"
Cohesion: 0.06
Nodes (13): AgentAdapter, AgentSessionHandle, DetectionResult, ClaudeAdapter, ClaudeResponse, FakeAgentAdapter, OpenCodeAdapter, OpenCodeResponse (+5 more)

### Community 1 - "Core Types & Sessions"
Cohesion: 0.09
Nodes (39): EventStore, DEFAULT_BUDGET, Managed, SessionManager, AgentCapabilities, AgentProfile, AgentStatus, createAgentProfile() (+31 more)

### Community 2 - "Documentation & Blueprints"
Cohesion: 0.06
Nodes (49): Ponytail / Lazy Senior Dev Mode, Root Cause Fixing, Senior Dev Ladder, YAGNI Principle, Arena Architecture Boundaries, Arena Tech Stack, Arena Engineering Instructions, Arena Phase 0 Foundation Plan (+41 more)

### Community 3 - "State Machine & Errors"
Cohesion: 0.12
Nodes (16): ArenaError, createError(), RECOVERABLE, ErrorCode, AgentResponseType, OrchestratorConfig, OrchestratorEvent, ArenaStateMachine (+8 more)

### Community 4 - "Root Package Config"
Cohesion: 0.06
Nodes (30): eslint, @eslint/js, devDependencies, eslint, @eslint/js, prettier, @types/node, typescript (+22 more)

### Community 5 - "TypeScript Base Config"
Cohesion: 0.07
Nodes (26): dist, ES2022, node, node_modules, compilerOptions, declaration, declarationMap, esModuleInterop (+18 more)

### Community 6 - "Orchestrator"
Cohesion: 0.13
Nodes (8): FakeOrchestratorAdapter, AgentResponse, AgentResponseKind, Orchestrator, OrchestratorAdapter, OrchestratorConfig, OrchestratorEvent, OrchestratorResult

### Community 7 - "CLI Application"
Cohesion: 0.08
Nodes (23): bin, arena, dependencies, @arena/agents, @arena/config, @arena/core, @arena/logging, @arena/pty (+15 more)

### Community 8 - "PTY Process Manager"
Cohesion: 0.15
Nodes (4): ProcessManager, createProcessSession(), ProcessSessionHandle, OutputBuffer

### Community 9 - "Core Package"
Cohesion: 0.12
Nodes (15): dependencies, zod, devDependencies, @types/node, exports, @types/node, zod, main (+7 more)

### Community 10 - "Config Package"
Cohesion: 0.13
Nodes (14): dependencies, @arena/core, zod, exports, @arena/core, zod, main, name (+6 more)

### Community 11 - "Logging Package"
Cohesion: 0.13
Nodes (14): dependencies, pino, pino-pretty, exports, main, name, scripts, build (+6 more)

### Community 12 - "Agents Package"
Cohesion: 0.15
Nodes (12): dependencies, @arena/core, exports, @arena/core, main, name, scripts, build (+4 more)

### Community 13 - "Policy Package"
Cohesion: 0.15
Nodes (12): dependencies, @arena/core, exports, @arena/core, main, name, scripts, build (+4 more)

### Community 14 - "PTY Package"
Cohesion: 0.15
Nodes (12): dependencies, @arena/core, exports, @arena/core, main, name, scripts, build (+4 more)

### Community 15 - "Workspace Package"
Cohesion: 0.15
Nodes (12): dependencies, @arena/core, exports, @arena/core, main, name, scripts, build (+4 more)

### Community 16 - "Budget Enforcer"
Cohesion: 0.18
Nodes (3): BudgetEnforcer, BudgetLimits, BudgetUsage

### Community 18 - "CLI TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src, ../../tsconfig.base.json

### Community 19 - "Agents TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src, ../../tsconfig.base.json

### Community 20 - "Config TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src, ../../tsconfig.base.json

### Community 21 - "Core TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src, ../../tsconfig.base.json

### Community 22 - "Logging TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src, ../../tsconfig.base.json

### Community 23 - "Policy TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src, ../../tsconfig.base.json

### Community 24 - "PTY TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src, ../../tsconfig.base.json

### Community 25 - "Workspace TypeScript Config"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src, ../../tsconfig.base.json

### Community 27 - "Config Schema"
Cohesion: 0.40
Nodes (3): ArenaConfig, ArenaConfigSchema, DEFAULT_CONFIG

## Knowledge Gaps
- **201 isolated node(s):** `name`, `version`, `type`, `main`, `arena` (+196 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `agentId` connect `Core Types & Sessions` to `State Machine & Errors`, `Orchestrator`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `sessionId` connect `Core Types & Sessions` to `Orchestrator`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _201 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Agent Adapters` be split into smaller, more focused modules?**
  _Cohesion score 0.056535504296698326 - nodes in this community are weakly interconnected._
- **Should `Core Types & Sessions` be split into smaller, more focused modules?**
  _Cohesion score 0.08743169398907104 - nodes in this community are weakly interconnected._
- **Should `Documentation & Blueprints` be split into smaller, more focused modules?**
  _Cohesion score 0.06207482993197279 - nodes in this community are weakly interconnected._
- **Should `State Machine & Errors` be split into smaller, more focused modules?**
  _Cohesion score 0.11586452762923351 - nodes in this community are weakly interconnected._