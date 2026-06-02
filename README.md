# @jw/shared

Canonical code shared between the JWRG and JWLC Astro sites.

Edit files here, not in the apps. Each app's `src/lib/api.ts` is a thin shim
that re-exports from `@jw/shared/api` and binds the site slug.

JWLC is the reference: when a pattern exists in both sites and they differ,
the shared version mirrors JWLC's shape. See `../../CLAUDE.md` and
`../../SHARED_FRONTEND_GUIDE.md` for the contract.
