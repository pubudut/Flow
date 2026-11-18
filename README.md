# Flow - System Design Studio

Flow analyzes legacy repositories and designs new systems using GitHub Copilot or OpenAI, with
source-linked business diagrams, architecture review, approval and PDF reports.

## Run and configure

Requires Node.js 22.12+ and npm. Browser dependencies are vendored; install the
backend's pinned official GitHub Copilot SDK with:

    npm ci
    node server.mjs

Copy .env.example to .env before first start. AI_PROVIDER=copilot selects GitHub
Copilot; COPILOT_MODEL=auto uses automatic model selection. Open Configuration,
click Sign in to GitHub, and authorize the one-time code on GitHub. The SDK manages
credentials in its isolated state under ignored tmp/flow-copilot. Do not share
that directory; it may contain account and session data. Flow disables repository
instruction discovery, skills and agent tools, and deletes completed SDK sessions.

Copilot Free has limited personal-use allowance. Flow does not enable paid plans
or fall back to another provider automatically. Test connection sends one small
model request; Refresh checks configuration/sign-in without model inference.
Both legacy analysis and new-system design use the selected backend provider.

To use OpenAI instead, set AI_PROVIDER=openai, OPENAI_API_KEY and optionally
OPENAI_MODEL (default gpt-5.4). Restart after editing .env. Keys stay on the backend
and .env is ignored by Git and never served to the browser.

Open http://127.0.0.1:5173.

## Legacy migration

1. Select a local legacy repository or load the pricing sample.
2. Choose COBOL format and the deployment objective.
3. Click **Generate business flows**. This sends the selected source to the selected AI provider
   and produces both business flows and a proposed modern architecture.
4. Inspect flow diagrams, source references, conditions, calculations and gaps.
5. Select **Review proposed modern solution** to review the AI architecture.
6. Complete evidence-backed design reviews and approve the architecture before
   generating Spring Boot code.

There is no separate OpenAI legacy panel or local architecture fallback. AI
failures leave no replacement proposal. Diagrams use AI-produced nodes and
connectors, not the deterministic parser's paragraph diagrams. References must
exist in the supplied source; node identifiers, source ownership, edge endpoints
and reachability are validated. Flows marked uncertain show their limitations
and hide connections pending validation. Reference validation does not prove
business correctness or runtime equivalence.

Static extraction remains an internal evidence baseline: PROGRAM-ID boundaries,
fields, calls, copybooks, file/SQL access and transactions. Its original flows are
retained separately for internal numeric translation coverage, never substituted
for AI diagrams. The regression-tested numeric compiler remains an internal module;
the UI's code-generation route uses the approved AI design.

## Design a new system

Choose **New system**, enter the name, idea, optional capability candidates and
quality/integration requirements, then select **Design new system**. This action
calls the selected provider through the backend. **Load example idea** fills an order-fulfilment example.

Review editable capability boundaries, requirements, AI business-rule
interpretations and 46 design assessments spanning all five SOLID principles,
object-oriented design, SOA, anti-patterns, design patterns and 21 distributed
systems topics. The latter include consistency, consensus, quorum, leader
election, replication, partitioning, sharding, backpressure, retries, idempotency,
ordering, distributed transactions, Saga, Outbox, CQRS, event sourcing,
exactly-once semantics, at-least-once delivery, circuit breakers, bulkheads and
rate limiting.

Assessments without supporting evidence are automatically marked Not applicable
with an explanation. This is an evidence-screening decision, not proof that a
principle is irrelevant. Reviewers may override it. Other assessments require a
review disposition; Not applicable, Investigate and Defer with notes require
rationale. No architectural compliance score is inferred.

## Approval and generated code

The backend binds approval to the exact source, analysis, edited architecture
and notes for two hours. Changing the snapshot invalidates generation. Restarting
the backend clears its in-memory analysis and approval records. Approval is a
local workflow gate, not a multiuser identity or authorization system.

**Generate Spring Boot with AI** requests a Java 21 / Spring Boot 3.5.16 Maven
project containing application code, tests, Dockerfile and review/limitation
notes. Infrastructure configuration is requested when the design calls for it.
Unsafe paths, incomplete structured responses, missing assessments and fabricated
reference IDs are rejected. Downloaded code has not been built, executed or
certified by Flow. Review it and run its tests in an isolated development setup.

## Reports and diagrams

After applicability review, download a vector PDF including current-system or
requirement context, proposed capabilities, Spring Boot component layers, AI
business-rule interpretations, evidence, decisions and readiness gaps. The
report records approval status and distinguishes proposed components from
implemented behavior. ELK layouts provide wrapped cards, routed connectors,
zoom, fit-width and SVG export. Select a card to inspect full labels.

## Data handling and limits

Design actions send their selected inputs to the selected AI provider through the local backend.
The UI discloses this at the action. API usage may incur charges. Responses API
requests from the OpenAI provider use structured outputs and `store: false`; this is not a zero-retention
promise. Consult your API organization's data controls. The OpenAI provider uses an API key. Copilot uses GitHub sign-in and its own data policies.

AI requests allow 240 KB of legacy source, 600 KB total model input, one active
model call and a 180-second timeout. Generated projects are limited to 100 files
and 2 MB. Large inputs are rejected without silent truncation; select a smaller
capability subset. Folder imports support UTF-8 COBOL, copybooks, CL, RPG, DDS and
SQL. Repository reading is local until an analysis action is selected. Reloading
clears the browser workspace. Cloning remote repositories is a separate step.

## Validation and dependencies

    node --test *.test.mjs

Tests mock both providers and exercise localhost HTTP endpoints, approval binding,
source references, AI flow validation, unsafe output paths, numeric rules,
diagram layout and PDF generation. Tests incur no API charges. Generated test
reports and local toolchains are ignored by Git.

React / React DOM 19.2.0 (MIT), ELK.js 0.10.0 (EPL-2.0), and jsPDF 3.0.4 (MIT) are
vendored. Notices are in `vendor/licenses/` and the library headers.

Official API documentation:
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/models/gpt-5.4

Copilot SDK documentation: https://github.com/github/copilot-sdk
