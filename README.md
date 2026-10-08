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
  emits `data-parade-entry`, themed via `--parade-badge-bg`/`--parade-badge-fg`; an award winner gets the `parade-badge--gold|silver|bronze` medal colours from `--parade-award-*` and reads "Gold Award · Parade of Homes" — `paradeAwardLabel`/`paradeAwardClass` in `api.ts`). Cards accept an `index` prop so the first row loads eagerly.
- **Styles** — `styles/tokens.css` (brand palette; text steps meet WCAG AA) and
  `styles/components.css` (page/component classes; per-site chrome stays local).
- **JSON-LD** (`@jw/shared/jsonLd`) and the `lotMap` geometry types. Community/lot
  builders take coordinates (`NeighborhoodContext.latitude/longitude`, lot
  `latitude/longitude`) and emit `geo`, `hasMap` and `containedInPlace`.
- **Directions links** (`@jw/shared/maps` + `MapsLink.astro`) — `resolveMapTarget`
  picks the destination (own pin → real street address → community pin → own road
  text; never a text search on a community name), `lotMapTarget`/`communityMapTarget`
  (in `jsonLd`) wrap it for the community sites. `MapsLink` renders a Google Maps
  directions href and retargets it on-device to Apple Maps (iOS) or a `geo:` URI
  (Android → default nav app). `isStreetAddress` rejects placeholders like
  "0 Lawrence Rd" / "Cannady Mill Road" so they never become titles or `streetAddress`; corner-lot lines ("1412 Beckett Blvd / 3830 Joyce Row") use the first frontage (`primaryStreet`), and a lot always falls back to its community rather than a road search.

Consumed by pinning a GitHub tag: `"@jw/shared": "github:wrightster/jw-shared#vX.Y.Z"`.
Change code here → tag a release → bump each app's pin.
