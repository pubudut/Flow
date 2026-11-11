# Flow - System Design Studio

Design new applications from requirements or analyze legacy COBOL repositories
for migration to Spring Boot. Review architecture, assess design applicability,
approve snapshots and download illustrated PDF documentation. Supported legacy
numeric rules can also be generated as executable Spring Boot projects.

## Design a new system from an idea

Choose **New system from an idea** at the top of the app. Enter a name, business
idea, optional capability candidates (one per line), and quality/integration
requirements. **Load example idea** provides an order fulfilment example.

Select **Design new system** to create editable capability diagrams and 46
assessments: all five SOLID principles, object-oriented design, SOA, anti-patterns,
design patterns, and all 21 distributed-system aspects. Each candidate decision
links to requirement statements. Items without requirement evidence are marked
Not applicable automatically and can be overridden. Review the remaining items
under Assessment, refine capability ownership, then approve the system design.
Download the illustrated system design PDF after reviewing applicability; the
document records whether architecture approval has occurred. Edits invalidate
approval and changing requirements requires a new proposal.

This feature runs locally using deterministic requirement matching and design
templates. It is not an LLM or a complete domain-understanding engine. Suggested
patterns, adapters, service boundaries and data ownership require engineering
validation. It does not turn a new idea into implemented Spring Boot business
code; executable generation is limited to the supported legacy numeric rules.

## Run locally

Vendored browser dependencies: React / React DOM 19.2.0 (MIT), ELK.js 0.10.0
(EPL-2.0), and jsPDF 3.0.4 (MIT). Notices are in `vendor/licenses/` and library
headers. No package install or online service is required at runtime.

Local React application for repository discovery, business flow review, and
architecture proposals. Run with Node.js 18+.

    node server.mjs

Open http://127.0.0.1:5173. Choose a local repository folder or use the built-in
pricing sample. Select fixed or free COBOL format, generate flows, review source
evidence and gaps, then create the architecture proposal. Export downloads JSON.

Source is processed in browser memory. React is vendored locally, so running the
app requires no CDN or AI provider. Reloading clears the current analysis.
Repository selection requires a browser supporting folder input, such as Edge
or Chrome. Supported imports use UTF-8, limited to 2,000 relevant files / 20 MB.
Clone remote Git repositories locally before selecting them.

The analyzer supports explicit IF/ELSE/END-IF blocks and sequential operations.
Diagrams for unsupported control flow are labeled partial and hide connections.
This is deterministic static analysis with architecture heuristics. It does not
infer complete business meaning, execute COBOL, and translates the numeric subset described below.
Paragraphs are candidate modules requiring domain review. CL, RPG, DDS, SQL and
copybooks are inventoried but need further analysis.

Architecture references
- https://docs.spring.io/spring-modulith/reference/fundamentals.html
- https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig

Run all checks with `node --test *.test.mjs` (or `npm test` if npm is installed).

## Diagram review

Business flows and architecture maps use locally vendored ELK automatic layout
with orthogonal connectors, spaced cards, wrapped labels and explicit branch
labels. Select a card to focus its relationships and inspect its full text.
Use zoom, Fit width and scrolling to explore large graphs. Export SVG downloads
a scalable diagram for sharing. Long labels are abbreviated in cards; full text
remains available in the inspector. ELK runs locally without a CDN dependency.


## Approve and generate

Generation readiness now explains missing approval and unsupported-flow blockers
beside the generation control. Approval never bypasses unsupported translation.
After approval, Check Spring Boot generation blockers shows the exact rejection
when the source cannot be translated safely.

For a PDF migration report, open Architecture → Assessment → Needs review.
Aspects without source evidence are automatically marked Not applicable with an
explanation; no manual review is required for them. Use All to override these
decisions when operational requirements provide new evidence. Evidence-backed
aspects require a disposition; Not applicable, Investigate and Defer with notes
require rationale. The PDF contains vector diagrams of current dependencies,
proposed capability boundaries and Spring Boot component layers, followed by
decisions, source evidence, business behavior, gaps and migration readiness.
Proposed components are explicitly distinguished from generated functionality.
Reports can be produced before architecture approval or with translation blockers.
PDF generation uses vendored jsPDF locally in browser memory; no upload is needed.

On the Architecture page, review the proposal, unresolved gaps and generation
scope. Add review notes, tick the review checkbox, then click Approve architecture.
Generate Spring Boot ZIP becomes available for that exact review snapshot.
Changing notes, source, analysis or deployment objective invalidates approval.
Approval is local to the browser session and is a workflow gate, not an identity
or authorization system.

The ZIP includes executable numeric rules and Maven projects targeting Java 21 / Spring Boot 3.5.16, a module
catalog REST endpoint, health checks, and domain interfaces for approved modules.
A modular proposal creates one application. Independent service proposals create
separate service folders. Source evidence, proposal, review notes and the SHA-256
approval receipt are included. Supported numeric business rules are translated into RuleEngine and exposed through a REST endpoint.

Unzip the download, enter application/ (or service-1/), and run
mvn spring-boot:run with Java 21 and Maven installed. The module catalog is at
http://127.0.0.1:8080/api/modules and health is at /actuator/health.

## Architecture from COBOL evidence

Architecture proposals now inventory PROGRAM-ID boundaries, numeric pictures,
COPY dependencies, static and dynamic CALL targets, PERFORM orchestration,
business conditions/calculations, file operations, SQL table references and
transaction statements. Paragraphs in a program remain together in the initial
module proposal. The architecture page includes source references, target
adapter suggestions, shared-resource coupling and unresolved dependencies.

These are conservative static candidates, not verified domain boundaries.
Copybooks are not expanded, dynamic calls need resolution, and complete database
schemas, runtime transactions and business intent require validation. Review
partial diagrams and unresolved gaps before approving an architecture.


## Executable COBOL rules

Approval now gates executable generation. The review screen lists supported
flows, required input/output fields and blocked flows. Generation is blocked if
any analyzed flow cannot be translated.

Supported programs contain one paragraph with explicit nested IF/ELSE/END-IF,
numeric comparisons, MOVE, and COMPUTE using addition, subtraction,
multiplication, unary signs and parentheses. Each field requires a standalone
01-level PIC [S]9(n)[V99...] declaration. Initialize every output with a numeric
MOVE at paragraph entry. Final GOBACK or STOP RUN is supported.

BigDecimal preserves decimal arithmetic. Assignments truncate to PIC scale,
or use HALF_UP for ROUNDED. Input scale violations and numeric storage overflow
are rejected with HTTP 400. This rejection is an explicit safety behavior;
validate legacy overflow and input-conversion behavior before production use.
Division, loops, calls, SQL, copybooks, strings, VALUE declarations and
multiple-paragraph orchestration require further translation work.

After approval, download the ZIP, run mvn spring-boot:run in application/, and
POST /api/rules/evaluate. See rule-contracts.json for service-local rule IDs.
The built-in sample accepts:

    {"ruleId":"rule1","fields":{"ORDER-TOTAL":"100.05","CUSTOMER-YEARS":"5"}}

Expected outputs are DISCOUNT 10.01, SHIPPING 0.00 and FINAL-TOTAL 90.04.
Generated rule IDs map back to source paragraphs in rule-contracts.json.
Run node --test analyzer.test.mjs generator.test.mjs translator.test.mjs.


## System design review

The architecture workspace includes Overview, Current system, Target design,
Assessment and Migration plan views. Business diagrams have decision diamonds,
branch connections, zoom, selectable source evidence and SVG export. System
diagrams show observed program calls and data dependencies. Proposed capability
diagrams distinguish suggested adapters with dashed edges.

Capability candidates co-locate programs with shared static data references.
Reviewers can rename capabilities, refine responsibilities and combine groups.
These changes affect generated project grouping and invalidate approval.
Shared names remain a hypothesis requiring validation of runtime resource identity.

The searchable assessment covers all five SOLID principles, object-oriented
modeling, SOA boundaries, anti-pattern signals and design pattern tradeoffs.
Distributed systems coverage includes consistency, consensus, quorum, leader
election, replication, partitioning, sharding, backpressure, retries, idempotency,
ordering, distributed transactions, Saga, Outbox, CQRS, event sourcing,
exactly-once semantics, at-least-once delivery, circuit breakers, bulkheads and
rate limiting. Each principle records applicability conditions, tradeoffs, source
evidence, a review disposition and decision rationale. These decisions are included
in exports and approval snapshots. Static evidence does not establish workload
requirements or prove full architectural conformance.

Architecture approval is available even when executable translation is blocked.
Code generation still requires supported numeric flows. Generated code does not
yet implement the proposed entity/aggregate models or distributed patterns.
Run node --test *.test.mjs for the regression suite.
