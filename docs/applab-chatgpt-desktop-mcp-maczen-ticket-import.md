# ChatGPT Desktop -> AppLab MCP Guide For Creating The MacZen Roadmap Project And Tickets

## 1. Purpose

This document is designed to be handed to ChatGPT Desktop so it can use AppLab's MCP tools to:

1. connect to the AppLab internal MCP server while AppLab is running in dev mode
2. ensure the MacZen project exists in AppLab
3. create the full MacZen desktop roadmap ticket backlog in AppLab
4. avoid accidentally auto-starting agent work on those tickets

This document is specific to the MacZen desktop-app roadmap.

## 2. Important Constraint

AppLab's internal MCP server is a local `stdio` JSON-RPC process at [internal-tools-server.cjs](/Users/steven/Projects/applab/lib/mcp/internal-tools-server.cjs). It does not expose a standalone remote MCP endpoint by itself. It proxies to AppLab's running Next.js API via `APPLAB_BASE_URL`, which defaults to `http://localhost:30000`.

That means:

1. AppLab must already be running locally in dev mode.
2. ChatGPT Desktop must be able to launch a local MCP server process.
3. If ChatGPT Desktop cannot self-register MCP servers, you must add the server configuration manually once, then the prompt in this doc can do the rest.

## 3. Preconditions

Before using this document with ChatGPT Desktop:

1. Start AppLab in dev mode:

```bash
cd /Users/steven/Projects/applab
bun run dev
```

2. Confirm AppLab is reachable at `http://localhost:30000`.
3. Confirm the MacZen repository exists at `/Users/steven/Projects/maczen`.
4. Have Node.js available, because the MCP server entrypoint is CommonJS and runs cleanly under `node`.

## 4. One-Time MCP Server Config For ChatGPT Desktop

Use this MCP server configuration:

```json
{
  "mcpServers": {
    "applab": {
      "command": "node",
      "args": [
        "/Users/steven/Projects/applab/lib/mcp/internal-tools-server.cjs"
      ],
      "env": {
        "APPLAB_BASE_URL": "http://localhost:30000"
      }
    }
  }
}
```

If AppLab is not running on port `30000`, change `APPLAB_BASE_URL` accordingly.

## 5. Why This MCP Server Works

The AppLab MCP server exposes internal project-management tools over `stdio` and maps them to AppLab API routes. Relevant tools include:

- `list_projects`
- `get_project`
- `create_project`
- `sync_project`
- `list_tickets`
- `create_ticket`
- `submit_intake_item`
- `list_agents`
- `route_ticket`

The key implementation detail is that `create_ticket` in AppLab can auto-assign and auto-start work once an assignee exists. For backlog import, that is the wrong tool.

Use `submit_intake_item` instead with:

- `assignmentMode: "UNASSIGNED"`
- `status: "BACKLOG"`
- `autoStart: false`

That creates tickets in AppLab without silently kicking off the agent executor.

## 6. Exact Operating Rules For ChatGPT Desktop

When ChatGPT Desktop reads this document, it should follow these rules exactly:

1. Verify the `applab` MCP server is available.
2. Inspect the available tools first.
3. Use `list_projects` to see if the MacZen project already exists.
4. Match an existing project if either condition is true:
   - the project name is exactly `maczen`
   - the project path is `/Users/steven/Projects/maczen`
5. If no such project exists, create it with:
   - `name: "maczen"`
   - `path: "/Users/steven/Projects/maczen"`
   - `description: "MacZen desktop screenshot and screen recording organizer"`
6. After confirming the project exists, call `sync_project` for `maczen`.
7. Do not call `bootstrap`.
8. Do not call `create_ticket` for backlog import.
9. Create all roadmap tickets using `submit_intake_item`.
10. Use these fixed values for every imported ticket unless a ticket explicitly says otherwise:
    - `projectName: "maczen"`
    - `status: "BACKLOG"`
    - `assignmentMode: "UNASSIGNED"`
    - `targetRole: "TECH_LEAD"`
    - `source: "assistant"`
    - `autoStart: false`
11. Before creating a ticket, call `list_tickets` and skip creation if an existing ticket in `maczen` already has the exact same title.
12. After all tickets are processed, call `list_tickets` again and return a summary grouped by epic and priority.

## 7. Exact Prompt To Give ChatGPT Desktop

Paste the following prompt into ChatGPT Desktop after the `applab` MCP server is available:

```text
Use the AppLab MCP server named `applab`.

Objective:
Create the MacZen desktop roadmap backlog in AppLab without starting any agent work.

Execution rules:
1. Inspect the available AppLab MCP tools first.
2. Check whether a project already exists for `/Users/steven/Projects/maczen` or with the exact name `maczen`.
3. If it does not exist, create it with:
   - name: maczen
   - path: /Users/steven/Projects/maczen
   - description: MacZen desktop screenshot and screen recording organizer
4. After the project exists, run `sync_project` for `maczen`.
5. Create every ticket from the manifest in Section 8 of this document.
6. Do not use `create_ticket` for this import because it can auto-assign and auto-start work.
7. Use `submit_intake_item` for every backlog item with:
   - projectName: maczen
   - status: BACKLOG
   - assignmentMode: UNASSIGNED
   - targetRole: TECH_LEAD
   - source: assistant
   - autoStart: false
8. Preserve each ticket title exactly.
9. Put the ticket requirements and acceptance criteria into the description body.
10. Include the labels exactly as listed.
11. Before creating a ticket, check existing tickets in `maczen` and skip any exact-title duplicates.
12. When complete, return:
   - whether the project had to be created
   - number of tickets created
   - number of duplicates skipped
   - a grouped summary by epic and priority

Important guardrails:
- Do not create apps.
- Do not run project bootstrap.
- Do not route tickets.
- Do not auto-start work.
- If the AppLab MCP server is not available, stop and tell me that the MCP server config from Section 4 needs to be added first.
```

## 8. Ticket Manifest

Each ticket below should become one `submit_intake_item` call.

### Epic A: Foundation And Platform

#### A1. Establish local media intelligence database
- Priority: `CRITICAL`
- Labels: `desktop-app`, `epic:foundation`, `area:backend`, `area:data`, `phase:now`
- Is frontend: `false`
- Description:
  Build the local database layer for MacZen's desktop intelligence features. It should persist media metadata, OCR outputs, captions, embeddings, notes, rule state, summary artifacts, and job state in a stable schema that can evolve over time.

  Requirements:
  - choose and integrate the persistent local database strategy for the desktop app
  - define schema versioning and migration flow
  - store media identities separately from derived artifacts
  - make the database accessible from the Electron main process without UI blocking

  Acceptance criteria:
  - the database can be initialized on a clean install
  - schema migrations run safely between versions
  - media records and derived records can be queried independently
  - a rebuild path exists for derived data without losing user-created metadata

#### A2. Implement durable background job queue for derived media work
- Priority: `CRITICAL`
- Labels: `desktop-app`, `epic:foundation`, `area:backend`, `area:automation`, `phase:now`
- Is frontend: `false`
- Description:
  Add a persistent background job system for OCR, captioning, embeddings, duplicate analysis, summaries, and agent-driven actions. Jobs must survive restarts and support retry, cancellation, and prioritization.

  Requirements:
  - persist queued, running, failed, and completed jobs
  - prioritize visible and recent media first
  - support retry with capped backoff
  - expose job progress through IPC to the renderer

  Acceptance criteria:
  - pending jobs resume after app restart
  - failed jobs show actionable error details
  - resource-intensive jobs do not block basic browsing
  - the queue supports job type prioritization

#### A3. Add desktop settings surface for AI, indexing, and automation controls
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:foundation`, `area:frontend`, `area:settings`, `phase:now`
- Is frontend: `true`
- Description:
  Create a desktop settings area for premium intelligence features so users can manage privacy, local-versus-cloud behavior, resource usage, battery policy, and rebuild actions.

  Requirements:
  - settings for OCR, semantic indexing, automation mode, and cloud assistance
  - rebuild and clear-derived-data actions
  - visibility into storage usage and current processing state

  Acceptance criteria:
  - users can toggle each major subsystem independently
  - settings persist across restarts
  - rebuild and clear actions are explicit and safe
  - current indexing and agent status is visible in settings

#### A4. Add feature flags and entitlement gating for premium roadmap features
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:foundation`, `area:backend`, `area:billing`, `phase:now`
- Is frontend: `false`
- Description:
  Wire the roadmap features to a consistent entitlement layer so search, indexing depth, summaries, automation, collections, sync, and exports can be gated without scattered license logic.

  Requirements:
  - centralize feature checks behind a desktop entitlement service
  - support local fallback state when offline
  - make feature availability queryable by the renderer

  Acceptance criteria:
  - each premium feature can be toggled via one entitlement key
  - offline behavior is deterministic
  - feature denial states can render clear upgrade messaging

### Epic B: OCR And Semantic Indexing

#### B1. Build OCR pipeline for screenshots and Photos imports
- Priority: `CRITICAL`
- Labels: `desktop-app`, `epic:ocr-indexing`, `area:backend`, `area:ai`, `phase:now`
- Is frontend: `false`
- Description:
  Implement OCR extraction for screenshots and Apple Photos imports, including language detection, confidence metadata, and line-preserving text output for search and downstream features.

  Requirements:
  - process screenshots and imported images
  - persist OCR text and engine metadata
  - support incremental indexing when new media arrives

  Acceptance criteria:
  - OCR text is stored per media item
  - OCR failures do not break the indexing pipeline
  - OCR text is queryable through the local data layer

#### B2. Build semantic captioning and category classification pipeline
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:ocr-indexing`, `area:backend`, `area:ai`, `phase:now`
- Is frontend: `false`
- Description:
  Generate captions and lightweight semantic categories for screenshots and representative video frames so MacZen can support meaning-based retrieval and categorization.

  Requirements:
  - generate one caption per supported media item
  - attach category and model version metadata
  - support local-only and cloud-assisted modes where feasible

  Acceptance criteria:
  - caption generation can run in the background queue
  - captions are versioned and rebuildable
  - semantic descriptors are available for search and collections

#### B3. Implement hybrid FTS and vector indexing layer
- Priority: `CRITICAL`
- Labels: `desktop-app`, `epic:ocr-indexing`, `area:backend`, `area:search`, `phase:now`
- Is frontend: `false`
- Description:
  Create the retrieval layer that blends full-text OCR search and vector similarity search into one indexed system suitable for local desktop use.

  Requirements:
  - support exact text search and vector similarity lookup
  - keep metadata and ranking features queryable in the same retrieval path
  - store model/version metadata for embeddings

  Acceptance criteria:
  - exact text and vector retrieval can be executed against the same media library
  - hybrid search latency is acceptable on a realistic local library
  - index records can be rebuilt when models change

#### B4. Ship index health, rebuild, and diagnostics tooling
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:ocr-indexing`, `area:backend`, `area:settings`, `phase:next`
- Is frontend: `false`
- Description:
  Add operational tooling for users and support diagnostics so indexing problems can be inspected, repaired, and rebuilt without manual file deletion.

  Requirements:
  - status counters for indexed, pending, failed, and skipped items
  - rebuild by item, by date range, or full rebuild
  - safe purge of derived artifacts

  Acceptance criteria:
  - users can see why indexing is incomplete
  - full rebuild can be triggered from the app
  - failed jobs are discoverable and retryable

### Epic C: AI Search

#### C1. Build global desktop search UI for natural-language media queries
- Priority: `CRITICAL`
- Labels: `desktop-app`, `epic:ai-search`, `area:frontend`, `area:search`, `phase:now`
- Is frontend: `true`
- Description:
  Add the main search interaction in the desktop UI, including query input, keyboard focus, live results, result cards, and fallback states while indexing is incomplete.

  Requirements:
  - global search field or command-bar style entry point
  - result cards with match snippets and metadata
  - progressive loading while index work is still running

  Acceptance criteria:
  - users can search without navigating into settings or hidden views
  - results render with clear match context
  - incomplete indexing states are understandable

#### C2. Implement hybrid query parser and ranking model
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:ai-search`, `area:backend`, `area:search`, `phase:now`
- Is frontend: `false`
- Description:
  Build the backend ranking logic that combines OCR exact matches, semantic similarity, metadata filters, recency, and user interaction signals.

  Requirements:
  - support text, metadata, and mixed queries
  - expose ranking explanation fields for the UI
  - keep scoring logic tunable over time

  Acceptance criteria:
  - hybrid queries return useful ranked results
  - ranking features are explainable in logs and UI
  - zero-result cases can be measured and improved

#### C3. Add result filters and match explanations
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:ai-search`, `area:frontend`, `area:search`, `phase:next`
- Is frontend: `true`
- Description:
  Add filters for app, album, source, media type, and date range, plus per-result explanation UI showing why the match appeared.

  Requirements:
  - facet-style or chip-based filters
  - readable explanation of OCR, semantic, and metadata contributions
  - filter state that survives navigation during the session

  Acceptance criteria:
  - users can narrow search results without rewriting the full query
  - result explanations reduce perceived randomness
  - filters work with both lexical and semantic results

#### C4. Add saved queries and search analytics
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:ai-search`, `area:search`, `area:analytics`, `phase:next`
- Is frontend: `false`
- Description:
  Support saving frequent searches and capture enough search analytics to improve relevance and identify zero-result patterns.

  Requirements:
  - save and reopen common searches
  - track anonymous local search success metrics
  - expose saved queries for future smart-collection conversion

  Acceptance criteria:
  - users can save and re-run common queries
  - search analytics can identify low-performing queries
  - saved query definitions can be reused later by collections

### Epic D: Smart Collections

#### D1. Implement smart-collection schema and evaluator
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:smart-collections`, `area:backend`, `area:data`, `phase:now`
- Is frontend: `false`
- Description:
  Create the local data model and evaluation engine for dynamic collections based on rules over metadata, OCR text, semantic fields, notes, duplicate state, and dates.

  Requirements:
  - stable schema for collection definitions and rules
  - incremental evaluation support
  - result reasons available for UI explanation

  Acceptance criteria:
  - smart collections can be stored and reevaluated reliably
  - collection membership updates as the library changes
  - match reasons are available per item

#### D2. Build smart-collection builder and editing UI
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:smart-collections`, `area:frontend`, `area:search`, `phase:now`
- Is frontend: `true`
- Description:
  Add a non-technical rule builder for creating and editing smart collections, with live counts, field/operator selection, and presets.

  Requirements:
  - support common fields and operators without exposing raw query syntax
  - show live match counts
  - let users create, rename, duplicate, and delete collections

  Acceptance criteria:
  - users can create collections without editing JSON or code
  - collection editing updates the live count preview
  - empty and invalid states are understandable

#### D3. Add collection pinning, caching, and explanation UI
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:smart-collections`, `area:frontend`, `area:performance`, `phase:next`
- Is frontend: `true`
- Description:
  Improve the smart-collection experience with navigation pinning, membership explanations, and caching strategies for larger libraries.

  Requirements:
  - allow pinning to main navigation
  - show why each item matched
  - improve performance for frequently opened collections

  Acceptance criteria:
  - pinned collections are easy to access
  - opening a common collection feels fast on a large library
  - users can understand why an item appears in a collection

### Epic E: Rules Engine

#### E1. Build deterministic rule model and executor
- Priority: `CRITICAL`
- Labels: `desktop-app`, `epic:rules-engine`, `area:backend`, `area:automation`, `phase:now`
- Is frontend: `false`
- Description:
  Implement the core rule engine with triggers, conditions, and actions for media organization. This should support deterministic evaluation before any AI-assisted behavior is added.

  Requirements:
  - rule storage and execution ordering
  - metadata and OCR condition support
  - safe action types such as tagging and queue placement

  Acceptance criteria:
  - rules can be evaluated against new and existing media
  - rule runs are reproducible and logged
  - safe actions are applied correctly

#### E2. Build rule builder, preview, and dry-run UI
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:rules-engine`, `area:frontend`, `area:automation`, `phase:now`
- Is frontend: `true`
- Description:
  Create the desktop UI for building rules, previewing affected media, and running them in dry-run mode before enabling automation.

  Requirements:
  - create, edit, duplicate, disable, and delete rules
  - dry-run preview showing matched items and intended actions
  - rule execution history entry point

  Acceptance criteria:
  - users can validate a rule before trusting it
  - preview explains what will happen and why
  - rule definitions are understandable after creation

#### E3. Add action safety model and execution audit log
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:rules-engine`, `area:backend`, `area:safety`, `phase:now`
- Is frontend: `false`
- Description:
  Add safeguards for move, export, delete-adjacent, and Photos-related actions, with audit logging and trust-level escalation for automation.

  Requirements:
  - separate safe and guarded actions
  - log each execution with before-and-after context
  - support undo or review windows where possible

  Acceptance criteria:
  - destructive or move-like actions cannot happen silently by default
  - execution history is inspectable
  - users can tell which rules are trusted for automatic application

#### E4. Add AI-assisted rule conditions and actions
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:rules-engine`, `area:ai`, `area:automation`, `phase:next`
- Is frontend: `false`
- Description:
  Extend the rules engine with semantic-category conditions and AI-triggered actions such as classify, summarize, or route to review.

  Requirements:
  - semantic predicates with confidence thresholds
  - AI cost-aware execution path
  - logging of AI-dependent rule decisions

  Acceptance criteria:
  - AI-assisted rules can be created distinctly from deterministic rules
  - semantic thresholds are configurable
  - AI-based actions are logged with reasons and confidence

### Epic F: Continuous Organization Agent

#### F1. Implement filesystem and import watcher service
- Priority: `CRITICAL`
- Labels: `desktop-app`, `epic:organization-agent`, `area:backend`, `area:automation`, `phase:now`
- Is frontend: `false`
- Description:
  Add the background watcher service that observes new screenshots, recordings, and Apple Photos imports and enqueues them for indexing and automation.

  Requirements:
  - watch configured media sources
  - create jobs for newly observed items
  - recover missed events on startup with catch-up scans

  Acceptance criteria:
  - newly added media is detected reliably
  - the watcher survives app restarts
  - startup catch-up closes gaps after downtime

#### F2. Build agent suggestion feed and review UX
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:organization-agent`, `area:frontend`, `area:automation`, `phase:now`
- Is frontend: `true`
- Description:
  Add a visible agent activity and suggestion feed showing what MacZen wants to do, what it already did, and which decisions need review.

  Requirements:
  - recent action feed
  - review queue for low-confidence decisions
  - explanation of why each suggestion exists

  Acceptance criteria:
  - users can review agent suggestions without digging through logs
  - each suggestion shows why it was proposed
  - approved and dismissed states are tracked

#### F3. Implement trusted automation policy engine
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:organization-agent`, `area:backend`, `area:safety`, `phase:next`
- Is frontend: `false`
- Description:
  Add the policy layer that decides whether an action can happen automatically based on confidence, source, action type, battery state, privacy mode, and explicit user trust settings.

  Requirements:
  - user-selectable automation modes
  - confidence thresholds
  - resource-aware and privacy-aware policy decisions

  Acceptance criteria:
  - the agent can distinguish observe-only, assist, and trusted modes
  - unsafe actions are blocked by policy when trust is insufficient
  - policy decisions are logged and explainable

#### F4. Add daily digest and feedback learning loop
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:organization-agent`, `area:automation`, `area:analytics`, `phase:next`
- Is frontend: `false`
- Description:
  Add a digest summarizing what the agent changed and collect approval or rejection feedback to improve future recommendations and automation thresholds.

  Requirements:
  - digest summary of actions over time
  - feedback capture on accepted and rejected suggestions
  - future recommendation tuning hooks

  Acceptance criteria:
  - users can review a concise summary of agent activity
  - feedback can be tied back to earlier decisions
  - rejected automation patterns can be suppressed over time

### Epic G: Smart Summaries And Extraction

#### G1. Implement structured extraction jobs for links, errors, amounts, and identifiers
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:summaries`, `area:ai`, `area:backend`, `phase:next`
- Is frontend: `false`
- Description:
  Build extraction jobs that can pull structured facts from selected media or albums, such as URLs, error codes, totals, order IDs, and similar entities.

  Requirements:
  - extraction pipeline for common structured targets
  - local persistence of extraction results
  - support multi-select and album scopes

  Acceptance criteria:
  - extracted entities can be reviewed and exported
  - extraction results are linked back to source media
  - failed items do not invalidate the full extraction job

#### G2. Build batch summary generation UI and workflow
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:summaries`, `area:frontend`, `area:ai`, `phase:next`
- Is frontend: `true`
- Description:
  Add the UX for generating summaries from a single item, a multi-select set, an album, or a smart collection, with support for summary mode selection and editable output.

  Requirements:
  - support quick summary, detailed summary, and action-item modes
  - stream progress for long jobs
  - editable output before save/export

  Acceptance criteria:
  - users can generate summaries for multiple scopes
  - the workflow supports review before saving or exporting
  - long jobs provide visible progress and status

#### G3. Store summary outputs with source citation and versioning
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:summaries`, `area:backend`, `area:data`, `phase:next`
- Is frontend: `false`
- Description:
  Persist generated summaries and extraction outputs as first-class artifacts with source references, versions, and output formats suitable for notes and exports.

  Requirements:
  - version summary outputs
  - track source media and input hashes
  - allow reuse in notes and export flows

  Acceptance criteria:
  - summary artifacts survive restart and can be reopened
  - regenerated summaries do not overwrite previous versions silently
  - source references are available when displaying outputs

#### G4. Add summary presets and automation hooks
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:summaries`, `area:ai`, `area:automation`, `phase:later`
- Is frontend: `false`
- Description:
  Add reusable summary presets and allow rules or the organization agent to trigger safe summary generation for selected workflows.

  Requirements:
  - preset library for common summary modes
  - automation entry points from rules and agent
  - opt-in controls to avoid surprise compute usage

  Acceptance criteria:
  - users can reuse summary presets without rewriting prompts
  - automation can trigger summaries in a bounded, observable way
  - summary jobs remain reviewable before downstream export

### Epic H: Duplicate Cleanup

#### H1. Implement exact duplicate detection and grouping
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:duplicate-cleanup`, `area:backend`, `area:data`, `phase:next`
- Is frontend: `false`
- Description:
  Detect exact duplicate media using content hashing and group them into stable review sets.

  Requirements:
  - content hash generation
  - duplicate group persistence
  - support exact duplicates across renamed files and sources

  Acceptance criteria:
  - exact duplicate groups are stable across rescans
  - duplicate state is queryable in the library
  - exact duplicate detection does not require manual tagging

#### H2. Implement near-duplicate scoring and side-by-side review UI
- Priority: `HIGH`
- Labels: `desktop-app`, `epic:duplicate-cleanup`, `area:frontend`, `area:backend`, `phase:next`
- Is frontend: `true`
- Description:
  Add perceptual similarity scoring and a visual review flow so users can compare slightly different screenshots and choose what to keep.

  Requirements:
  - near-duplicate scoring model
  - side-by-side review experience
  - best-item recommendation based on quality and context

  Acceptance criteria:
  - users can compare near-duplicates visually
  - recommendation reasons are visible
  - false positives can be ignored or suppressed

#### H3. Add cleanup actions, merge preservation, and undo safeguards
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:duplicate-cleanup`, `area:safety`, `area:backend`, `phase:next`
- Is frontend: `false`
- Description:
  Support cleanup actions that preserve notes, tags, and references before deletion or archival, with an undo-oriented safety model.

  Requirements:
  - merge tags/notes before cleanup
  - undo or recovery-friendly deletion path
  - duplicate decisions recorded for later analysis

  Acceptance criteria:
  - user annotations are not lost during cleanup
  - destructive actions are reversible where possible
  - accepted and ignored duplicate groups are tracked

### Epic I: Notes Layer

#### I1. Implement item and album note storage plus core editing UI
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:notes`, `area:frontend`, `area:backend`, `phase:next`
- Is frontend: `true`
- Description:
  Add note support for media items and albums, including quick-create, inline edit, and note indicators in list and grid views.

  Requirements:
  - item notes and album notes
  - local persistence
  - note indicators in browsing surfaces

  Acceptance criteria:
  - notes can be created and edited quickly
  - notes survive moves and album changes
  - note presence is visible in the browsing UI

#### I2. Add note indexing for search, collections, and summaries
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:notes`, `area:search`, `area:data`, `phase:next`
- Is frontend: `false`
- Description:
  Make notes first-class searchable content and allow smart collections, summaries, and exports to include note text as a field.

  Requirements:
  - index notes in local search
  - make note text filterable in collections
  - expose notes to summary/export pipelines

  Acceptance criteria:
  - search can match note content
  - smart collections can filter on note presence or text
  - exported artifacts can include note content when selected

#### I3. Add generated-note and pinned-note flows
- Priority: `LOW`
- Labels: `desktop-app`, `epic:notes`, `area:ai`, `area:frontend`, `phase:later`
- Is frontend: `true`
- Description:
  Support saving generated summaries as notes and prepare the model for future pinned visual annotations.

  Requirements:
  - generated summary to note conversion
  - note source typing for user versus generated notes
  - data model support for future anchored notes

  Acceptance criteria:
  - generated summaries can be converted into persistent notes
  - note origin is visible
  - pinned-note data model does not block future annotation work

### Epic J: Use-Case Templates

#### J1. Implement template manifest system for reusable workflows
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:templates`, `area:backend`, `area:product`, `phase:next`
- Is frontend: `false`
- Description:
  Create the manifest system for template packs so tags, collections, rules, and summary presets can be installed as opinionated workflows.

  Requirements:
  - template manifest format and versioning
  - install and remove behaviors
  - traceability of which assets came from which template

  Acceptance criteria:
  - templates can create workflow assets predictably
  - installed assets are distinguishable from user-created assets
  - templates can evolve with versioned manifests

#### J2. Ship initial workflow template packs
- Priority: `LOW`
- Labels: `desktop-app`, `epic:templates`, `area:product`, `area:frontend`, `phase:later`
- Is frontend: `true`
- Description:
  Launch the first set of user-facing template packs, starting with design inspiration, bug reports, receipts, research, and references.

  Requirements:
  - template preview UI
  - install flow
  - clear gating for Pro-only capabilities

  Acceptance criteria:
  - users can browse and install template packs
  - at least several starter workflows are available
  - the install flow clearly explains what assets will be created

### Epic K: Export And Integrations

#### K1. Implement core local exports for media and metadata
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:exports`, `area:backend`, `area:workflow`, `phase:next`
- Is frontend: `false`
- Description:
  Add local export jobs for clipboard, ZIP, Markdown bundle, and PDF contact-sheet style outputs, with optional metadata inclusion.

  Requirements:
  - support item, multi-select, album, and collection exports
  - let users include notes, OCR text, tags, and summaries
  - run exports as background jobs

  Acceptance criteria:
  - users can export media in multiple scopes
  - metadata inclusion is configurable
  - large exports show progress and partial failures safely

#### K2. Add reusable export profiles and metadata-rich bundles
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:exports`, `area:workflow`, `area:data`, `phase:next`
- Is frontend: `false`
- Description:
  Allow users to save export profiles that control naming, included metadata, folder structure, and destination type.

  Requirements:
  - save and reuse export profiles
  - support metadata-rich Markdown and bundle formats
  - expose profile selection in export UI

  Acceptance criteria:
  - export profiles can be created and reused
  - bundles preserve selected metadata fields consistently
  - export behavior is predictable across repeated runs

#### K3. Implement first external knowledge integrations
- Priority: `LOW`
- Labels: `desktop-app`, `epic:exports`, `area:integrations`, `area:workflow`, `phase:later`
- Is frontend: `false`
- Description:
  Add the first outbound workflow integrations, prioritizing Apple Notes, Notion, and Obsidian-compatible export flows over broader API sprawl.

  Requirements:
  - adapter-based integration layer
  - safe auth/config handling
  - destination-specific formatting

  Acceptance criteria:
  - at least one external knowledge destination works end to end
  - destination formatting is useful without manual cleanup
  - integration failures do not break local export flows

### Epic L: Cross-Device Sync

#### L1. Implement metadata sync core for albums, tags, notes, rules, and collections
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:sync`, `area:backend`, `area:cloud`, `phase:later`
- Is frontend: `false`
- Description:
  Build the metadata sync layer so key organization state can roam across multiple Macs without requiring original media sync at launch.

  Requirements:
  - device registration
  - sync checkpoints and change tracking
  - conflict-aware sync of user-created metadata

  Acceptance criteria:
  - metadata changes made on one device can be synced to another
  - offline edits reconcile safely
  - device identity and sync state are inspectable

#### L2. Add sync conflict handling and device-management UI
- Priority: `MEDIUM`
- Labels: `desktop-app`, `epic:sync`, `area:frontend`, `area:safety`, `phase:later`
- Is frontend: `true`
- Description:
  Add visible conflict handling and device management so users can understand sync state, revoke old devices, and recover from note or rule conflicts.

  Requirements:
  - conflict list and resolution flow
  - device list and revoke controls
  - sync health and last-run status

  Acceptance criteria:
  - conflicts can be inspected and resolved
  - users can revoke devices
  - sync health is visible without needing logs

#### L3. Sync derived assets such as thumbnails, OCR, and summaries selectively
- Priority: `LOW`
- Labels: `desktop-app`, `epic:sync`, `area:backend`, `area:cloud`, `phase:later`
- Is frontend: `false`
- Description:
  Add optional sync of derived artifacts so a second device can become useful faster without redoing all OCR and summary work from scratch.

  Requirements:
  - selective sync of thumbnails and derived artifacts
  - storage budgeting and retention policy
  - lazy hydration on new devices

  Acceptance criteria:
  - derived assets can be hydrated on a second device
  - selective sync settings are honored
  - storage use is bounded and understandable

#### L4. Add optional original-media sync and backup
- Priority: `LOW`
- Labels: `desktop-app`, `epic:sync`, `area:cloud`, `area:backup`, `phase:later`
- Is frontend: `false`
- Description:
  Add opt-in original media sync or backup capability for users who want their captures mirrored across devices or protected against local loss.

  Requirements:
  - configurable media sync modes
  - quota and retention controls
  - conflict and missing-file handling

  Acceptance criteria:
  - users can opt into original-media sync separately from metadata sync
  - sync scope is configurable
  - the system handles missing originals and partial sync states safely

## 9. Suggested Import Order

Recommended creation order in AppLab:

1. Foundation And Platform
2. OCR And Semantic Indexing
3. AI Search
4. Smart Collections
5. Rules Engine
6. Continuous Organization Agent
7. Smart Summaries And Extraction
8. Duplicate Cleanup
9. Notes Layer
10. Use-Case Templates
11. Export And Integrations
12. Cross-Device Sync

This keeps the backlog aligned with dependencies and makes later planning easier.

## 10. Validation Checklist For ChatGPT Desktop

After import, ChatGPT Desktop should confirm:

1. the `maczen` AppLab project exists
2. the project was synced successfully
3. all unique titles from the ticket manifest exist in AppLab
4. no ticket was auto-started
5. no apps were created
6. duplicates were skipped rather than duplicated

## 11. Source References

MacZen roadmap docs:

- [desktop-app-roadmap-index.md](/Users/steven/Projects/maczen/docs/desktop-app-roadmap-index.md)
- [desktop-app-ai-search-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-ai-search-plan.md)
- [desktop-app-smart-summaries-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-smart-summaries-plan.md)
- [desktop-app-smart-collections-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-smart-collections-plan.md)
- [desktop-app-cross-device-sync-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-cross-device-sync-plan.md)
- [desktop-app-ocr-semantic-indexing-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-ocr-semantic-indexing-plan.md)
- [desktop-app-duplicate-cleanup-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-duplicate-cleanup-plan.md)
- [desktop-app-rules-engine-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-rules-engine-plan.md)
- [desktop-app-notes-layer-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-notes-layer-plan.md)
- [desktop-app-use-case-templates-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-use-case-templates-plan.md)
- [desktop-app-export-integrations-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-export-integrations-plan.md)
- [desktop-app-continuous-organization-agent-plan.md](/Users/steven/Projects/maczen/docs/desktop-app-continuous-organization-agent-plan.md)

AppLab implementation references used for this guide:

- [internal-tools-server.cjs](/Users/steven/Projects/applab/lib/mcp/internal-tools-server.cjs)
- [manage/route.ts](/Users/steven/Projects/applab/app/api/projects/[name]/manage/route.ts)
- [tickets/route.ts](/Users/steven/Projects/applab/app/api/projects/[name]/tickets/route.ts)
- [intake/route.ts](/Users/steven/Projects/applab/app/api/projects/[name]/intake/route.ts)
- [bootstrap/route.ts](/Users/steven/Projects/applab/app/api/projects/[name]/bootstrap/route.ts)
- [schema.prisma](/Users/steven/Projects/applab/prisma/schema.prisma)
