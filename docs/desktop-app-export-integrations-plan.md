# MacZen Desktop App Plan: Export And Integrations

## 1. Summary

Export and integration features should help users move organized screenshots and derived knowledge into the rest of their workflow. The goal is not to trap users inside MacZen. The goal is to make MacZen the fastest place to prepare visual information before it gets sent elsewhere.

This is attractive for paid users because downstream workflow fit often matters more than storage or browsing alone.

## 2. Target Destinations

Recommended initial destinations:

1. Clipboard
2. Markdown bundle
3. ZIP export
4. PDF contact sheet
5. Apple Notes
6. Notion
7. Obsidian-compatible Markdown vault

Later destinations:

1. Google Drive / Dropbox
2. Linear / Jira issue attachments
3. Slack posting
4. Email share sheet

## 3. Goals

1. Export media with useful context, not just raw files.
2. Support single-item, multi-item, album, and smart-collection export.
3. Let users include notes, tags, OCR text, and summaries when relevant.
4. Make export destinations extensible.

## 4. Non-Goals

1. Building two-way sync integrations for every platform in the first release.
2. Replacing dedicated documentation or PM tools.
3. Automating external posting without clear user review in v1.

## 5. Requirements

### Functional Requirements

1. Users must be able to export selected media as files only or files plus metadata.
2. Supported metadata should include:
   - filename
   - capture date
   - album
   - tags
   - OCR text
   - notes
   - summaries
   - source attribution
3. Users must be able to choose destination-specific formats.
4. Export profiles should be saveable.
5. Rules and the organization agent should be able to trigger exports where safe.

### Non-Functional Requirements

1. Export must handle large batches without freezing the app.
2. Failures for one item should not abort the whole batch unless the user requests strict mode.
3. Integrations must be isolated behind adapters.

## 6. Export Profiles

A reusable export profile should define:

1. destination
2. file format
3. metadata fields included
4. naming strategy
5. folder structure
6. whether originals, thumbnails, or both are exported

## 7. Architecture

1. Build a core export service in the Electron main process.
2. Use destination adapters for each export target.
3. Generate intermediate export payloads before destination-specific formatting.
4. Track export jobs and results.

## 8. Data Model

- `export_profile`
  - `id`, `name`, `destination_type`, `config_json`
- `export_job`
  - `id`, `scope_type`, `scope_id`, `profile_id`, `status`, `started_at`, `completed_at`
- `export_item`
  - `job_id`, `media_id`, `result`, `destination_ref`

## 9. Implementation Plan

### Phase 1: Core Local Exports

1. Clipboard export.
2. ZIP export.
3. Markdown bundle export.
4. PDF contact sheet export.
5. Batch export progress UI.

### Phase 2: Knowledge Exports

1. Include OCR text, notes, tags, and summaries.
2. Add saved export profiles.
3. Add better filename and folder templates.

### Phase 3: External Integrations

1. Apple Notes integration.
2. Notion export.
3. Obsidian vault export.
4. Future issue-tracker integrations if demand justifies them.

## 10. Monetization Fit

- Free: basic file export and clipboard copy
- Pro: profile-based exports, metadata-rich bundles, external integrations, automation-triggered exports

## 11. Risks

1. External APIs add maintenance burden.
2. Export format mismatch can create user confusion if destination output is not predictable.
3. Bulk export can be expensive when generated summaries or OCR need backfilling first.

## 12. Metrics

1. Export completion rate.
2. Most used export destinations.
3. Percentage of exports including metadata.
4. Retention and conversion impact for users with saved export profiles.

## 13. Open Questions

1. Which external destination should ship first after local exports?
2. Should export adapters live in the desktop app only, or share code with the marketing-site/API layer later?
3. Do we need a lightweight plugin model, or is that premature?
