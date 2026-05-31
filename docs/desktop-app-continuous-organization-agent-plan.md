# MacZen Desktop App Plan: Continuous Organization Agent

## 1. Summary

MacZen should have an optional always-on organization agent that watches for new media entering the user's library and continuously decides what should happen next. This agent is separate from the rules engine:

- the rules engine defines reusable logic
- the continuous organization agent decides when to run that logic, when to ask for review, and when AI assistance is needed

This is likely one of the most compelling premium features because it makes MacZen feel alive instead of passive. Users should not have to remember to run cleanup sessions for the app to stay useful.

## 2. Problem Definition

MacZen currently becomes more valuable when users actively triage media. The problem is that users often do not maintain that habit. They keep taking screenshots, importing Photos items, and capturing recordings, but organization quality decays unless they return to manual review. An always-on agent closes that gap by continuously processing new inputs.

## 3. Agent Responsibilities

The agent should:

1. watch for new screenshots, recordings, and imports
2. queue indexing and enrichment work
3. run deterministic rules
4. optionally run AI classification when rules are insufficient
5. decide whether an item can be auto-organized, should be staged for review, or should be left untouched
6. keep logs and explain its decisions
7. respect user resource, privacy, and automation settings

## 4. Goals

1. Reduce the amount of manual triage required to keep a library organized.
2. Ensure new media becomes searchable, tagged, and routed quickly.
3. Make automation feel trustworthy through clear review and logging.
4. Provide a high-value Pro capability with durable daily utility.

## 5. Non-Goals

1. Fully autonomous destructive cleanup in the first release.
2. A chat-based agent that tries to do everything.
3. Continuous cloud uploading without clear user consent.

## 6. User Modes

Recommended operating modes:

1. `Observe only`
   - watches library changes and proposes actions
2. `Assist`
   - auto-tags, creates suggestions, and stages items for review
3. `Trusted automation`
   - runs approved safe rules automatically
4. `Aggressive automation` later
   - optional for users who explicitly want broader hands-off behavior

## 7. Trigger Sources

1. filesystem watcher for screenshot and recording paths
2. Apple Photos import events or scheduled sync checks
3. app startup catch-up scan
4. periodic library sweep for stale unorganized items
5. manual "run agent now" command

## 8. Decision Pipeline

1. Detect new media.
2. Create work item in the agent queue.
3. Ensure OCR and semantic indexing are scheduled.
4. Evaluate deterministic rules.
5. If unresolved and AI organization is enabled, request AI classification.
6. Score confidence and policy eligibility.
7. Execute safe actions or stage review tasks.
8. Write execution log and notify dependent surfaces.

## 9. Policy Model

Every agent action should be governed by policy controls:

1. allowed sources
2. quiet hours
3. CPU/battery constraints
4. internet-required actions
5. destructive-action permissions
6. confidence thresholds
7. max actions per hour/day

## 10. Requirements

### Functional Requirements

1. Users must be able to enable or disable the agent.
2. Users must be able to choose operating mode.
3. The agent must show a recent activity feed.
4. Users must be able to approve, undo, or suppress recommendations.
5. Users must be able to define what counts as safe auto-organization.
6. Agent output must integrate with albums, tags, notes, summaries, search, and duplicates.

### Non-Functional Requirements

1. The agent must not meaningfully degrade capture responsiveness.
2. Background processing must be resource-aware.
3. The queue must persist across restarts.
4. Failures must be retryable and visible.
5. The agent must not require the main window to be open.

## 11. UX Requirements

1. Add an `Automation` or `Agent` settings section.
2. Show current state: idle, watching, indexing, reviewing, waiting for approval, paused.
3. Show recent actions such as:
   - tagged item
   - moved to album
   - flagged duplicate group
   - requested review
   - generated summary
4. Let users drill into why a decision was made.
5. Make it easy to promote a repeated recommendation into a permanent rule.

## 12. Architecture

### Components

1. `Watcher service`
   - file and import change detection
2. `Agent queue`
   - durable jobs and prioritization
3. `Policy engine`
   - decides whether actions are allowed
4. `Rule executor`
   - runs deterministic workflows
5. `AI classification service`
   - only used when needed and enabled
6. `Decision logger`
   - stores outcomes and explanations

### Process Ownership

1. Electron main process owns the queue, policies, and OS watchers.
2. Worker processes handle OCR, classification, and heavier jobs.
3. Renderer consumes agent state and review items through IPC.

## 13. Data Model

- `agent_job`
  - `id`, `media_id`, `job_type`, `status`, `priority`, `created_at`, `attempts`
- `agent_decision`
  - `job_id`, `decision_type`, `confidence`, `policy_result`, `explanation_json`
- `agent_action`
  - `decision_id`, `action_type`, `result`, `reversible_until`
- `agent_policy`
  - current user settings and thresholds
- `agent_feedback`
  - `decision_id`, `feedback_type`, `created_at`

## 14. Relationship To Other Features

The agent depends on and amplifies other roadmap items:

1. OCR and semantic indexing provide searchable understanding.
2. Rules provide deterministic automation.
3. Smart collections provide dynamic destinations and queues.
4. Duplicate cleanup provides clutter detection.
5. Summaries and notes provide richer outcomes.
6. Sync later allows agent settings and logs to roam across devices.

## 15. Implementation Plan

### Phase 1: Watch And Suggest

1. Add background watchers for screenshot folders and imports.
2. Queue new items for indexing.
3. Run safe metadata-only rules.
4. Show recommendation feed without automatic file moves.

### Phase 2: Assisted Automation

1. Add AI classification for unresolved items.
2. Allow safe auto-tagging and smart-queue placement.
3. Let users approve repeatable suggestions and convert them into trusted behaviors.
4. Add daily digest of what the agent changed.

### Phase 3: Trusted Automation

1. Allow safe auto-moves into albums for approved rule paths.
2. Add duplicate flagging and summary generation.
3. Support schedule-based cleanup sweeps.
4. Add remote notifications later if sync exists.

## 16. Safeguards

1. No destructive actions by default.
2. Explain every agent decision.
3. Keep undo windows where possible.
4. Require explicit trust elevation for auto-move or delete-adjacent behavior.
5. Respect offline and privacy settings.

## 17. Monetization Fit

- Free: observe-only suggestions, limited agent queue processing
- Pro: always-on agent, safe trusted automation, AI classification, review feed, daily digests

## 18. Metrics

1. Percentage of new media processed by the agent within 10 minutes.
2. Acceptance rate of agent suggestions.
3. Manual triage reduction for active users.
4. Library organization coverage after 7 and 30 days.
5. Pro conversion among users who enable the agent.

## 19. Risks

1. Users may distrust continuous automation if the app feels opaque.
2. OS-level watchers and Photos integrations can be fragile.
3. AI-driven auto-organization can cause wrong placements if thresholds are too loose.
4. Background processing can create battery or thermal complaints if not managed carefully.

## 20. Rollout Strategy

1. Start with observe-only mode for internal dogfood.
2. Ship suggestion feed to Pro beta users.
3. Add limited safe auto-actions once acceptance rates are strong.
4. Delay destructive or delete-adjacent automation until trust and logging are mature.

## 21. Open Questions

1. Should the agent be branded as an "agent," "autopilot," or simply "background organization"?
2. What resource policy should be the default on laptops running on battery?
3. How much daily digesting is useful before it becomes spam?
