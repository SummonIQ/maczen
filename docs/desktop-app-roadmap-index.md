# MacZen Desktop App Roadmap Index

## 1. Purpose

This document turns the individual feature-spec docs into a prioritized delivery roadmap for the desktop app. It is meant to answer three questions:

1. what should be built first
2. what depends on what
3. which features are likely to drive paid conversion versus long-term retention

This index is intentionally desktop-app only.

## 2. Source Specs

Core feature docs:

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

Applab ticket-import companion doc:

- [applab-chatgpt-desktop-mcp-maczen-ticket-import.md](/Users/steven/Projects/maczen/docs/applab-chatgpt-desktop-mcp-maczen-ticket-import.md)

## 3. Strategic View

The roadmap naturally splits into three layers:

1. `Foundation`
   - OCR and semantic indexing
   - local metadata store and background jobs
   - rules execution primitives
2. `Upgrade drivers`
   - AI search
   - smart collections
   - always-on organization agent
   - summaries/extraction
3. `Retention and moat`
   - notes layer
   - duplicate cleanup
   - export/integrations
   - cross-device sync
   - templates

## 4. Recommended Delivery Order

### Now

These are the highest-leverage items because they unlock multiple downstream features and create obvious Pro value quickly.

1. OCR and semantic indexing
2. AI search over screenshot contents
3. smart collections
4. rules engine foundation
5. continuous organization agent v1 in observe-only or assist mode

### Next

These features compound the foundation and make the product feel more useful in daily work, not just easier to browse.

1. smart summaries and extraction
2. duplicate and near-duplicate cleanup
3. notes layer on screenshots and albums
4. export profiles and local workflow exports
5. template packs for concrete use cases

### Later

These are valuable, but they depend on the earlier systems being reliable and well-understood.

1. cross-device metadata sync
2. full derived-asset sync
3. original-media sync and backup
4. more aggressive agent automation
5. broader external integrations and shared/team workflows

## 5. Why This Order

### First Wave Rationale

1. Search is the clearest premium story, but good search requires indexing.
2. Smart collections become much more valuable once OCR and semantic fields exist.
3. Rules and the continuous agent are most trustworthy when they run against structured indexed data rather than weak heuristics.
4. Once search, collections, and automation exist, the app shifts from cleanup utility to daily workspace.

### Second Wave Rationale

1. Summaries convert stored media into reusable knowledge.
2. Notes and exports make MacZen part of the user's broader workflow.
3. Duplicate cleanup improves the quality of everything else: search, summaries, and collections.

### Final Wave Rationale

1. Sync is a strong retention feature, but it creates operational and conflict complexity.
2. Team/shared workflows should wait until local single-user workflows are stable.

## 6. Dependency Map

### Hard Dependencies

1. AI search depends on OCR and semantic indexing.
2. Smart collections depend on metadata indexing and benefit from rules/tags.
3. Summaries depend on OCR/indexing and benefit from notes/tags.
4. Continuous organization agent depends on rules and indexing.
5. Duplicate cleanup benefits from OCR/indexing and can feed collections and the agent.
6. Sync depends on stable local models for notes, collections, rules, summaries, and settings.

### Soft Dependencies

1. Templates are more valuable once rules, summaries, and exports exist.
2. Exports are more valuable once notes, summaries, and tags exist.
3. Notes become more useful once search and collections can query them.

## 7. Recommended Release Framing

### Release A: Find Anything

1. OCR and semantic indexing foundation
2. AI search
3. search explanations and filters

Positioning:

- "Search screenshots by meaning, not memory."

### Release B: Organize Itself

1. smart collections
2. rules engine
3. continuous organization agent v1

Positioning:

- "MacZen keeps your library organized while you keep working."

### Release C: Turn Captures Into Work

1. summaries and extraction
2. notes layer
3. export profiles

Positioning:

- "Turn screenshots into notes, actions, and exports."

### Release D: Scale And Clean Up

1. duplicate cleanup
2. template packs
3. sync groundwork

Positioning:

- "Make large libraries cleaner, more reusable, and portable across Macs."

## 8. Monetization Guidance

### Best Immediate Pro Hooks

1. AI search
2. full-library OCR and semantic indexing
3. unlimited smart collections
4. rules engine with automation logs
5. continuous organization agent
6. batch summaries and structured extraction

### Best Long-Term Retention Hooks

1. notes attached to media
2. export profiles and workflow integrations
3. synced collections, notes, and rules
4. optional original-media sync and backup

## 9. Engineering Cut Lines

If scope must be reduced, keep these constraints:

1. ship exact-text OCR search before overcommitting to sophisticated semantic ranking
2. ship rules preview before trusted automation
3. ship observe-only agent before auto-move behavior
4. ship metadata sync before original-media sync
5. ship local exports before fragile third-party integrations

## 10. Risks To Manage Across The Whole Roadmap

1. background indexing or automation causing performance regressions
2. automation reducing user trust if decisions are opaque
3. cloud AI usage creating privacy concerns or unpredictable costs
4. sync complexity arriving before local models stabilize
5. too many concepts at once: albums, collections, notes, rules, agent, summaries

## 11. Suggested Product Narrative

MacZen should evolve along this arc:

1. `Store and browse my captures`
2. `Help me find the right capture instantly`
3. `Help me organize without constant manual effort`
4. `Help me extract value from what I captured`
5. `Help me keep my library useful across devices and workflows`

## 12. Recommended Execution Rhythm

1. complete indexing/search platform work first
2. build one strong automation layer rather than several overlapping weak ones
3. ship one polished export path and one polished summary mode before expanding breadth
4. hold sync until the local data model settles
5. use template packs as packaging after the core workflows are real

## 13. Ticket Source

The complete engineering ticket breakdown for this roadmap, formatted for import into AppLab via its MCP server, lives in:

- [applab-chatgpt-desktop-mcp-maczen-ticket-import.md](/Users/steven/Projects/maczen/docs/applab-chatgpt-desktop-mcp-maczen-ticket-import.md)
