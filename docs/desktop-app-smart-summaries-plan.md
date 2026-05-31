# MacZen Desktop App Plan: Smart Summaries And Extraction

## 1. Summary

MacZen should convert a pile of screenshots into usable outputs: summaries, action items, extracted text, links, errors, decisions, and reusable notes. Instead of forcing users to manually scan twenty screenshots from a meeting or debugging session, MacZen should be able to answer "what happened here?" and "what should I keep?"

This feature is compelling for paid users because it turns passive storage into active utility. Search helps users find captures; summaries help them understand and use them.

## 2. Core Use Cases

1. Summarize a folder of bug screenshots into a concise incident note.
2. Extract all URLs, order numbers, and receipts from a finance album.
3. Turn meeting screenshots into bullets and follow-ups.
4. Pull out repeated UI patterns from design inspiration captures.
5. Convert a set of screenshots into a structured export for Notion, Markdown, or email.

## 3. Goals

1. Generate useful summaries over one item, a selected group, or an entire album.
2. Extract structured entities with high precision.
3. Let users review and edit outputs before exporting or saving.
4. Support repeatable workflows by output type.
5. Make the feature feel deterministic enough for real work, not novelty.

## 4. Non-Goals

1. Replacing full note-taking or project-management software.
2. Automatically publishing content without user review.
3. Perfect semantic understanding of every visual layout in v1.

## 5. Feature Surface

### Summary Modes

1. `Quick Summary`: 3 to 5 bullets.
2. `Detailed Summary`: narrative with sections.
3. `Action Items`: tasks, owners if inferable, and next steps.
4. `Research Digest`: themes, takeaways, contradictions.
5. `Bug Report Draft`: issue description, repro clues, visible errors.

### Extraction Modes

1. Text extraction.
2. Links and domains.
3. Error messages and codes.
4. Dates, amounts, order IDs, invoice numbers.
5. People, companies, and product names.
6. UI labels and button text.

## 6. Requirements

### Functional Requirements

1. Users must be able to summarize:
   - a single media item
   - multi-select results
   - an album
   - a saved smart collection
2. Users must be able to choose output format before generation.
3. Generated output must cite which screenshots contributed to each section where feasible.
4. The system should support export to clipboard, Markdown, plain text, and integrated destinations.
5. Users should be able to pin generated summaries to albums or media.
6. Outputs should be regenerable with new prompts or stricter extraction modes.

### Non-Functional Requirements

1. Multi-item generation must stream progress for long-running jobs.
2. Failures on one media item should not invalidate the full batch.
3. Outputs must be cached and versioned.
4. Generation cost and token volume must be visible if cloud AI is used.

## 7. UX Design Requirements

1. Entry points from album toolbar, multi-select toolbar, and item detail view.
2. A generation drawer should show:
   - selected scope
   - summary mode
   - extraction toggles
   - privacy mode
   - output destination
3. Results should open in an editable pane with source references.
4. Users should be able to save the result as:
   - album note
   - standalone note
   - exported file
   - copied content

## 8. Output Contracts

MacZen should use structured intermediate schemas before rendering text. Example schema:

```json
{
  "title": "Launch bug review",
  "summary": ["Billing CTA mismatches plan copy", "Two screenshots show failed checkout state"],
  "actionItems": [
    { "text": "Fix plan label mismatch", "priority": "high", "sourceMediaIds": ["m1", "m3"] }
  ],
  "entities": {
    "urls": ["https://example.com/pricing"],
    "errors": ["payment_intent_unexpected_state"]
  }
}
```

## 9. Architecture

### Pipeline

1. Gather media records and metadata.
2. Retrieve OCR text, captions, tags, notes, and album context.
3. Chunk large inputs by token budget.
4. Generate structured outputs through local or cloud model providers.
5. Merge chunk results and render final user-facing output.

### Providers

1. Local-only mode for lightweight extraction where possible.
2. Cloud-enhanced mode for richer summaries and entity extraction.
3. Provider abstraction so MacZen is not tightly coupled to a single AI service.

## 10. Data Model

- `summary_job`
  - `id`, `scope_type`, `scope_id`, `mode`, `status`, `provider`, `created_at`
- `summary_output`
  - `job_id`, `version`, `json_payload`, `rendered_markdown`, `token_usage`
- `summary_source`
  - `job_id`, `media_id`, `included_text_hash`
- `summary_feedback`
  - `job_id`, `rating`, `edited`, `saved_destination`

## 11. Implementation Plan

### Phase 1: Extraction Foundation

1. Reuse OCR and caption data.
2. Add structured extraction jobs for text, links, errors, and amounts.
3. Support export to clipboard and Markdown.
4. Store outputs locally.

### Phase 2: Summaries

1. Add batch summary generation for albums and selections.
2. Support quick, detailed, and action-item modes.
3. Add source citation and streaming UI.
4. Allow pinning summaries to albums.

### Phase 3: Templates And Automation

1. Add reusable prompts by use case.
2. Let rules or the organization agent trigger summary generation.
3. Connect outputs to export integrations.
4. Add feedback loop to improve prompt defaults.

## 12. Edge Cases

1. Very large albums may need chunking and partial summaries.
2. Screenshots with no text still need image captioning or visual clustering.
3. Mixed-language screenshots require language detection.
4. Repeated duplicate screenshots should be deduplicated before summarizing.
5. Recordings may need key-frame selection or transcription.

## 13. Quality Bar

A generated summary should be considered acceptable only if it:

1. is materially shorter than reviewing the source images manually
2. preserves key facts visible in the captures
3. avoids inventing specifics not grounded in source media
4. cites source items when confidence is medium or low

## 14. Monetization Fit

- Free: basic OCR extract to clipboard, limited per-day usage
- Pro: batch summaries, structured extraction, pinned outputs, export destinations
- Team later: shared summaries and workflow templates

## 15. Metrics

1. Summary generation completion rate.
2. Save/export rate of generated outputs.
3. Edit distance between generated and final saved versions.
4. Repeat usage by album type.
5. Upgrade conversion after first successful summary use.

## 16. Rollout Strategy

1. Launch extraction first because it is lower risk and easier to validate.
2. Release single-item summaries next.
3. Then enable album and bulk summarization.
4. Finally connect summaries to automation and integrations.

## 17. Open Questions

1. Should summaries be stored alongside albums as first-class objects or as note variants?
2. How much custom prompting should users have in v1?
3. Should MacZen auto-suggest summary types based on album contents?
4. Do we need a "strictly extract, do not infer" mode for finance and compliance users?
