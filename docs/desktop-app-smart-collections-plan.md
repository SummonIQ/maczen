# MacZen Desktop App Plan: Saved Smart Collections

## 1. Summary

Saved smart collections should let users define persistent views over their media library using rules instead of manual album curation. A smart collection is not a folder; it is a live query over screenshots, recordings, Photos imports, tags, OCR text, apps, dates, notes, rules output, and AI-derived metadata.

This feature matters because growing libraries become unmanageable if organization depends entirely on drag-and-drop and one-time filing decisions.

## 2. Goals

1. Allow users to define reusable dynamic collections without moving source files.
2. Use both explicit metadata and inferred metadata.
3. Make collections understandable and editable by non-technical users.
4. Prepare the data model for saved searches, automations, and workflow templates.

## 3. Non-Goals

1. Replacing physical album folders where users want actual file moves.
2. Supporting arbitrarily complex boolean expressions in the first release.
3. Multi-user shared collections in v1.

## 4. Example Collections

1. `Recent Slack Bugs`
   - source app contains Slack
   - OCR contains error OR failed OR bug
   - created within last 14 days
2. `Receipts`
   - OCR contains order, subtotal, total, receipt
   - media type is image
3. `Unorganized Imports`
   - source is Apple Photos
   - album is empty
4. `Launch Research`
   - tags include launch or competitor
   - note contains pricing

## 5. User Value

1. Users can stop over-optimizing album structure.
2. Paid users can create durable workflows from AI signals.
3. Smart collections make search and organization feel continuous instead of one-off.

## 6. Requirements

### Functional Requirements

1. Users must be able to create, rename, duplicate, and delete smart collections.
2. Rules must support common operators:
   - is / is not
   - contains / does not contain
   - any / all
   - before / after / between
   - has / does not have
3. Supported rule fields should include:
   - album
   - source type
   - media type
   - app name
   - OCR text
   - semantic category
   - tags
   - notes
   - duplicate status
   - date captured
   - summary/generated-output existence
4. Collections must auto-refresh as the library changes.
5. Users must be able to pin collections to the main navigation.
6. Users must be able to convert a smart collection into a static selection or export.

### Non-Functional Requirements

1. Collection evaluation must remain fast on large libraries.
2. Rule execution must be explainable.
3. Saved collection definitions must be portable for future sync.

## 7. UX Requirements

1. Provide a collection builder with plain-language rule editing.
2. Show a live result count while editing.
3. Include example presets to teach the feature.
4. Show "why this item matches" in the collection view.
5. Make it obvious that source files are not being moved.

## 8. Data Model

- `smart_collection`
  - `id`, `name`, `icon`, `color`, `sort_mode`, `created_at`
- `smart_collection_rule`
  - `collection_id`, `field`, `operator`, `value_json`, `position`
- `smart_collection_cache`
  - `collection_id`, `media_id`, `matched_at`, `reason_json`

`value_json` should support both scalar and array values so the rule system can evolve without breaking schema.

## 9. Rule Engine Requirements

1. Use a normalized predicate model shared with the rules/automation engine where possible.
2. Support rule groups in v2, but keep v1 to one flat conjunction with optional field-specific OR lists if needed.
3. Cache evaluated results incrementally rather than full rescans when possible.

## 10. Implementation Plan

### Phase 1: Core Collections

1. Add collection entities to local storage.
2. Support metadata-only fields and simple operators.
3. Build collection list and detail views.
4. Add live counts and incremental refresh.

### Phase 2: AI-Enriched Collections

1. Add OCR text conditions.
2. Add semantic categories, app inference, and duplicate status.
3. Add saved-search-to-collection conversion.
4. Add collection explanations.

### Phase 3: Workflow Collections

1. Add collection templates.
2. Allow export, summary, and rules to target a collection.
3. Sync definitions across devices for Pro users.
4. Enable collection-based notifications and automation triggers.

## 11. Risks

1. A complicated rule builder can make the feature look enterprise-heavy.
2. Large dynamic libraries can create evaluation and rendering overhead.
3. Users may confuse albums, tags, searches, and collections without careful UX language.

## 12. Monetization Fit

- Free: limited number of smart collections, metadata-only rules
- Pro: unlimited collections, OCR/AI fields, saved query conversion, synced definitions

## 13. Success Metrics

1. Number of collections created per active user.
2. Repeat opens per collection.
3. Share of library accesses initiated from collections rather than manual browsing.
4. Pro conversion among users who create at least two collections.

## 14. Open Questions

1. Should collection membership be materialized for offline speed or evaluated fully on demand?
2. How should collection names be suggested or auto-generated?
3. Should collections be nestable in the future, or is that too much organizational complexity?
