# MacZen Desktop App Plan: Workflows And Rules Engine

## 1. Summary

The rules engine should let users encode repeatable organization behavior so MacZen can stop being a purely manual cleanup tool. Users should be able to express logic like:

- "If source app is Slack and OCR mentions bug or failed, tag it Engineering"
- "If imported from Photos and no album is assigned after 24 hours, send it to Inbox"
- "If a screenshot looks like a receipt, tag it Finance and save to Receipts album"

This is a major paid-user feature because it compounds over time. Power users do not want to repeat the same triage steps indefinitely.

## 2. Goals

1. Let users automate organization without writing code.
2. Support both deterministic rules and AI-assisted classification steps.
3. Make rules auditable and reversible.
4. Use one common engine for manual runs, background runs, and future sync.

## 3. Non-Goals

1. A full general-purpose automation platform.
2. Unbounded arbitrary scripting in v1.
3. Silent destructive actions without clear review or logs.

## 4. Rule Model

Each rule should consist of:

1. Trigger
2. Conditions
3. Actions
4. Execution mode
5. Logging and error behavior

### Trigger Examples

1. media added
2. media imported from Photos
3. item indexed
4. user runs rule manually
5. scheduled sweep

### Condition Examples

1. source app equals
2. album is empty
3. OCR contains
4. semantic category equals
5. duplicate confidence above threshold
6. media age greater than

### Action Examples

1. move to album
2. add tags
3. mark for review
4. generate summary
5. export to destination
6. suppress from default views
7. notify user

## 5. Requirements

### Functional Requirements

1. Users must be able to create, enable, disable, duplicate, reorder, and delete rules.
2. Rules must support dry-run preview.
3. Rules must show which items they would affect before committing.
4. Rules must support simple conflict handling when multiple rules target the same item.
5. Rules must have execution logs.
6. Users must be able to run a rule against the full library or a subset.

### Non-Functional Requirements

1. Rule execution must be idempotent where possible.
2. Rule latency should be low enough for background use.
3. Failures in one action should not corrupt the library state.
4. Rule definitions must be syncable and versionable.

## 6. UX Requirements

1. Provide a rule builder using plain language.
2. Include templates for common use cases.
3. Show a preview list with reasons each item matched.
4. Provide an execution history panel.
5. Clearly distinguish `safe actions` from `destructive actions`.

## 7. Action Safety Model

### Safe Actions

1. add tag
2. add note
3. move to smart queue
4. create summary
5. create reminder

### Guarded Actions

1. move file to album
2. export copy
3. remove duplicate
4. delete from Photos after copy

Guarded actions should require either explicit confirmation or a trusted rule mode after the user has reviewed prior successful runs.

## 8. Architecture

1. Store rules locally with stable IDs.
2. Evaluate conditions in the Electron main process using indexed metadata.
3. Execute filesystem or Photos actions through dedicated service adapters.
4. Log each rule execution and affected items.
5. Expose run status to renderer via IPC.

## 9. Data Model

- `rule`
  - `id`, `name`, `enabled`, `trigger_type`, `priority`, `created_at`
- `rule_condition`
  - `rule_id`, `field`, `operator`, `value_json`, `position`
- `rule_action`
  - `rule_id`, `action_type`, `params_json`, `position`
- `rule_run`
  - `id`, `rule_id`, `status`, `started_at`, `ended_at`, `preview_mode`
- `rule_run_item`
  - `run_id`, `media_id`, `matched`, `action_result_json`

## 10. Implementation Plan

### Phase 1: Deterministic Rules

1. Support metadata and OCR-based conditions.
2. Support tags, albums, mark-for-review, and notifications.
3. Add preview and run history.
4. Ship a small starter template library.

### Phase 2: AI-Assisted Rules

1. Add conditions based on semantic categories and confidence thresholds.
2. Add actions that request classification or summary generation.
3. Add a cost-aware mode if cloud inference is involved.

### Phase 3: Continuous Automation

1. Connect the engine to the always-on organization agent.
2. Add schedule-based sweeping rules.
3. Sync rule definitions for Pro users.

## 11. Risks

1. Users can create overlapping or contradictory rules.
2. Rule builders can become intimidating if the vocabulary gets too technical.
3. Background automation can feel spooky without clear logs and previews.

## 12. Monetization Fit

- Free: a small number of rules and limited action types
- Pro: unlimited rules, AI conditions, scheduled runs, synced rules, execution logs

## 13. Metrics

1. Rules created per active user.
2. Rule run success rate.
3. Percentage of newly added media touched by a rule within 24 hours.
4. Pro conversion for users who complete at least one successful rule.

## 14. Open Questions

1. Should rules be globally ordered or grouped by trigger type?
2. How much preview complexity can we expose without hurting usability?
3. Should AI rules have per-rule budget caps?
