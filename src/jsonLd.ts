// Pure schema.org JSON-LD builders shared between JWRG and JWLC. No deps, no
// I/O. Each returns a plain object ready to JSON.stringify into a
// <script type="application/ld+json"> block (see components/Seo.astro).
//
// Rule throughout: omit any field whose source is null/empty — never emit
// empty strings or null into the graph.

import type { ApiListing } from './api';

/**
 * Strip HTML tags, decode the entities a rich-text field actually emits, and
 * collapse whitespace; returns undefined when empty.
 *
 * Tags become a space so `<p>a</p><p>b</p>` doesn't weld into "ab" — which then
 * needs the space pulled back off before punctuation, or inline markup like
 * `…in <b>Wake Forest</b>.` serializes as "in Wake Forest ." into the graph.
 */
function plainText(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const text = s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
  return text || undefined;
}

/** Absolute listing image URLs, largest rung first, jpg preferred. */
function listingImages(listing: ApiListing): string[] {
  const photos = listing.photos ?? (listing.primary_photo ? [listing.primary_photo] : []);
  const urls: string[] = [];
  for (const p of photos) {
    const u = p.urls['1600']?.jpg ?? p.urls['1200']?.jpg ?? p.urls.original;
    if (u) urls.push(u);
  }
  return urls;
}

function availabilityFor(status: ApiListing['status']): string {
  switch (status) {
    case 'active':
    case 'coming_soon':
      return 'https://schema.org/InStock';
    case 'pending':
    case 'under_contract':
      return 'https://schema.org/LimitedAvailability';
    case 'sold':
      return 'https://schema.org/SoldOut';
  }
}

/** Numeric price string (no currency symbol/commas). Sold listings prefer sold_price. */
function priceFor(listing: ApiListing): string | undefined {
  const raw = listing.status === 'sold' ? listing.sold_price ?? listing.list_price : listing.list_price;
  if (!raw) return undefined;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return undefined;
  return String(Math.round(n));
}

function postalAddress(listing: ApiListing): Record<string, unknown> {
  const addr: Record<string, unknown> = { '@type': 'PostalAddress', addressCountry: 'US' };
  if (listing.address) addr.streetAddress = listing.address;
  if (listing.city) addr.addressLocality = listing.city;
  if (listing.state) addr.addressRegion = listing.state;
  if (listing.zip) addr.postalCode = listing.zip;
  return addr;
}

function geoFor(listing: ApiListing): Record<string, unknown> | undefined {
  if (listing.latitude == null || listing.longitude == null) return undefined;
  return { '@type': 'GeoCoordinates', latitude: listing.latitude, longitude: listing.longitude };
}

/**
 * schema.org RealEstateListing for a single listing detail page.
 *
 * Residential listings (those with `bedrooms`) nest a `SingleFamilyResidence`;
 * land listings (those with `lot_size_acres`) nest a `Place` carrying acreage
 * as an `additionalProperty`. `brokerName` is the brokerage display name
 * ("Julie Wright Realty Group" / "Julie Wright Land Company"). `siteUrl` is the
 * absolute origin for building the canonical listing + broker URLs.
 */
export function listingJsonLd(
  listing: ApiListing,
  siteUrl: string,
  brokerName: string,
): Record<string, unknown> {
  const base = siteUrl.replace(/\/$/, '');
  const images = listingImages(listing);

  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    url: `${base}/listings/${listing.slug}`,
    name: listing.marketing_title || listing.address,
  };

  if (listing.list_date) json.datePosted = listing.list_date;
  const desc = plainText(listing.full_description) ?? plainText(listing.description);
  if (desc) json.description = desc;
  if (images.length) json.image = images;

  const price = priceFor(listing);
  if (price) {
    json.offers = {
      '@type': 'Offer',
      price,
      priceCurrency: 'USD',
      availability: availabilityFor(listing.status),
    };
  }

  const geo = geoFor(listing);

  if (listing.bedrooms != null) {
    // Residential
    const about: Record<string, unknown> = {
      '@type': 'SingleFamilyResidence',
      numberOfBedrooms: listing.bedrooms,
    };
    const baths = (listing.bathrooms_full ?? 0) + (listing.bathrooms_half ?? 0) * 0.5;
    if (baths) about.numberOfBathroomsTotal = baths;
    if (listing.year_built != null) about.yearBuilt = listing.year_built;
    if (listing.sqft != null) {
      about.floorSize = { '@type': 'QuantitativeValue', value: listing.sqft, unitCode: 'FTK' };
    }
    about.address = postalAddress(listing);
    if (geo) about.geo = geo;
    json.about = about;
  } else if (listing.lot_size_acres != null) {
    // Land
    const about: Record<string, unknown> = {
      '@type': 'Place',
      name: listing.marketing_title || listing.address,
      address: postalAddress(listing),
    };
    if (geo) about.geo = geo;
    const acres = parseFloat(listing.lot_size_acres);
    if (!Number.isNaN(acres)) {
      about.additionalProperty = [
        { '@type': 'PropertyValue', name: 'Acreage', value: acres, unitCode: 'ACR' },
      ];
    }
    json.about = about;
  }

  json.broker = { '@type': 'RealEstateAgent', name: brokerName, url: base };

  return json;
}

/** Home › Listings › <listing> breadcrumb for a listing detail page. */
export function breadcrumbJsonLd(listing: ApiListing, siteUrl: string): Record<string, unknown> {
  const base = siteUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: 'Listings', item: `${base}/listings` },
      {
        '@type': 'ListItem',
        position: 3,
        name: listing.marketing_title || listing.address,
        item: `${base}/listings/${listing.slug}`,
      },
    ],
  };
}

export interface BrokerageInfo {
  /** Brokerage display name. */
  name: string;
  /** Production origin (no trailing slash needed). */
  url: string;
  /** NC firm license number, e.g. "C29156". */
  licenseNumber: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  /** Optional areas served (counties / region names). */
  areaServed?: string[];
  /** Optional E.164/display phone; omitted from output when absent. */
  telephone?: string;
}

/**
 * Sitewide Organization identity as a schema.org RealEstateAgent (a
 * LocalBusiness subtype). Emit exactly one per page from the layout.
 */
export function brokerageJsonLd(info: BrokerageInfo): Record<string, unknown> {
  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: info.name,
    url: info.url.replace(/\/$/, ''),
    address: {
      '@type': 'PostalAddress',
      streetAddress: info.street,
      addressLocality: info.city,
      addressRegion: info.region,
      postalCode: info.postalCode,
      addressCountry: 'US',
    },
    additionalProperty: {
      '@type': 'PropertyValue',
      name: 'NC Firm License',
      value: info.licenseNumber,
    },
  };
  if (info.telephone) json.telephone = info.telephone;
  if (info.areaServed?.length) json.areaServed = info.areaServed;
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// Neighborhood / community microsite builders
//
// The community sites (Aubrie Place, Preserve West, Tennyson, Yancey Farms)
// sell *lots*, not MLS listings, so they can't reuse listingJsonLd: their
// inventory comes from GET /neighborhoods/{slug}/lots, a much thinner shape
// than ApiListing (no photos, no beds/baths, no list_date). These builders take
// that shape instead.
//
// Deliberately absent: a hard-coded `offers.price`. The office lots endpoint
// does expose `base_price`, but as of 2026-08 not one lot across the four
// neighborhoods has it set — emitting an Offer with a null price is worse than
// emitting none. `price` is read whenever it's present, so populating
// base_price in the office lights it up with no change here.
// ─────────────────────────────────────────────────────────────────────────────

/** Lot status as the office reports it. `common_area` parcels aren't sellable. */
export type LotStatus =
  | 'available'
  | 'reserved'
  | 'under_contract'
  | 'sold'
  | 'common_area';

/**
 * Minimal lot shape these builders need. Each community site's own `Lot` type
 * satisfies it structurally, so lots can be passed straight through.
 */
export interface NeighborhoodLot {
  /** URL segment for the lot's detail page (usually the plat number). */
  id: string;
  /** Display label, usually the plat lot number. */
  number: string;
  status: LotStatus;
  acres?: number | null;
  /** Asking price, when the office has one. */
  price?: number | string | null;
  address?: string | null;
  builder?: { name?: string | null; short?: string | null } | null;
}

/**
 * Per-site constants. Define once in the site's config/data module and pass to
 * every builder so the community's identity stays consistent across pages.
 */
export interface NeighborhoodContext {
  /** Community display name, e.g. "Aubrie Place". */
  name: string;
  /** Production origin, e.g. "https://aubrieplace.jwrgnc.com". */
  url: string;
  /** Path prefix for lot detail pages. Defaults to "/lots". */
  lotsPath?: string;
  /** Noun for a single parcel — "Homesite" (default) or "Lot". */
  lotLabel?: string;
  /** Marketing description for the community node. */
  description?: string;
  city?: string;
  /** Two-letter state code, e.g. "NC". */
  region?: string;
  postalCode?: string;
}

const ctxBase = (ctx: NeighborhoodContext): string => ctx.url.replace(/\/$/, '');
const ctxLotsPath = (ctx: NeighborhoodContext): string => ctx.lotsPath ?? '/lots';
const ctxLotLabel = (ctx: NeighborhoodContext): string => ctx.lotLabel ?? 'Homesite';

/** True for parcels that are actually for sale (and so have a detail page). */
export function isSellableLot(lot: { status: LotStatus }): boolean {
  return lot.status !== 'common_area';
}

function lotAvailability(status: LotStatus): string | undefined {
  switch (status) {
    case 'available':
      return 'https://schema.org/InStock';
    case 'reserved':
    case 'under_contract':
      return 'https://schema.org/LimitedAvailability';
    case 'sold':
      return 'https://schema.org/SoldOut';
    case 'common_area':
      return undefined;
  }
}

/** Trim float noise off plat acreage (which carries up to 4 decimals). */
function roundAcres(acres: number): number {
  return Math.round(acres * 10000) / 10000;
}

/** Numeric price string (no symbol/commas), or undefined when there isn't one. */
function lotPrice(lot: NeighborhoodLot): string | undefined {
  if (lot.price == null || lot.price === '') return undefined;
  const n = typeof lot.price === 'number' ? lot.price : parseFloat(String(lot.price).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n) || n <= 0) return undefined;
  return String(Math.round(n));
}

/** Community-level PostalAddress; undefined when the site supplies no locality. */
function communityAddress(ctx: NeighborhoodContext): Record<string, unknown> | undefined {
  const addr: Record<string, unknown> = { '@type': 'PostalAddress', addressCountry: 'US' };
  let hasAny = false;
  if (ctx.city) { addr.addressLocality = ctx.city; hasAny = true; }
  if (ctx.region) { addr.addressRegion = ctx.region; hasAny = true; }
  if (ctx.postalCode) { addr.postalCode = ctx.postalCode; hasAny = true; }
  return hasAny ? addr : undefined;
}

/**
 * schema.org Place for the community itself — emit once on the home page.
 *
 * Pass `lots` to have it carry live inventory counts, which is what makes an
 * answer engine able to say "9 of 15 homesites are still available".
 */
export function neighborhoodJsonLd(
  ctx: NeighborhoodContext,
  lots?: NeighborhoodLot[],
): Record<string, unknown> {
  const label = ctxLotLabel(ctx).toLowerCase();
  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: ctx.name,
    url: ctxBase(ctx),
  };

  const desc = plainText(ctx.description);
  if (desc) json.description = desc;

  const address = communityAddress(ctx);
  if (address) json.address = address;

  if (lots?.length) {
    const sellable = lots.filter(isSellableLot);
    const props: Record<string, unknown>[] = [
      { '@type': 'PropertyValue', name: `Total ${label}s`, value: sellable.length },
      {
        '@type': 'PropertyValue',
        name: `Available ${label}s`,
        value: sellable.filter((l) => l.status === 'available').length,
      },
    ];

    const acreages = sellable
      .map((l) => l.acres)
      .filter((a): a is number => typeof a === 'number' && a > 0);
    if (acreages.length) {
      props.push({
        '@type': 'PropertyValue',
        name: `Smallest ${label}`,
        value: roundAcres(Math.min(...acreages)),
        unitCode: 'ACR',
      });
      props.push({
        '@type': 'PropertyValue',
        name: `Largest ${label}`,
        value: roundAcres(Math.max(...acreages)),
        unitCode: 'ACR',
      });
    }

    if (sellable.length) json.additionalProperty = props;
  }

  return json;
}

/**
 * schema.org RealEstateListing for one lot's detail page. Mirrors the land
 * shape used by listingJsonLd: a nested Place carrying acreage as an
 * `additionalProperty`, since a homesite has no beds/baths/floor area.
 */
export function lotJsonLd(
  lot: NeighborhoodLot,
  ctx: NeighborhoodContext,
): Record<string, unknown> {
  const base = ctxBase(ctx);
  const label = ctxLotLabel(ctx);
  const title = `${label} ${lot.number}`;

  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    url: `${base}${ctxLotsPath(ctx)}/${encodeURIComponent(lot.id)}`,
    name: `${title} — ${ctx.name}`,
  };

  const about: Record<string, unknown> = { '@type': 'Place', name: title };

  // A lot's own street address when the office has one (Preserve West does);
  // otherwise fall back to the community's locality so the parcel is still
  // geographically placed.
  const communityAddr = communityAddress(ctx);
  if (lot.address) {
    about.address = { ...(communityAddr ?? { '@type': 'PostalAddress', addressCountry: 'US' }), streetAddress: lot.address };
  } else if (communityAddr) {
    about.address = communityAddr;
  }

  const props: Record<string, unknown>[] = [];
  if (typeof lot.acres === 'number' && lot.acres > 0) {
    props.push({
      '@type': 'PropertyValue',
      name: 'Acreage',
      value: roundAcres(lot.acres),
      unitCode: 'ACR',
    });
  }
  const builderName = lot.builder?.name || lot.builder?.short;
  if (builderName) {
    props.push({ '@type': 'PropertyValue', name: 'Builder', value: builderName });
  }
  if (props.length) about.additionalProperty = props;

  json.about = about;

  const availability = lotAvailability(lot.status);
  if (availability) {
    const offer: Record<string, unknown> = { '@type': 'Offer', availability };
    const price = lotPrice(lot);
    if (price) {
      offer.price = price;
      offer.priceCurrency = 'USD';
    }
    json.offers = offer;
  }

  return json;
}

/**
 * schema.org ItemList for the lots index — hands a crawler the whole inventory
 * (and a link to each parcel) in a single node.
 */
export function lotListJsonLd(
  lots: NeighborhoodLot[],
  ctx: NeighborhoodContext,
): Record<string, unknown> {
  const base = ctxBase(ctx);
  const label = ctxLotLabel(ctx);
  const sellable = lots.filter(isSellableLot);

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${label}s at ${ctx.name}`,
    numberOfItems: sellable.length,
    itemListElement: sellable.map((lot, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${label} ${lot.number}`,
      url: `${base}${ctxLotsPath(ctx)}/${encodeURIComponent(lot.id)}`,
    })),
  };
}

/**
 * Generic BreadcrumbList from a trail of {name, path} steps. Unlike
 * `breadcrumbJsonLd` (which is bound to ApiListing), this works for any page.
 */
export function breadcrumbTrailJsonLd(
  trail: Array<{ name: string; path: string }>,
  siteUrl: string,
): Record<string, unknown> {
  const base = siteUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: `${base}${step.path}`,
    })),
  };
}
