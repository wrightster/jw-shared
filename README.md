# @jw/shared

Canonical code shared between the JWRG and JWLC Astro sites.

Edit files here, not in the apps. Each app's `src/lib/api.ts` is a thin shim
that re-exports from `@jw/shared/api` and binds the site slug.

JWLC is the reference: when a pattern exists in both sites and they differ,
the shared version mirrors JWLC's shape. See `../../CLAUDE.md` and
`../../SHARED_FRONTEND_GUIDE.md` for the contract.

## Provides

- **API client + types** (`@jw/shared/api`) — `fetchListings`/`fetchListing`/
  `fetchTeam`/`fetchNeighborhoods`/`fetchParade` (+ `?parade=` on listings), the `ApiListing`/`ApiPhoto`/`ApiDocument`
  types, image/format helpers, and a short in-process response memo.
- **Components** — `ListingCard`, `ListingRow`, `ListingGallery`, `VideoSection`,
  `LotMap`, `Seo`, `ParadeBadge` (shown on cards/rows when `listing.parade` is set;
  emits `data-parade-entry`, themed via `--parade-badge-bg`/`--parade-badge-fg`). Cards accept an `index` prop so the first row loads eagerly.
- **Styles** — `styles/tokens.css` (brand palette; text steps meet WCAG AA) and
  `styles/components.css` (page/component classes; per-site chrome stays local).
- **JSON-LD** (`@jw/shared/jsonLd`) and the `lotMap` geometry types.

Consumed by pinning a GitHub tag: `"@jw/shared": "github:wrightster/jw-shared#vX.Y.Z"`.
Change code here → tag a release → bump each app's pin.
