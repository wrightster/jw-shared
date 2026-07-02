// Canonical client for office.jwrgnc.com/api/v1, shared between JWRG and JWLC.
//
// JWLC is the reference. Fetchers take an explicit `site` argument so each
// app's local `src/lib/api.ts` binds its own slug ('jwrg' | 'jwlc') and
// re-exports the bound versions. Helpers that don't need a site (formatters,
// type guards, `normalizeListingLabel`, neighborhood / listing detail
// fetchers) are pure and used as-is.

export const BASE_URL = 'https://office.jwrgnc.com/api/v1';

// ---------- Photos ----------

export interface ApiPhotoVariant {
  width: number | null;
  height: number | null;
  jpg: string | null;
  webp: string | null;
  avif: string | null;
}

export interface ApiPhoto {
  id: string;
  order: number;
  caption: string | null;
  alt: string | null;
  is_primary: boolean;
  urls: {
    '400': ApiPhotoVariant;
    '800': ApiPhotoVariant;
    '1200': ApiPhotoVariant;
    '1600': ApiPhotoVariant;
    original: string | null;
  };
}

/**
 * Pick a single jpg URL for a photo at a target width rung.
 * Falls back to `original` if the requested rung hasn't rendered yet
 * (conversions queue async on the office side; URLs may briefly be null).
 */
export function photoSrc(
  photo: ApiPhoto | null | undefined,
  width: 400 | 800 | 1200 | 1600 = 800,
): string | null {
  if (!photo) return null;
  const variant = photo.urls[String(width) as '400' | '800' | '1200' | '1600'];
  return variant?.jpg ?? photo.urls.original;
}

const PHOTO_RUNGS: ('400' | '800' | '1200' | '1600')[] = ['400', '800', '1200', '1600'];

/**
 * Build a `srcset` string for one format across whichever width rungs have
 * rendered. Returns null when no rung carries that format yet (e.g. avif not
 * generated), so callers can omit the `<source>`.
 */
export function photoSrcSet(
  photo: ApiPhoto | null | undefined,
  format: 'jpg' | 'webp' | 'avif',
): string | null {
  if (!photo) return null;
  const parts: string[] = [];
  for (const rung of PHOTO_RUNGS) {
    const variant = photo.urls[rung];
    const url = variant?.[format];
    if (url && variant.width) parts.push(`${url} ${variant.width}w`);
  }
  return parts.length ? parts.join(', ') : null;
}

/**
 * Intrinsic dimensions for a photo at a target rung, for `width`/`height`
 * attributes that prevent layout shift. Falls back across rungs if the
 * requested one hasn't rendered dimensions yet.
 */
export function photoDimensions(
  photo: ApiPhoto | null | undefined,
  width: 400 | 800 | 1200 | 1600 = 800,
): { width: number; height: number } | null {
  if (!photo) return null;
  const order = [String(width), ...PHOTO_RUNGS.filter((r) => r !== String(width))] as (
    | '400'
    | '800'
    | '1200'
    | '1600'
  )[];
  for (const rung of order) {
    const variant = photo.urls[rung];
    if (variant?.width && variant.height) {
      return { width: variant.width, height: variant.height };
    }
  }
  return null;
}

/**
 * Descriptive alt text for a listing photo: explicit alt → caption → a composed
 * "<address> — photo" string. Never the page/listing title.
 */
export function photoAlt(photo: ApiPhoto | null | undefined, address: string): string {
  return photo?.alt || photo?.caption || `${address} — photo`;
}

// ---------- Documents ----------

export interface ApiDocument {
  id: string;
  title: string;
  description: string | null;
  document_type: string;
  sort_order: number;
  is_public: boolean;
  /** Entity the doc is attached to. Listing detail merges in neighborhood docs
   *  flagged share_with_listings — those arrive with source 'neighborhood'. */
  source: 'listing' | 'neighborhood' | 'contact' | 'transaction' | 'campaign' | null;
  url: string | null;
  expires_at: string | null;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  contract: 'Contract',
  addendum: 'Addendum',
  disclosure: 'Disclosure',
  inspection_report: 'Inspection Report',
  appraisal: 'Appraisal',
  title_report: 'Title Report',
  survey: 'Survey',
  plat: 'Plat',
  hoa_docs: 'HOA Docs',
  tax_record: 'Tax Record',
  insurance: 'Insurance',
  license: 'License',
  marketing: 'Marketing',
  photo: 'Photo',
  correspondence: 'Correspondence',
  other: 'Other',
};

export function documentTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Document';
  return (
    DOCUMENT_TYPE_LABELS[type] ??
    type
      .split('_')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ')
  );
}

// ---------- Listings ----------

export interface ApiListing {
  id: string;
  slug: string;
  mls_number: string | null;
  marketing_title: string | null;
  status: 'active' | 'coming_soon' | 'pending' | 'under_contract' | 'sold';
  status_label: string;
  featured: boolean;
  property_type: string | null;
  listing_type: string | null;
  address: string;
  address_line_2: string | null;
  city: string;
  state: string;
  zip: string | null;
  county: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: { id: string; name: string; slug: string } | null;
  list_price: string;
  original_price: string | null;
  sold_price: string | null;
  bedrooms: number | null;
  bathrooms_full: number | null;
  bathrooms_half: number | null;
  sqft: number | null;
  lot_size_sqft: number | null;
  lot_size_acres: string | null;
  year_built: number | null;
  garage_spaces: number | null;
  stories: number | null;
  hoa_fee: string | null;
  hoa_frequency: string | null;
  description: string;
  full_description: string | null;
  directions: string | null;
  features: string[];
  virtual_tour_url: string | null;
  list_date: string | null;
  sold_date: string | null;
  days_on_market: number | null;
  agent: { name: string; phone: string } | null;
  co_agent: { name: string; phone: string } | null;
  primary_photo: ApiPhoto | null;
  photo_count: number;
  // Detail-only
  photos?: ApiPhoto[];
  documents?: ApiDocument[];
  videos?: ApiVideo[];
}

export interface ApiVideo {
  id: string;
  source: 'embed' | 'upload';
  provider: string | null;
  title: string | null;
  caption: string | null;
  type: string | null;
  sort_order: number;
  is_public: boolean;
  /** Embed player URL (source=embed). */
  embed_url: string | null;
  /** Hosted file URL (source=upload). */
  file_url: string | null;
  /** Whichever of embed_url / file_url applies — what the player loads. */
  playback_url: string | null;
  /** Poster image; null for non-YouTube — fall back to the listing primary photo. */
  thumbnail_url: string | null;
  created_at: string | null;
}

export type PublicStatus = 'available' | 'pending' | 'sold';

export function publicStatus(status: ApiListing['status']): PublicStatus {
  switch (status) {
    case 'active':
    case 'coming_soon':
      return 'available';
    case 'pending':
    case 'under_contract':
      return 'pending';
    case 'sold':
      return 'sold';
  }
}

/**
 * JWLC's label rewrite: surface 'active' listings as "Available" instead of
 * "Active". Opt-in — each site's shim decides whether to apply it.
 */
export function normalizeListingLabel(listing: ApiListing): ApiListing {
  if (listing.status === 'active') return { ...listing, status_label: 'Available' };
  return listing;
}

// ---------- Formatters ----------

export function formatPrice(price: string | null | undefined): string {
  if (!price) return '—';
  const n = parseFloat(price);
  if (Number.isNaN(n)) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function formatAcres(acres: string | null): string {
  if (!acres) return '';
  const n = parseFloat(acres);
  if (Number.isNaN(n)) return '';
  return (n % 1 === 0 ? n.toFixed(0) : n.toString()) + ' ac';
}

export function formatSqft(sqft: number | null): string {
  if (!sqft) return '';
  return sqft.toLocaleString('en-US') + ' sqft';
}

export function formatBedsBaths(l: ApiListing): string {
  const parts: string[] = [];
  if (l.bedrooms) parts.push(`${l.bedrooms} bd`);
  const baths = (l.bathrooms_full ?? 0) + (l.bathrooms_half ?? 0) * 0.5;
  if (baths) parts.push(`${baths} ba`);
  return parts.join(' · ');
}

// ---------- In-process response memo ----------
//
// SSR renders hit these endpoints on every request; the Node server process is
// long-lived, so a tiny TTL memo keyed by URL turns repeated identical fetches
// (hot listings, the team list, homepage) into in-memory reads and shields the
// office from bursts. The office also caches server-side; this just avoids the
// round trip. Short TTL keeps it fresh; entries expire lazily.

const MEMO_TTL_MS = 60_000;
const MEMO_MAX_ENTRIES = 500;

interface MemoEntry {
  at: number;
  data: unknown;
}

const _memo = new Map<string, MemoEntry>();

/**
 * Fetch + parse JSON with a short in-process memo. Throws on a non-OK response
 * (so callers' existing try/catch fall back to []/null and nothing is cached).
 */
async function cachedJson(url: string, ttlMs = MEMO_TTL_MS): Promise<any> {
  const now = Date.now();
  const hit = _memo.get(url);
  if (hit && now - hit.at < ttlMs) return hit.data;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const json = await res.json();

  if (_memo.size >= MEMO_MAX_ENTRIES) _memo.clear();
  _memo.set(url, { at: now, data: json });
  return json;
}

// ---------- Listing fetchers ----------

export interface ListingsQuery {
  featured?: boolean;
  county?: string;
  city?: string;
  /** Neighborhood slug or UUID — restricts to listings in that community. */
  neighborhood?: string;
  status?: ApiListing['status'];
  perPage?: number;
}

function buildListingsUrl(site: string, q: ListingsQuery, page?: number): string {
  const params = new URLSearchParams();
  params.set('site', site);
  params.set('per_page', String(q.perPage ?? 50));
  if (q.featured) params.set('featured', '1');
  if (q.county) params.set('county', q.county);
  if (q.city) params.set('city', q.city);
  if (q.neighborhood) params.set('neighborhood', q.neighborhood);
  if (q.status) params.set('status', q.status);
  if (page) params.set('page', String(page));
  return `${BASE_URL}/listings?${params}`;
}

export async function fetchListings(
  site: string,
  q: ListingsQuery = {},
): Promise<ApiListing[]> {
  try {
    const json = await cachedJson(buildListingsUrl(site, q));
    return (json.data ?? []) as ApiListing[];
  } catch {
    return [];
  }
}

/**
 * Walk every page of listings for a site. Use sparingly — the listings index
 * page wants this; the homepage wants `fetchListings({ perPage: 6 })`.
 */
export async function fetchAllListings(
  site: string,
  q: ListingsQuery = {},
): Promise<ApiListing[]> {
  try {
    const firstJson = await cachedJson(buildListingsUrl(site, q, 1));
    const all: ApiListing[] = [...(firstJson.data ?? [])];
    const lastPage: number = firstJson.meta?.last_page ?? 1;
    if (lastPage > 1) {
      const rest = await Promise.all(
        Array.from({ length: lastPage - 1 }, (_, i) => i + 2).map(async (page) => {
          try {
            return ((await cachedJson(buildListingsUrl(site, q, page))).data ?? []) as ApiListing[];
          } catch {
            return [];
          }
        }),
      );
      all.push(...rest.flat());
    }
    return all;
  } catch {
    return [];
  }
}

export async function fetchListing(slug: string): Promise<ApiListing | null> {
  try {
    const json = await cachedJson(`${BASE_URL}/listings/${slug}`);
    return json.data as ApiListing;
  } catch {
    return null;
  }
}

// ---------- Neighborhoods ----------

export interface ApiNeighborhood {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  marketing_description: string | null;
  status: 'planning' | 'under_development' | 'active_sales' | 'sold_out' | 'established' | null;

  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;

  total_lots: number | null;
  total_phases: number | null;

  hoa: {
    name: string | null;
    fee: number | null;
    frequency: 'monthly' | 'quarterly' | 'annually' | null;
    contact: string | null;
  };

  amenities: string[];
  school_district: string | null;
  utilities: string[];
  deed_restrictions_summary: string | null;
  website_url: string | null;

  primary_photo: ApiPhoto | null;
  photos?: ApiPhoto[];
  photo_count?: number;
  listings_count?: number;
  documents?: ApiDocument[];
}

export async function fetchNeighborhoods(): Promise<ApiNeighborhood[]> {
  try {
    const json = await cachedJson(`${BASE_URL}/neighborhoods?per_page=100`);
    return (json.data ?? []) as ApiNeighborhood[];
  } catch {
    return [];
  }
}

export async function fetchNeighborhood(slug: string): Promise<ApiNeighborhood | null> {
  try {
    const json = await cachedJson(`${BASE_URL}/neighborhoods/${slug}`);
    return json.data as ApiNeighborhood;
  } catch {
    return null;
  }
}

// ---------- Team ----------

export interface ApiTeamMember {
  id: number;
  slug: string;
  name: string;
  title: string | null;
  short_bio: string | null;
  bio: string | null;

  public_email: string | null;
  public_phone: string | null;

  license_number: string | null;
  license_state: string | null;
  license_expiry: string | null;

  specialties: string[];
  social_links: Record<string, string>;
  years_experience: number | null;

  sort_order: number | null;
  published_at: string | null;

  primary_photo: ApiPhoto | null;
  photos?: ApiPhoto[];
  photo_count?: number;
  marketing_sites?: string[];
}

export async function fetchTeam(site: string): Promise<ApiTeamMember[]> {
  try {
    const json = await cachedJson(`${BASE_URL}/team?site=${site}&per_page=100`);
    return (json.data ?? []) as ApiTeamMember[];
  } catch {
    return [];
  }
}

export async function fetchTeamMember(
  slug: string,
  site: string,
): Promise<ApiTeamMember | null> {
  try {
    const json = await cachedJson(`${BASE_URL}/team/${slug}?site=${site}`);
    return json.data as ApiTeamMember;
  } catch {
    return null;
  }
}
