# MacZen Desktop App Plan: Use-Case Collections And Templates

## 1. Summary

MacZen should ship opinionated templates for common screenshot-heavy workflows so new users can get value immediately without designing their own albums, rules, tags, smart collections, and summary prompts from scratch. Templates make the product feel concrete instead of abstract.

This is especially important for paid conversion because many users understand outcomes better than platform primitives.

## 2. Template Strategy

A template should be a packaged workflow configuration made up of:

1. suggested albums or smart collections
2. starter tags
3. optional rules
4. suggested summary modes
5. optional export destinations
6. small instruction copy explaining how to use it

## 3. Initial Template Packs

1. `Design Inspiration`
2. `Bug Reports`
3. `Receipts And Expenses`
4. `Research And Competitor Tracking`
5. `Tutorials And References`
6. `Job Applications`
7. `Sales Proof And Testimonials`

## 4. Goals

1. Reduce time-to-value for new users.
2. Showcase advanced MacZen capabilities without requiring discovery.
3. Improve upgrade conversion by making paid features understandable through practical workflows.
4. Establish a reusable configuration system for future marketplace or team packs.

## 5. Non-Goals

1. Building a public template marketplace in v1.
2. Creating deeply vertical templates for niche industries before core workflows are solid.
3. Making templates irreversible black boxes.

## 6. Requirements

### Functional Requirements

1. Users must be able to browse, preview, install, and remove templates.
2. Template install should create a clean, reviewable set of assets.
3. Users must be able to modify installed template assets afterward.
4. Templates must declare dependencies on features such as rules, summaries, smart collections, or export integrations.
5. Paid-only capabilities should be clearly labeled in template previews.

### Non-Functional Requirements

1. Template installation must be idempotent.
2. Templates must be versioned so updates are manageable.
3. Removing a template should not unexpectedly delete user-edited content without review.

## 7. Template Examples

### Design Inspiration

1. Smart collections for `Landing Pages`, `Typography`, `Pricing`, `Onboarding`
2. Tags: `layout`, `motion`, `copy`, `color`
3. Summary preset: `Extract recurring UI patterns`
4. Export preset: Markdown mood board

### Bug Reports

1. Albums or collections for `Needs Triage`, `Repro Steps`, `Resolved`
2. Rules tagging screenshots with visible errors
3. Summary preset: `Draft bug report`
4. Export preset: issue-ready Markdown with attachments list

### Receipts And Expenses

1. Smart collections for `Unreviewed`, `This Month`, `Needs Category`
2. OCR extraction for merchant, amount, date
3. Export preset: CSV or finance-ready summary

## 8. Architecture

Templates should be stored as declarative manifests. Suggested manifest structure:

```json
{
  "id": "bug-reports",
  "version": 1,
  "name": "Bug Reports",
  "requires": ["notes", "rules", "summaries"],
  "assets": {
    "tags": [],
    "smartCollections": [],
    "rules": [],
    "summaryPresets": []
  }
}
```

## 9. Implementation Plan

### Phase 1: Static Template Manifests

1. Build manifest format.
2. Ship 3 to 4 core templates.
3. Add install preview and removal flow.
4. Track template-origin metadata on created assets.

### Phase 2: Adaptive Templates

1. Recommend templates based on observed usage.
2. Auto-map template assets to existing albums/tags where appropriate.
3. Suggest Pro upgrade when a template's advanced capabilities are gated.

### Phase 3: Template Ecosystem

1. Add update paths for template revisions.
2. Consider team-shared internal templates.
3. Consider partner or curated template packs later.

## 10. Monetization Fit

- Free: a couple of starter templates using core organization only
- Pro: advanced templates using rules, AI summaries, OCR extraction, exports, and sync

## 11. Metrics

1. Template install rate.
2. Time from install to first meaningful action.
3. Retention uplift by template type.
4. Upgrade conversion after interacting with Pro-gated template capabilities.

## 12. Risks

1. Templates that are too generic will feel like marketing filler.
2. Templates that are too rigid will break existing setups.
3. Excessive template sprawl can distract from the core product.

## 13. Open Questions

1. Should templates be introduced during onboarding or only later?
2. Should template assets live in separate namespaces to simplify removal?
3. Which two or three templates best match MacZen's current user base at launch?
