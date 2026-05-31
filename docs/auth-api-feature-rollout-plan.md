# MacZen Auth + API + Feature Rollout Plan

## 1. Goals

1. Replace license-key activation with account authentication and subscription-based feature gating.
2. Centralize paid/free capability checks behind API routes and entitlements.
3. Keep desktop UX local-first while using account state to allow/deny premium functionality.
4. Ship roadmap features behind stable data contracts:
   - Unlimited screenshots
   - AI organization
   - OCR text search
   - Cloud backup
   - Priority support
   - Advanced analytics

## 2. Pattern Source (Snoopi)

Adopt the same architectural pattern currently used in `~/Projects/snoopi`:

- `better-auth` server with Prisma adapter (`api/lib/auth/server.ts` pattern)
- Catch-all auth route (`api/app/api/auth/[...all]/route.ts` pattern)
- Stripe webhook lifecycle -> normalized `Subscription` record (`api/app/api/billing/webhook/route.ts` pattern)
- Checkout creation route that links Stripe customer/session to a user (`api/app/api/billing/create-checkout/route.ts` pattern)
- Simple status endpoint consumed by client (`api/app/api/billing/status/route.ts` pattern)

## 3. Target Architecture

### 3.1 Services

1. `apps/marketing-site` becomes the source of truth for:
   - Auth/session
   - Subscription lifecycle
   - Entitlements
   - Feature flags/limits
2. `apps/desktop-app` consumes those APIs and applies local gating.
3. Desktop keeps local media scanning/indexing/rendering for performance; cloud APIs only provide account/subscription/entitlement state and cloud-linked workflows.

### 3.2 Data Model (Prisma)

Use the current in-progress schema as base and finalize:

1. `User`, `Session`, `Account`, `Verification` (better-auth)
2. `Subscription`
   - `plan`, `status`, Stripe IDs, billing period fields
3. `Entitlement`
   - per-user feature overrides (support grants, beta flags, manual enablement)
4. Transitional `License` model retained short-term only for migration.

## 4. Auth Implementation Plan

### Phase A: Server Auth Foundation

1. Finalize `apps/marketing-site/lib/auth/server.ts`
   - Keep trusted origins for desktop dev ports and production domains.
   - Enforce cookie policy (`sameSite=lax`, secure in production).
2. Finalize auth handler route:
   - `app/api/auth/[...all]/route.ts`
3. Add auth client helpers for web UI and any shared account screens.

### Phase B: Account Endpoints

Ship stable account endpoints:

1. `GET /api/account/me`
   - Returns `authenticated`, `user`, `subscription`, `entitlements`.
2. `GET /api/account/entitlements`
   - Lightweight entitlement payload for fast checks.
3. `POST /api/account/signout` (optional convenience wrapper; direct better-auth route also fine).

Response contract for desktop:

```json
{
  "authenticated": true,
  "user": { "id": "...", "email": "...", "name": "..." },
  "subscription": { "plan": "pro_monthly", "status": "active" },
  "entitlements": {
    "aiOrganization": true,
    "ocrTextSearch": false,
    "cloudBackup": false,
    "prioritySupport": false,
    "advancedAnalytics": false,
    "unlimitedScreenshots": true
  }
}
```

## 5. Billing + Entitlements Plan

### Phase C: Stripe Normalization

1. Checkout route creates Stripe session with `userId` metadata when authenticated.
2. Webhook events to process:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - optional: `invoice.payment_succeeded`, `invoice.payment_failed`
3. Keep `Subscription` row upserted by `stripeSubscriptionId`.

### Phase D: Entitlement Resolution

Implement `getEntitlementsFromSubscription(subscription, overrides)`:

1. Base map by plan/status.
2. Apply `Entitlement` overrides from DB.
3. Return canonical feature map.

Rules:

- `inactive/canceled/past_due` downgrade to free unless grace-window policy exists.
- `lifetime` stays active regardless of recurring status fields.

## 6. Desktop App Migration Plan

### Phase E: Replace License UX with Account UX

1. Settings modal tab `License` -> `Account`.
2. Support sign in/sign up/sign out flows against better-auth routes.
3. Persist session via httpOnly cookie; desktop renderer fetches account endpoints with `credentials: include`.

### Phase F: Gating Strategy

1. Remove direct license checks in renderer/electron and replace with entitlement checks.
2. Gate actions, not just visuals:
   - AI organize button
   - any premium batch tools
   - future OCR/analytics/cloud panels
3. Add consistent upgrade CTA when feature denied.

## 7. Feature Delivery Plan (Detailed)

## 7.1 Unlimited Screenshots

Backend:
1. Track screenshot count per user/workspace in local index metadata.
2. API returns limit policy (`maxScreenshots: number | null`).

Desktop:
1. Free plan enforces cap only on new imports/organize operations.
2. Already imported files remain visible.
3. Upgrade prompt appears when cap exceeded.

## 7.2 AI Organization

Backend:
1. Existing entitlement key `aiOrganization` controls access.
2. Add optional usage counters per billing period if needed.

Desktop:
1. Guard auto-organize action and AI recommendations.
2. Display disabled state + reason + upgrade path.

## 7.3 OCR Text Search

Backend/API:
1. Add local OCR indexing service (desktop side) with API surface for sync/status only.
2. Optional cloud enhancement later; initial v1 local-only.

Desktop:
1. Build per-item OCR text index (SQLite or local DB).
2. Full-text search route in app process.
3. Gate index generation and/or search scope by entitlement.

## 7.4 Cloud Backup

Backend/API:
1. Add provider abstraction (iCloud Drive, S3-compatible, etc.).
2. Add routes:
   - `GET /api/cloud/providers`
   - `POST /api/cloud/connections`
   - `POST /api/cloud/sync/start`
   - `GET /api/cloud/sync/status`

Desktop:
1. Sync job manager with retry/backoff.
2. Conflict policy (newest-wins + conflict copies).
3. Entitlement-gated settings UI.

## 7.5 Priority Support

Backend/API:
1. Add support request route + queue metadata:
   - `POST /api/support/tickets`
2. Auto-tag by entitlement.

Desktop/Web:
1. “Contact support” entry in settings/help.
2. Show priority badge only when entitlement true.

## 7.6 Advanced Analytics

Backend/API:
1. Define events schema: organize actions, source distributions, album growth.
2. Add aggregate endpoints:
   - `GET /api/analytics/overview`
   - `GET /api/analytics/sources`
   - `GET /api/analytics/albums`

Desktop:
1. Build analytics panel fed by aggregates.
2. Cache last response locally for instant load.

## 7.7 Tags + Smart Albums (requested)

Data model additions:
1. `Tag` (id, userId, name, color)
2. `MediaTag` (mediaId, tagId)
3. `SmartAlbum` (id, userId, name)
4. `SmartAlbumRule` (smartAlbumId, operator, field, value)

Rules examples:
1. include tags: `work OR invoice`
2. exclude tags: `NOT personal`
3. source filters: Desktop / Apple Photos
4. media type filters: image/video

API routes:
1. `GET/POST /api/tags`
2. `POST /api/media/:id/tags`
3. `GET/POST /api/smart-albums`
4. `POST /api/smart-albums/:id/evaluate`

Apple Photos translation strategy:
1. For standard albums: continue direct move/copy behavior.
2. For tags/smart albums:
   - Preferred: write keywords via PhotoKit when available.
   - Fallback: keep tags in MacZen local index only, do not force Apple Photos keyword sync.
3. UI should mark whether tag is “Local only” or “Synced to Photos”.

## 8. API Route Inventory (Target)

Auth:
1. `GET/POST /api/auth/[...all]`

Account + Entitlements:
1. `GET /api/account/me`
2. `GET /api/account/entitlements`

Billing:
1. `POST /api/checkout`
2. `POST /api/webhooks/stripe`
3. `GET /api/billing/status` (optional but recommended)

Media metadata domain:
1. `GET /api/media`
2. `POST /api/media/organize`
3. `POST /api/media/:id/reveal`
4. `POST /api/media/:id/move`

Tags + Smart Albums:
1. `GET/POST /api/tags`
2. `POST /api/media/:id/tags`
3. `GET/POST /api/smart-albums`
4. `POST /api/smart-albums/:id/evaluate`

Cloud:
1. `GET /api/cloud/providers`
2. `POST /api/cloud/connections`
3. `POST /api/cloud/sync/start`
4. `GET /api/cloud/sync/status`

Support:
1. `POST /api/support/tickets`

Analytics:
1. `GET /api/analytics/overview`
2. `GET /api/analytics/sources`
3. `GET /api/analytics/albums`

## 9. Migration Plan (License -> Account)

1. Keep license validation endpoints temporarily for backward compatibility.
2. On successful legacy license check, prompt user to create/sign-in account.
3. Backfill script:
   - map `License.email` to `User.email`
   - create `Subscription` rows from Stripe IDs where present
   - set entitlement overrides if needed
4. After migration window:
   - disable new license issuance
   - keep read-only lookup for support
   - remove desktop license activation UI

## 10. Testing Strategy

1. Unit tests:
   - entitlement resolver
   - subscription status mapping
   - smart album evaluator
2. Integration tests:
   - auth session + `/api/account/me`
   - checkout + webhook upsert lifecycle
3. Desktop E2E:
   - signed-out vs signed-in gating
   - plan downgrade behavior
   - tag + smart album drag/drop flows
4. Webhook replay tests from Stripe CLI fixtures.

## 11. Rollout Sequence

1. Milestone 1: auth routes + account UI + entitlement-gated AI organize.
2. Milestone 2: Stripe subscription normalization + migration tooling.
3. Milestone 3: tags + smart albums + album badges + drag/drop robustness.
4. Milestone 4: OCR search and analytics.
5. Milestone 5: cloud backup + support routing.
6. Milestone 6: remove license activation path.

## 12. Definition of Done

1. Desktop no longer depends on license code for feature access.
2. Entitlements are returned by `/api/account/me` and consistently enforced.
3. Stripe webhook state changes reflect in desktop without manual intervention.
4. Marketing/pricing copy only lists shipped capabilities for current plan.
5. Migration path exists for existing license users.
