# MacZen Desktop App Plan: Duplicate And Near-Duplicate Cleanup

## 1. Summary

Duplicate and near-duplicate cleanup should help users remove clutter without risking the loss of important captures. Screenshot libraries often contain bursts, repeated saves, retakes with tiny differences, exported copies, and Apple Photos overlaps. This is one of the clearest practical paid features because it saves disk space, reduces visual noise, and improves all downstream organization features.

## 2. Problem Definition

Duplicate states MacZen should handle:

1. exact duplicate file content
2. renamed duplicate with identical bytes
3. near-duplicate screenshots with tiny UI differences
4. repeated crops or exports of the same source
5. local file and Apple Photos import representing the same visual content
6. burst recordings or screenshots taken within seconds of each other

## 3. Goals

1. Detect exact and near-duplicate media accurately.
2. Present safe review flows rather than auto-deleting by default.
3. Suggest the best item to keep based on quality, recency, album membership, annotations, and usage.
4. Reduce clutter in search, collections, and summaries.

## 4. Non-Goals

1. Automatic destructive cleanup without review in v1.
2. Perfect grouping of every visually similar image.
3. Large-scale photo-library dedupe outside the MacZen media scope.

## 5. Requirements

### Functional Requirements

1. Identify exact duplicates using file hashes.
2. Identify near-duplicates using perceptual hashing and visual similarity signals.
3. Group duplicates into reviewable sets.
4. Suggest a primary item to keep.
5. Support actions:
   - delete duplicate file
   - archive duplicate group
   - merge tags/notes before delete
   - exclude from future duplicate detection
6. Reflect duplicate state in search and smart collections.

### Non-Functional Requirements

1. Analysis must run in background jobs.
2. Review flows must make destructive actions reversible when possible.
3. Duplicate grouping should remain stable across rescans.

## 6. Ranking The Best Item To Keep

Candidate heuristic factors:

1. highest resolution
2. original source over exported copy
3. annotated or tagged item over unannotated item
4. item already organized into album over unfiled item
5. item referenced by notes or summaries over orphan item
6. newest capture when differences are intentional iterations

## 7. UX Requirements

1. Add a `Duplicates` workspace or smart view.
2. Show side-by-side comparison for near-duplicates.
3. Allow keyboard-first review.
4. Make delete vs archive vs ignore explicit.
5. Display why items were grouped together.

## 8. Detection Approach

### Exact Duplicates

1. file size
2. SHA-256 or equivalent content hash
3. normalized media fingerprint

### Near-Duplicates

1. perceptual hash similarity
2. OCR overlap
3. semantic caption similarity
4. creation-time proximity
5. source-path relationship

Recommended strategy: use exact hashing for certainty, then a weighted similarity model for near-duplicates.

## 9. Data Model

- `duplicate_group`
  - `id`, `group_type`, `confidence`, `created_at`, `review_state`
- `duplicate_member`
  - `group_id`, `media_id`, `score`, `is_recommended_keep`
- `duplicate_decision`
  - `group_id`, `action`, `acted_at`, `reversible_until`
- `media_fingerprint`
  - `media_id`, `content_hash`, `perceptual_hash`, `visual_signature_version`

## 10. Implementation Plan

### Phase 1: Exact Duplicate Detection

1. Compute and store content hashes.
2. Surface exact duplicate groups.
3. Add review UI and safe-delete flow.
4. Record ignored groups.

### Phase 2: Near-Duplicate Detection

1. Add perceptual hash generation.
2. Introduce similarity thresholds and grouping logic.
3. Add side-by-side review with confidence labels.
4. Feed results into search and collections.

### Phase 3: Workflow Integration

1. Allow rules or the organization agent to flag suspected duplicates.
2. Suppress low-value duplicate items in summaries by default.
3. Add scheduled cleanup suggestions.

## 11. Risks

1. False positives can damage trust quickly.
2. Minor UI differences may matter to design and QA users.
3. Cross-source duplicate detection may mis-handle edits or exports.
4. Users may expect dedupe to reclaim storage instantly even when references remain.

## 12. Safeguards

1. Never auto-delete in v1.
2. Default to review-only recommendations.
3. Keep undo or recently deleted flow where filesystem semantics allow.
4. Preserve notes/tags before destructive actions.

## 13. Monetization Fit

- Free: exact duplicate detection only, manual review
- Pro: near-duplicate detection, best-item recommendation, batch actions, scheduled review

## 14. Metrics

1. Duplicate groups reviewed per user.
2. Percent of recommendations accepted.
3. False-positive feedback rate.
4. Storage recovered.
5. Search quality improvement after duplicate suppression.

## 15. Open Questions

1. Should duplicate review live as a dedicated mode or a smart collection preset?
2. How aggressive should near-duplicate thresholds be for design-heavy users?
3. Should recording duplicates be deferred until after still-image quality is strong?
