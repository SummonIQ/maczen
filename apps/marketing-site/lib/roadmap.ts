export type RoadmapPhase = "now" | "next" | "later";
export type RoadmapStatus = "building" | "up-next" | "planned";

export type RoadmapDefinition = {
  slug: string;
  title: string;
  phase: RoadmapPhase;
  status: RoadmapStatus;
  summary: string;
  detail: string;
  value: string;
  order: number;
  bullets: string[];
};

export const ROADMAP_ITEMS: RoadmapDefinition[] = [
  {
    slug: "ocr-semantic-indexing",
    title: "OCR and semantic indexing",
    phase: "now",
    status: "building",
    summary:
      "Make every screenshot readable, searchable, and indexable so the library becomes useful without manual tagging.",
    detail:
      "This is the foundation for search quality. It covers OCR accuracy, indexing reliability, per-item reprocessing, and the metadata needed for future semantic retrieval.",
    value: "Turns MacZen from a folder browser into a real retrieval tool.",
    order: 1,
    bullets: [
      "Higher OCR accuracy for dense UI screenshots",
      "Reliable indexing health and reprocessing controls",
      "Metadata pipeline ready for future embeddings and summaries",
    ],
  },
  {
    slug: "ai-search",
    title: "AI search over screenshot contents",
    phase: "now",
    status: "building",
    summary:
      "Search by what is inside the capture, not just by filename or folder.",
    detail:
      "The near-term focus is stronger OCR-backed retrieval, result reasoning, and ranking that surfaces the right screenshot faster. Longer term this expands into semantic search.",
    value: "The clearest paid-user value: saving time on every retrieval.",
    order: 2,
    bullets: [
      "Better ranking for OCR matches",
      "Result explanations and match highlighting",
      "Foundation for intent-based search like error, invoice, receipt, or client work",
    ],
  },
  {
    slug: "smart-collections",
    title: "Smart collections",
    phase: "now",
    status: "up-next",
    summary:
      "Auto-group captures into useful collections like receipts, bug reports, research, or client work.",
    detail:
      "Collections will be driven by source app, album rules, OCR signals, and future semantic classifiers so users can browse by intent instead of location.",
    value: "Gives paid users immediate order without requiring manual filing.",
    order: 3,
    bullets: [
      "Saved collections with live counts",
      "Automatic grouping by app, project, or content type",
      "Collections that stay fresh as new captures arrive",
    ],
  },
  {
    slug: "rules-engine",
    title: "Rules engine",
    phase: "now",
    status: "planned",
    summary:
      "Let users automate sorting decisions with durable rules instead of repetitive manual cleanup.",
    detail:
      "Rules are the control layer for power users: app-based routing, keyword matches, album assignment, and future automation hooks.",
    value: "Makes MacZen feel powerful, sticky, and worth paying for long-term.",
    order: 4,
    bullets: [
      "If-this-then-that style automation",
      "Reusable conditions based on source, album, OCR text, and media type",
      "Safe review flow before bulk actions",
    ],
  },
  {
    slug: "continuous-organization-agent",
    title: "Continuous organization agent",
    phase: "now",
    status: "planned",
    summary:
      "Keep watching incoming media, suggest organization continuously, and run approved rules automatically.",
    detail:
      "This is the background orchestration layer. It decides when to scan, when to run rules, when to ask for review, and when to keep out of the way.",
    value: "Transforms MacZen from a cleanup tool into an always-on assistant.",
    order: 5,
    bullets: [
      "Observe mode first, then assist mode, then full automation",
      "Battery- and CPU-aware background operation",
      "Trust-building review queues before autonomous actions",
    ],
  },
  {
    slug: "smart-summaries",
    title: "Smart summaries and extraction",
    phase: "next",
    status: "planned",
    summary:
      "Summarize groups of screenshots, extract action items, and pull useful text into cleaner notes.",
    detail:
      "This expands MacZen from retrieval into understanding. It should help users turn screenshot piles into usable output.",
    value: "Strong premium value for research, meetings, bug triage, and admin workflows.",
    order: 6,
    bullets: [
      "Summaries for albums and selected groups",
      "Action-item extraction from captured workflows",
      "Export-ready structured notes",
    ],
  },
  {
    slug: "duplicate-cleanup",
    title: "Duplicate and near-duplicate cleanup",
    phase: "next",
    status: "planned",
    summary:
      "Find repeated captures, burst screenshots, and low-value near-duplicates before they pile up.",
    detail:
      "The goal is not aggressive deletion. It is high-confidence cleanup suggestions that reduce clutter without making users nervous.",
    value: "Immediate storage and attention savings for heavy screenshot users.",
    order: 7,
    bullets: [
      "Similarity detection for nearly identical captures",
      "Best-shot suggestions instead of blind deletion",
      "Batch review tools for cleanup sessions",
    ],
  },
  {
    slug: "notes-layer",
    title: "Notes layer on screenshots",
    phase: "next",
    status: "planned",
    summary:
      "Let users leave quick notes, tags, and reminders on top of important captures.",
    detail:
      "Notes turn screenshots into knowledge objects. This is particularly valuable for research, debugging, design critique, and client communication.",
    value: "Makes MacZen a place to work from, not just a place to store things.",
    order: 8,
    bullets: [
      "Inline annotations and lightweight notes",
      "Tagging that improves retrieval later",
      "Context that survives exports and collections",
    ],
  },
  {
    slug: "export-integrations",
    title: "Export and integrations",
    phase: "next",
    status: "planned",
    summary:
      "Push cleaned-up captures and extracted context into the rest of the user’s workflow.",
    detail:
      "Exports should cover simple bundles first, then tools like Notes, Notion, and Markdown-based workflows.",
    value: "Keeps MacZen central without trapping user data.",
    order: 9,
    bullets: [
      "Export albums as bundles or contact sheets",
      "Structured text export for notes apps",
      "Integration hooks for downstream workflows",
    ],
  },
  {
    slug: "use-case-templates",
    title: "Use-case templates",
    phase: "next",
    status: "planned",
    summary:
      "Offer opinionated starting points for research, receipts, bug reports, inspiration, and more.",
    detail:
      "Templates package rules, collections, labels, and review flows for specific jobs-to-be-done instead of forcing users to build everything from scratch.",
    value: "Makes the product easier to understand and faster to adopt.",
    order: 10,
    bullets: [
      "Prebuilt workflows for common screenshot-heavy tasks",
      "Opinionated defaults that can still be customized",
      "Lower setup friction for new paid users",
    ],
  },
  {
    slug: "cross-device-sync",
    title: "Cross-device sync",
    phase: "later",
    status: "planned",
    summary:
      "Sync collections, metadata, notes, and eventually media across Macs.",
    detail:
      "Sync adds a real moat, but only after the local experience and data model are trustworthy. It should start with metadata before expanding further.",
    value: "High retention feature for serious users with multiple Macs.",
    order: 11,
    bullets: [
      "Metadata sync first",
      "Conflict-safe merges for notes, votes, and organization state",
      "Future path toward original media sync",
    ],
  },
  {
    slug: "all-files-expansion",
    title: "Expansion beyond screenshots into all files",
    phase: "later",
    status: "planned",
    summary:
      "Expand MacZen from screenshot organization into a broader file-intelligence layer for documents, images, downloads, and mixed media.",
    detail:
      "The long-term direction is not just screenshot management. It is a system that can classify, search, summarize, and route more of the files users actually work with every day.",
    value: "Opens a much larger product surface and a clearer long-term moat.",
    order: 12,
    bullets: [
      "Support for documents, downloads, PDFs, and mixed file libraries",
      "Shared search and organization primitives across more file types",
      "A path from screenshot utility to broader personal-file intelligence",
    ],
  },
  {
    slug: "personal-storage-device",
    title: "Personal storage device users physically keep",
    phase: "later",
    status: "planned",
    summary:
      "Explore a user-owned storage path that reduces dependence on iCloud or subscription-based cloud storage for preserving a person’s digital life.",
    detail:
      "This would investigate a modest-budget hardware direction for durable personal storage that remains in the user’s possession. The exploration can include optical, prism-inspired, or other advanced-but-reasonably-explorable storage concepts rather than assuming a cloud-first future.",
    value:
      "Creates a path toward long-term digital ownership where missed payments or policy changes are less likely to put a person’s archive at risk.",
    order: 13,
    bullets: [
      "Research practical user-owned storage hardware directions",
      "Explore advanced but realistic media approaches beyond standard cloud sync",
      "Design for archival ownership, portability, and resilience against service lock-in",
    ],
  },
];

export const ROADMAP_BY_SLUG = new Map(
  ROADMAP_ITEMS.map((item) => [item.slug, item]),
);

export const ROADMAP_PHASES: Array<{
  key: RoadmapPhase;
  label: string;
  eyebrow: string;
}> = [
  { key: "now", label: "Now", eyebrow: "Shipping focus" },
  { key: "next", label: "Next", eyebrow: "Queued after the foundation" },
  { key: "later", label: "Later", eyebrow: "Big leverage, lower immediacy" },
];
