# ADR-007: No-Cache Delivery Policy

## Status
Accepted

## Context
After deploying code changes, users could continue running stale versions of local HTML, CSS, and JavaScript. This was especially visible for dynamically imported game modules, where the page shell could update while individual game scripts still came from browser cache.

Several client-side cache-busting approaches were considered and rejected:
- `?v=Date.now()` on navigation links or injected markup was brittle and interfered with local development behavior
- Version query strings on dynamic `import()` paths broke Vite module resolution
- Manual version strings on every `<script>` and `<link>` tag were easy to miss and hard to maintain

The product requirement is stricter than ordinary cache busting: when Tiny Toybox is requested, locally served scripts and other app assets should be fetched again instead of being reused from browser cache.

## Decision
Disable caching for all locally served application responses across every supported serving path.

This policy is enforced server-side in `nginx.conf` with these response headers:
- `Cache-Control: no-store, no-cache, must-revalidate, max-age=0, s-maxage=0`
- `Pragma: no-cache`
- `Expires: 0`
- `Surrogate-Control: no-store`

The nginx container also disables `etag` and `if_modified_since` handling so local assets do not rely on conditional cache revalidation.

Google-hosted font and stylesheet requests are explicitly out of scope for this ADR because they are served from Google infrastructure, not from Tiny Toybox.

## Consequences

### Positive
- No client-side cache-busting hacks are needed in HTML or module import paths
- The policy covers entry HTML, dynamically imported game modules, CSS, images, audio, SVGs, and other local assets
- The no-cache behavior is enforced in the nginx container

### Negative
- Every visit re-fetches local app assets
- Repeat visits use more bandwidth and can be slower than a fingerprinted-cache strategy

## Notes
- iOS Safari is particularly aggressive about caching ES module imports, which helped motivate this policy
- Vite build output still uses fingerprinted filenames, but those filenames are not relied on for cache invalidation because the current product requirement is "never cache local assets"
- The music box audio code is kept inline in `toybox.html` rather than as an external script because iOS Safari requires the `AudioContext` unlock listener to be registered from an inline script context for reliable behavior
