# MacZen Desktop App Plan: Notes Layer On Screenshots

## 1. Summary

MacZen should let users attach notes directly to screenshots and recordings so captured media becomes a working memory system rather than a passive archive. Notes should support quick text, pinned annotations, labels, and lightweight structured fields such as status or follow-up.

This feature is appealing because it increases retention and stickiness. Once users rely on MacZen not just to store captures but to remember why they matter, replacement becomes harder.

## 2. Goals

1. Let users attach context to individual media items and albums.
2. Support quick notes during triage without forcing a separate app.
3. Make notes searchable and usable in collections, summaries, and exports.
4. Preserve notes even when media is reorganized.

## 3. Non-Goals

1. Replacing full notebooks or collaborative documents.
2. Building complex drawing/markup tooling in v1.
3. Supporting richly formatted long-form docs as the primary note type.

## 4. Note Types

1. `Item note` attached to a screenshot or recording.
2. `Album note` attached to a collection of media.
3. `Pinned annotation` anchored to a visual region for future versions.
4. `Generated note` created from summary/extraction pipelines.

## 5. Requirements

### Functional Requirements

1. Users must be able to add, edit, delete, and pin notes.
2. Notes must support plain text in v1 with optional Markdown later.
3. Notes must be searchable.
4. Notes must be filterable in smart collections and rules.
5. Notes must be exportable with media when desired.
6. Notes must sync when sync is enabled.

### Non-Functional Requirements

1. Note creation must be instant and offline-safe.
2. Notes must survive file moves and album reorganization.
3. Version history should exist for conflict recovery if sync ships.

## 6. UX Requirements

1. Quick-add note field in item detail and gallery views.
2. Album note composer in album header.
3. Visible note indicators in grid/list views for annotated items.
4. Search results should optionally match note text.
5. Provide a distinction between private notes and generated summaries.

## 7. Data Model

- `note`
  - `id`, `scope_type`, `scope_id`, `content`, `created_at`, `updated_at`, `source_type`
- `note_anchor`
  - optional future model for coordinate-based annotations
- `note_revision`
  - `note_id`, `content`, `edited_at`, `device_id`

`scope_type` should support `media_item`, `album`, `smart_collection`, and `summary_output` for extensibility.

## 8. Architecture

1. Notes live locally first in the desktop database.
2. Renderer provides fast inline editing.
3. Main process owns persistence, indexing, and sync hooks.
4. Search and smart collections treat note text as a first-class field.

## 9. Implementation Plan

### Phase 1: Core Notes

1. Add local note storage.
2. Add note UI in item and album views.
3. Add note indicators and search indexing.
4. Support export with media metadata.

### Phase 2: Workflow Notes

1. Allow summary outputs to save as notes.
2. Allow rules to add or update notes.
3. Add note-based smart collection filters.
4. Add keyboard shortcuts for triage.

### Phase 3: Advanced Annotation

1. Add anchored annotations on image regions.
2. Add note threading or checklists if needed.
3. Add synced history and conflict recovery.

## 10. Risks

1. If note UI is too heavy, it will slow down quick triage.
2. Users may expect screenshot markup features once notes exist.
3. Sync conflicts on notes can get messy without revision storage.

## 11. Monetization Fit

- Free: basic item notes
- Pro: album notes, pinned/generated notes, synced notes, note-based collections and exports

## 12. Metrics

1. Percent of active users creating notes.
2. Average notes per annotated item.
3. Search queries satisfied by note text.
4. Retention difference between note users and non-note users.

## 13. Open Questions

1. Should notes default to plain text permanently, or should Markdown ship early?
2. Should generated summaries be stored in the same note system or as a separate but linked object?
3. Do we need visual annotation in the first paid tier, or is text enough?
