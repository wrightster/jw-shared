// Pure schema.org JSON-LD builders shared between JWRG and JWLC. No deps, no
// I/O. Each returns a plain object ready to JSON.stringify into a
// <script type="application/ld+json"> block (see components/Seo.astro).
//
// Rule throughout: omit any field whose source is null/empty — never emit
// empty strings or null into the graph.

import type { ApiListing } from './api';

/** Strip HTML tags + collapse whitespace; returns undefined when empty. */
function plainText(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const text = s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
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
