// ─────────────────────────────────────────────────────────────────────────────
// @jw/shared/lotMap — types for the LotMap component
//
// The "simple map" tier: a rendered site-plan image with clickable, status-
// colored lot hotspots overlaid on top. Geometry (WHERE each lot sits) is a
// static per-site map authored against the site-plan image; the lot data (WHAT
// each lot is — status, acreage, builder) is passed in, typically from the
// office API. See LotMap.astro.
// ─────────────────────────────────────────────────────────────────────────────

/** A hotspot rectangle in the SITE-PLAN IMAGE'S OWN PIXEL SPACE. */
export interface LotHotspot {
  /** left edge, in image pixels */
  x: number;
  /** top edge, in image pixels */
  y: number;
  /** width, in image pixels */
  w: number;
  /** height, in image pixels */
  h: number;
}

/** Minimal builder shape the hover card can render. */
export interface LotMapBuilder {
  short?: string | null;
  name?: string | null;
  /** brand color, used for the swatch dot */
  color?: string | null;
  /** optional logo URL, shown in the hover card when present */
  logo?: string | null;
}

/**
 * Minimal lot shape the map needs. Site-specific `Lot` types (e.g. a
 * neighborhood site's `src/data/lots.ts`) satisfy this structurally.
 */
export interface LotMapLot {
  id: string;
  number: string;
  status: 'available' | 'reserved' | 'sold';
  acres?: number | null;
  /** optional asking price; number or preformatted string */
  price?: number | string | null;
  builder?: LotMapBuilder | null;
}

/** Descriptor for the background site-plan image the geometry is authored against. */
export interface SitePlan {
  src: string;
  width: number;
  height: number;
  alt: string;
}
