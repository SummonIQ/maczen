# MacZen Desktop App Plan: OCR And Semantic Indexing

## 1. Summary

OCR and semantic indexing should become a first-class subsystem in MacZen rather than a hidden implementation detail. This subsystem is the foundation for AI search, smart collections, duplicate analysis, summaries, and automation. Without it, the higher-level features remain fragile and inconsistent.

The core job of the subsystem is to convert media into structured, searchable knowledge while preserving local-first operation.

## 2. Goals

1. Extract text and meaningful descriptors from screenshots and recordings.
2. Store index data locally in a queryable format.
3. Support incremental updates as media enters, changes, or leaves the library.
4. Provide a common service layer for all AI and search features.
5. Expose index health, storage size, and rebuild controls to users.

## 3. Non-Goals

1. Supporting every image-processing model variant in the first release.
2. Building a fully cloud-dependent indexing pipeline.
3. Doing expensive re-indexing synchronously on the main UI thread.

## 4. Requirements

### Functional Requirements

1. Index screenshots, images from Apple Photos, and still frames from recordings.
2. Extract OCR text with line grouping and confidence where available.
3. Generate captions or semantic descriptors for visual content.
4. Infer useful metadata when possible:
   - likely app/source
   - likely website/domain
   - visual category
   - document type
5. Track index status per media item.
6. Re-index items when better models or settings are introduced.

### Non-Functional Requirements

1. Background indexing must be throttled based on CPU, battery, and thermal state.
2. Indexing should survive app restarts.
3. Derived data should be size-bounded and purgeable.
4. Index corruption must be recoverable with rebuild tooling.

## 5. System Responsibilities

### OCR Layer

1. Text extraction from screenshots.
2. Language detection.
3. Confidence scoring.
4. Bounding boxes if the chosen OCR engine supports them.

### Semantic Layer

1. Caption generation.
2. Category classification.
3. Embedding generation for retrieval.
4. Optional key-frame analysis for video.

### Index Storage Layer

1. Store raw OCR text.
2. Store normalized searchable tokens.
3. Store vector embeddings.
4. Store model versioning and status flags.

## 6. Architecture

Recommended approach:

1. Electron main process owns index orchestration and scheduling.
2. Worker processes perform OCR and embedding generation.
3. Renderer accesses index state through IPC.
4. SQLite stores normalized metadata and FTS text.
5. A separate vector store can live in SQLite if feasible, otherwise sidecar files or a small embedded vector DB.

## 7. Pipeline

1. Media discovered or imported.
2. Create `index_task` record.
3. Generate thumbnail or representative frame.
4. OCR extraction.
5. Semantic captioning and classification.
6. Embedding generation.
7. Persist records.
8. Notify dependent systems: search, collections, agent, summaries.

## 8. Data Model

- `index_task`
  - `id`, `media_id`, `task_type`, `status`, `attempts`, `last_error`, `queued_at`, `completed_at`
- `media_ocr`
  - `media_id`, `text`, `language`, `confidence_avg`, `engine`, `engine_version`
- `media_caption`
  - `media_id`, `caption`, `category`, `provider`, `model_version`
- `media_embedding`
  - `media_id`, `vector`, `provider`, `model_version`, `dimensions`
- `index_settings`
  - local feature flags and resource constraints

## 9. User Controls

Settings should include:

1. Enable OCR indexing.
2. Enable semantic indexing.
3. Local only vs cloud-assisted processing.
4. Battery-aware processing.
5. Limit indexing to recent items first.
6. Rebuild index.
7. Clear derived data.

## 10. Implementation Plan

### Phase 1: OCR Service

1. Stand up local index database.
2. Add OCR job queue and persistence.
3. Index screenshots and Photos images.
4. Expose status and searchability.

### Phase 2: Semantic Layer

1. Add caption generation and categorical classification.
2. Add embeddings.
3. Ship local hybrid retrieval APIs.
4. Version all generated outputs.

### Phase 3: Recordings And Maintenance

1. Add key-frame analysis for video.
2. Prioritize frames around the start, scene changes, or user scrubbing.
3. Add index health dashboard and repair tools.
4. Add migration logic for improved models.

## 11. Performance Considerations

1. Use priority queues so visible and recent items index first.
2. Defer large backfills while the user is actively browsing.
3. Batch disk writes to reduce fragmentation.
4. Avoid redundant work by hashing media content and derived outputs.

## 12. Risks

1. OCR quality on dense UI can be noisy.
2. Embedded vector search may become slow at very large scale without pruning.
3. Re-indexing across model versions can create storage spikes.
4. Recording analysis can become expensive quickly.

## 13. Monetization Fit

- Free: limited OCR indexing quota or recent-window indexing only
- Pro: full-library OCR and semantic indexing, rebuild tools, local/cloud mode choice

## 14. Metrics

1. Percentage of library indexed.
2. Median indexing latency per item.
3. Search success rate on indexed vs non-indexed items.
4. Index rebuild success rate.
5. Storage consumed per 1,000 items.

## 15. Open Questions

1. Which OCR engine gives the best tradeoff between quality and offline performance on macOS?
2. Do we store bounding boxes now for future text highlighting, or defer that complexity?
3. Should indexing be tied to Pro entitlement, or should only advanced query modes be gated?
