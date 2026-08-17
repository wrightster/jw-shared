// ─────────────────────────────────────────────────────────────────────────────
// @jw/shared/llmsTxt — build an llms.txt (llmstxt.org) for a community site.
//
// llms.txt is a markdown index served at /llms.txt: an H1, a blockquote summary,
// then link sections. It exists so a model reading the site gets the structure
// and the current inventory without crawling and parsing every page.
//
// Built server-side per request from the same office data the pages render, so
// it can't drift from them — the whole failure mode of a hand-maintained file.
// ─────────────────────────────────────────────────────────────────────────────

import type { NeighborhoodContext, NeighborhoodLot } from './jsonLd';
import { isSellableLot } from './jsonLd';

export interface LlmsTxtPage {
  /** Root-relative path, e.g. "/lots". */
  path: string;
  title: string;
  /** Short description of what's on the page. */
  note?: string;
}

export interface LlmsTxtSection {
  heading: string;
  /** Markdown list items, emitted verbatim under the heading. */
  lines: string[];
}

export interface NeighborhoodLlmsTxtInput {
  ctx: NeighborhoodContext;
  /** Live lots. Omit (or pass []) and the inventory sections are skipped. */
  lots?: NeighborhoodLot[];
  pages: LlmsTxtPage[];
  /** Lines for a "Brokerage" section — who markets the community. */
  brokerage?: string[];
  /** Extra sections appended after the inventory. */
  extra?: LlmsTxtSection[];
}

const STATUS_LABEL: Record<string, string> = {
  available: 'available',
  reserved: 'reserved',
  under_contract: 'under contract',
  sold: 'sold',
  common_area: 'common area',
};

/** "1.24 acres" / "0.75 acres", or undefined when there's no acreage. */
function acresLabel(acres: number | null | undefined): string | undefined {
  if (typeof acres !== 'number' || acres <= 0) return undefined;
  return `${acres.toFixed(2)} acres`;
}

function priceLabel(price: number | string | null | undefined): string | undefined {
  if (price == null || price === '') return undefined;
  const n = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(n) || n <= 0) return undefined;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function neighborhoodLlmsTxt(input: NeighborhoodLlmsTxtInput): string {
  const { ctx, pages, brokerage, extra } = input;
  const base = ctx.url.replace(/\/$/, '');
  const lotsPath = ctx.lotsPath ?? '/lots';
  const label = ctx.lotLabel ?? 'Homesite';
  const plural = `${label.toLowerCase()}s`;
  const lots = (input.lots ?? []).filter(isSellableLot);

  const out: string[] = [];
  out.push(`# ${ctx.name}`);
  out.push('');

  if (ctx.description) {
    out.push(`> ${ctx.description}`);
    out.push('');
  }

  // A prose line stating the facts a model would otherwise have to infer by
  // counting cards on the lots page.
  if (lots.length) {
    const available = lots.filter((l) => l.status === 'available').length;
    const acreages = lots
      .map((l) => l.acres)
      .filter((a): a is number => typeof a === 'number' && a > 0);
    const range = acreages.length
      ? ` ${plural.charAt(0).toUpperCase() + plural.slice(1)} run from ${Math.min(...acreages).toFixed(2)} to ${Math.max(...acreages).toFixed(2)} acres.`
      : '';
    out.push(
      `${ctx.name} has ${lots.length} ${plural}, of which ${available} ${available === 1 ? 'is' : 'are'} currently available.${range} ` +
        `Inventory below is read live from the Julie Wright Realty Group office system each time this file is requested, so it matches the site.`,
    );
    out.push('');
  }

  if (ctx.city && ctx.region) {
    out.push(`Location: ${ctx.city}, ${ctx.region}${ctx.postalCode ? ` ${ctx.postalCode}` : ''}, USA.`);
    out.push('');
  }

  out.push('## Pages');
  out.push('');
  for (const p of pages) {
    out.push(`- [${p.title}](${base}${p.path})${p.note ? `: ${p.note}` : ''}`);
  }
  out.push('');

  if (lots.length) {
    out.push(`## ${label}s`);
    out.push('');
    for (const lot of lots) {
      const bits = [STATUS_LABEL[lot.status] ?? lot.status];
      const acres = acresLabel(lot.acres);
      if (acres) bits.push(acres);
      const price = priceLabel(lot.price);
      if (price) bits.push(price);
      if (lot.address) bits.push(lot.address);
      const builder = lot.builder?.name || lot.builder?.short;
      if (builder) bits.push(`builder: ${builder}`);
      out.push(`- [${label} ${lot.number}](${base}${lotsPath}/${encodeURIComponent(lot.id)}): ${bits.join(', ')}`);
    }
    out.push('');
  }

  for (const section of extra ?? []) {
    if (!section.lines.length) continue;
    out.push(`## ${section.heading}`);
    out.push('');
    out.push(...section.lines);
    out.push('');
  }

  if (brokerage?.length) {
    out.push('## Brokerage');
    out.push('');
    out.push(...brokerage);
    out.push('');
  }

  return out.join('\n');
}
