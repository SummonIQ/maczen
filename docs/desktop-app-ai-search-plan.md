# MacZen Desktop App Plan: AI Search Over Screenshot Contents

## 1. Summary

MacZen should let users find screenshots and recordings using natural language rather than folder memory. The feature should answer queries such as:

- "the Stripe billing error from Tuesday"
- "the Figma mockup with the red CTA button"
- "that receipt screenshot from last month"
- "Slack thread about launch pricing"

This is one of the strongest paid features because it turns a growing screenshot archive into a usable knowledge base. For many users, search quality will define whether MacZen feels like a lightweight organizer or a durable work tool.

## 2. Why This Matters

Current organization relies heavily on albums, manual review, and naming discipline. That works for deliberate cleanup, but it breaks down when users:

- capture too quickly to categorize in the moment
- forget where a screenshot was stored
- pull in Apple Photos items that were never manually organized
- need to retrieve screenshots by meaning instead of filename or date

AI search closes that gap by treating each media item as searchable content with both literal and semantic retrieval.

## 3. Product Goals

1. Allow natural-language search across screenshots, screen recordings, and imported Apple Photos media.
2. Combine OCR text, visual understanding, app/source clues, timestamps, album membership, and semantic embeddings in one ranking model.
3. Return useful results in under 300 ms for cached local queries on common libraries and under 1 second for larger libraries.
4. Preserve MacZen's local-first trust model by making cloud dependence optional.
5. Create a clear Pro feature with obvious day-one value.

## 4. Non-Goals

1. Building a generic enterprise search engine for arbitrary documents.
2. Full conversational AI assistant behavior in v1.
3. Perfect recall on every abstract visual query in the first release.
4. Mandatory cloud processing of private user media.

## 5. Target Users

1. Designers with thousands of inspiration and mockup captures.
2. Engineers collecting bugs, logs, and UI regressions.
3. Founders, PMs, and marketers researching competitors and campaigns.
4. People archiving receipts, confirmations, and reference material.

## 6. User Promise

"Type what you remember. MacZen finds the right capture even if you forgot the album, the filename, and the date."

## 7. Requirements

### Functional Requirements

1. Search should work across screenshots, videos, and Apple Photos imports already visible in MacZen.
2. Query types must include:
   - exact text search from OCR
   - semantic search by meaning
   - metadata search by app, date, album, source, media type
   - hybrid queries such as "Slack screenshot about refunds from February"
3. Results should surface why a match was returned.
4. Users should be able to refine results with filters after the initial query.
5. Search should support saved searches once smart collections ship.
6. Search indexing must update when media is added, moved, renamed, tagged, or deleted.
7. Search should degrade gracefully when some items have no OCR or no semantic embedding yet.

### Non-Functional Requirements

1. Indexing must not noticeably degrade capture or browsing responsiveness.
2. Search must function offline when local indexing is enabled.
3. Sensitive media must never be uploaded unless the user explicitly enables a cloud model path.
4. Storage growth must be bounded and observable in settings.
5. Ranking logic should be deterministic enough to debug and improve.

## 8. User Experience

### Core Flow

1. User opens MacZen and presses `/` or focuses the search field.
2. User enters a natural-language query.
3. Results appear grouped by best match with badges such as `OCR`, `Visual`, `Album`, `Photos`, `Recent`, `Exact text`.
4. User can open a result, reveal it in its album, or save the query.

### Result Explanation

Each result card should optionally show:

- matching extracted text snippet
- recognized app or site name
- date/time and source
- matched tags or album
- confidence indicator

### Failure States

1. If indexing is still running, show partial results and progress.
2. If semantic search is disabled, fall back to OCR and metadata search.
3. If the item is a video without transcription or extracted frames yet, show metadata-only matching.

## 9. Search Model

MacZen should use a hybrid ranking pipeline:

1. Exact match score from OCR text and metadata fields.
2. Semantic similarity score from embeddings over captions and extracted text.
3. Recency modifier.
4. User-action modifier based on prior opens, exports, and album moves.
5. Constraint filter score for explicit date, app, album, or source clauses.

Proposed ranking formula for v1:

`final_score = exact_text * 0.35 + semantic * 0.35 + metadata * 0.15 + recency * 0.10 + interaction * 0.05`

## 10. Architecture

### Desktop Responsibilities

1. Generate searchable records for each media item.
2. Maintain a local index, likely SQLite with FTS plus a vector store.
3. Provide low-latency query execution in the Electron main process.
4. Expose search APIs through IPC to the renderer.

### Optional Cloud Responsibilities

1. Higher-quality visual caption generation.
2. Remote sync of search state for multi-device users.
3. Central ranking experiments and telemetry.

## 11. Data Model

Suggested entities:

- `media_item`
  - `id`, `source_path`, `media_type`, `created_at`, `album_id`, `source_kind`
- `media_text_index`
  - `media_id`, `ocr_text`, `caption`, `app_name`, `domain`, `window_title`
- `media_embedding`
  - `media_id`, `embedding_model`, `vector`, `generated_at`
- `media_search_features`
  - `media_id`, `quality_score`, `language`, `has_faces`, `has_ui`, `duration_sec`
- `search_event`
  - `query`, `clicked_media_id`, `latency_ms`, `result_rank`

## 12. Dependencies

1. OCR subsystem from the OCR and semantic indexing plan.
2. Tagging and album metadata from the library model.
3. Optional captions for videos and still frames.
4. Search settings surface in desktop preferences.

## 13. Implementation Plan

### Phase 1: Local Search Foundation

1. Add a local SQLite database for searchable metadata.
2. Index filenames, albums, timestamps, source type, and known metadata.
3. Add FTS for OCR text once OCR ships.
4. Ship exact-text-plus-filter search.

### Phase 2: Semantic Search

1. Generate captions and embeddings locally where feasible, cloud-assisted where opted in.
2. Add vector similarity search.
3. Blend lexical and semantic ranking.
4. Add result explanations and debug logging.

### Phase 3: Search Intelligence

1. Learn from clicks and opens.
2. Support saved searches and suggested queries.
3. Add zero-result recovery with query rewriting.
4. Extend to video frame summaries and transcription.

## 14. Technical Risks

1. Embedding large libraries can create heavy CPU usage if not throttled.
2. OCR quality varies across screenshots with dense UI or low contrast.
3. Semantic ranking can feel arbitrary without good explanation UI.
4. Large vector indexes may need aggressive pruning or tiered storage.

## 15. Privacy and Trust

1. Local-only mode should be the default position.
2. If cloud assistance is enabled, MacZen must clearly explain what leaves the device.
3. Users should be able to purge search indexes and rebuild them.
4. Search analytics must be anonymized and opt-in.

## 16. Metrics

1. Search adoption rate among active users.
2. Percentage of searches ending in a media open.
3. Time-to-first-result and median query latency.
4. Zero-result rate.
5. Pro conversion lift for users who use search more than three times.

## 17. Monetization Fit

Recommended packaging:

- Free: filename/date/album search only, limited OCR indexing quota
- Pro: full OCR search, semantic search, saved searches, explanation UI
- Team later: shared search across synced libraries

## 18. Rollout Strategy

1. Internal dogfood with synthetic large libraries.
2. Beta to Pro users with indexing diagnostics enabled.
3. Gradual enablement by library size.
4. Public launch once query relevance is consistent and rebuild flow is stable.

## 19. Open Questions

1. Should local embeddings use Apple-native ML where available, or a cross-platform model abstraction from the start?
2. Should video search rely on key frames, transcription, or both in v1?
3. How much user-visible ranking explanation is useful before it becomes noisy?
4. Should free users be allowed limited daily semantic queries as an upgrade funnel?
