# MacZen Desktop App Plan: Cross-Device Sync

## 1. Summary

Cross-device sync should make a user's MacZen library feel continuous across multiple Macs without breaking the app's local-first trust model. Users should be able to open MacZen on a work Mac and personal Mac and find the same albums, notes, smart collections, tags, summaries, organization rules, and optionally synced media.

Sync is a high-value paid feature because it increases switching costs and makes MacZen part of a user's daily workflow across environments.

## 2. Goals

1. Sync library metadata reliably across multiple Macs.
2. Support optional media sync and backup tiers.
3. Preserve offline usability and local performance.
4. Make conflict handling understandable and recoverable.
5. Keep sync architecture extensible for future team/shared use cases.

## 3. Non-Goals

1. Building a consumer cloud drive from scratch.
2. Requiring media upload for the app to function.
3. Real-time collaborative multi-user editing in the first version.

## 4. Sync Scope

### Metadata That Should Sync First

1. Albums and album structure.
2. Tags and tag assignments.
3. Notes and pinned summaries.
4. Smart collections and saved searches.
5. Rules and automation settings.
6. Entitlements and preferences that should roam.

### Media Sync Options

1. `Metadata only`
2. `Thumbnails + metadata`
3. `Full originals + derived data`

## 5. User Value

1. Move seamlessly between machines.
2. Recover organization state after hardware replacement.
3. Keep notes, tags, and search context consistent.
4. Enable future shared or team workflows.

## 6. Requirements

### Functional Requirements

1. Users must be able to sign in and see sync status.
2. Users must be able to choose sync scope.
3. First-run sync should support merge, replace local, or keep separate until reviewed.
4. Sync must detect and resolve conflicts for albums, notes, rules, and tags.
5. Users must be able to pause sync and force a manual sync.
6. The system must support background sync without keeping the window open.

### Non-Functional Requirements

1. Sync must be resumable after crashes or connectivity loss.
2. Corruption of one record must not block the entire pipeline.
3. Encryption must be standard and explicit.
4. Initial sync must not freeze the UI.
5. Sync progress and errors must be visible in settings.

## 7. Architecture Options

### Option A: MacZen-Hosted Sync

Pros:

- full control over schema and evolution
- easiest entitlement coupling
- cleanest path to shared libraries later

Cons:

- infrastructure and storage burden
- higher trust expectations

### Option B: User-Linked Storage Providers

Examples: iCloud Drive, Dropbox, S3-compatible buckets.

Pros:

- aligns with privacy-sensitive users
- lower storage cost for MacZen

Cons:

- more provider-specific edge cases
- weaker cross-provider support guarantees

Recommended approach: MacZen-hosted metadata sync first, provider-backed media sync second.

## 8. Data Model

Every synced entity should include:

- stable ID
- updated timestamp
- device ID of last write
- tombstone support for deletes
- schema version

Suggested sync tables:

- `sync_checkpoint`
- `sync_change_log`
- `device_registration`
- `entity_tombstone`
- `sync_conflict`

## 9. Conflict Strategy

1. Tags and collection definitions can typically use last-write-wins.
2. Notes should preserve both versions when conflicts are meaningful.
3. Album renames should use identity-based merge, not name-based merge.
4. Media references should tolerate missing originals and late-arriving thumbnails.

## 10. Implementation Plan

### Phase 1: Metadata Sync

1. Introduce signed-in device registration.
2. Sync albums, tags, notes, rules, and collections.
3. Add pull, push, and conflict logging.
4. Ship metadata-only Pro sync.

### Phase 2: Derived Assets

1. Sync thumbnails, OCR text, summaries, and embeddings selectively.
2. Add selective download and storage budgeting.
3. Allow a new device to become useful before full asset hydration completes.

### Phase 3: Original Media Sync And Backup

1. Support optional original-file syncing or backup mirroring.
2. Add retention, quota management, and recovery flows.
3. Prepare for future shared spaces.

## 11. Security Requirements

1. Use per-user encryption for synced data at rest.
2. Treat screenshot contents as sensitive by default.
3. Require re-auth for sensitive provider changes.
4. Provide a device-management UI so users can revoke old Macs.

## 12. Monetization Fit

- Free: no sync or extremely limited metadata sync on one backup device
- Pro: multi-device metadata sync, notes/tags/collections/rules
- Higher Pro tier later: full media sync and backup capacity

## 13. Metrics

1. Number of connected devices per paid user.
2. Daily sync success rate.
3. Conflict rate and unresolved conflict duration.
4. Retention lift for users with two or more devices connected.

## 14. Open Questions

1. Should sync depend on the current auth and subscription migration first?
2. Which storage provider should back media sync at launch?
3. Do we ship metadata sync before a formal cloud backup story, or together?
