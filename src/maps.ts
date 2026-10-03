// "Get directions" links for listings, lots and communities. Pure, no I/O.
//
// One resolver decides WHERE a link points, so every site agrees:
//   1. the parcel's own coordinates,
//   2. else its own street address — but only a real one (a house number that
//      isn't 0; "0 Beaver Dam Rd", "Cannady Mill Road", "(tract B) Brassfield
//      Road" or "12+ Acres East of Louisburg" can't be navigated to),
//   3. else the community's coordinates (lots with no address yet land at the
//      neighborhood instead of a road somewhere in the county),
//   4. else the parcel's own road/area text, if any. A community with no
//      coordinates yields no link rather than a guess.
//
// The href is always a Google Maps directions URL — it works everywhere,
// opens the Google Maps app on a phone that has it, and is what a crawler
// sees. `MapsLink.astro` then retargets it on the device: Apple Maps on
// iPhone/iPad, a `geo:` URI on Android (which opens the user's default
// navigation app or a chooser).

export interface MapsPlace {
  /** Street line as the office stores it, e.g. "3408 Tennyson Court". */
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface MapsCommunity extends MapsPlace {
  name: string;
}

export interface MapTarget {
  /** Human label for the destination (pin label on Android, link title). */
  label: string;
  lat?: number;
  lng?: number;
  /** Free-text destination, used when there are no coordinates. */
  query?: string;
  /**
   * How the destination was chosen. 'community' means the link points at the
   * neighborhood, not the parcel — say so in the link text.
   */
  precision: 'exact' | 'address' | 'community' | 'area';
}

const num = (v: number | string | null | undefined): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

function coords(p: MapsPlace | null | undefined): { lat: number; lng: number } | undefined {
  if (!p) return undefined;
  const lat = num(p.latitude);
  const lng = num(p.longitude);
  if (lat == null || lng == null || (lat === 0 && lng === 0)) return undefined;
  return { lat, lng };
}

/**
 * True for a street line a navigation app can resolve to a door: starts with
 * a non-zero house number followed by a street name. "3408 Tennyson Court",
 * "2002 Riddle Road #D" pass; "0 Lawrence Rd", "00 Purnell Road",
 * "Lot 23 Sail View Lane", "(tract C) Brassfield Road" don't.
 */
export function isStreetAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  return /^\s*[1-9]\d*[A-Za-z]?\s+[A-Za-z]/.test(address);
}

/**
 * First frontage of a multi-frontage line: corner lots are stored as
 * "1412 Beckett Blvd / 3830 Joyce Row"; navigation and `streetAddress` take
 * the first one.
 */
export function primaryStreet(address: string | null | undefined): string | null {
  if (!address) return null;
  return address.split(/\s+\/\s+|\s*;\s*/)[0]!.trim() || null;
}

/** "City, ST 27587" — whichever parts exist. */
export function localityLine(p: MapsPlace): string {
  const stZip = [p.state, p.zip].filter(Boolean).join(' ');
  return [p.city, stZip].filter(Boolean).join(', ');
}

/** "3408 Tennyson Court, Wake Forest, NC 27587" — whichever parts exist. */
export function fullAddress(p: MapsPlace): string {
  return [p.address?.trim(), localityLine(p)].filter(Boolean).join(', ');
}

/**
 * Pick the destination for a parcel (listing or lot), falling back to its
 * community. Pass only `community` for a neighborhood-level link. Returns null
 * when there is nothing worth linking to.
 */
export function resolveMapTarget(
  place: MapsPlace | null | undefined,
  community?: MapsCommunity | null,
  label?: string,
): MapTarget | null {
  const own = coords(place);
  const first = primaryStreet(place?.address);
  const street = place && isStreetAddress(first) ? fullAddress({ ...place, address: first }) : undefined;
  // Placeholder lines are tidied before they label a link or seed a search.
  const road = place && !street && place.address ? cleanRoad(place.address) : '';
  const roadLine = road ? fullAddress({ ...place, address: road }) : '';
  const name = label || street || roadLine || community?.name || '';

  if (own) return { label: name, ...own, precision: 'exact' };
  if (street) return { label: name, query: street, precision: 'address' };

  const hood = coords(community);
  if (hood && community) {
    return { label: label || community.name, ...hood, precision: 'community' };
  }
  // A community with a real entrance address but no pin yet.
  if (community && isStreetAddress(community.address)) {
    return { label: label || community.name, query: fullAddress(community), precision: 'community' };
  }

  // Last resort: road or area text ("Brassfield Road, Creedmoor, NC 27522").
  const area = roadLine;
  // Never a text search on the community NAME: "Maxton, Louisburg, NC" can
  // resolve to the town of Maxton two hours away. No coordinates, no link.
  // Only when the line names a road ("Brassfield Road", "NC Hwy 42") — a
  // description like "12+ Acres East of Louisburg" just drops a pin in town.
  if (area && hasRoadName(road)) return { label: name || area, query: area, precision: 'area' };
  return null;
}

const ROAD = /\b(road|rd|street|st|lane|ln|drive|dr|court|ct|trail|trl|way|avenue|ave|highway|hwy|parkway|pkwy|place|pl|circle|cir|boulevard|blvd|run|trace|loop|pike)\b\.?/i;

/** "0 Lawrence Rd" → "Lawrence Rd"; "(tract B) Brassfield Road" → "Brassfield Road". */
export function cleanRoad(address: string): string {
  return address.replace(/\([^)]*\)/g, ' ').replace(/^\s*0+\s+/, '').replace(/\s+/g, ' ').trim();
}

/** True when an address line names a road, even without a house number. */
export function hasRoadName(address: string | null | undefined): boolean {
  return !!address && ROAD.test(address);
}

const dest = (t: MapTarget): string => (t.lat != null && t.lng != null ? `${t.lat},${t.lng}` : (t.query ?? ''));

/** Google Maps directions — universal URL (web, Android and iOS app). */
export function googleDirectionsUrl(t: MapTarget): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest(t))}`;
}

/** Apple Maps directions — opens Maps on iPhone/iPad/Mac. */
export function appleDirectionsUrl(t: MapTarget): string {
  const q = t.lat != null ? `&q=${encodeURIComponent(t.label)}` : '';
  return `https://maps.apple.com/?daddr=${encodeURIComponent(dest(t))}${q}`;
}

/** geo: URI — Android hands it to the default navigation app. */
export function geoUri(t: MapTarget): string {
  if (t.lat != null && t.lng != null) {
    const label = t.label.replace(/[()]/g, '');
    return `geo:${t.lat},${t.lng}?q=${t.lat},${t.lng}(${encodeURIComponent(label)})`;
  }
  return `geo:0,0?q=${encodeURIComponent(t.query ?? '')}`;
}

/** Map URL for schema.org `hasMap`. */
export function mapUrl(t: MapTarget): string {
  return t.lat != null && t.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.query ?? '')}`;
}
