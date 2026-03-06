# ADR-007: Cache Busting Strategy

## Status
Accepted

## Context
After deploying code changes (particularly switching game sound effects from buffer-based noise to oscillator-based audio for iOS compatibility), users on iOS Safari were still loading stale cached versions of game JS files. The music box worked because its code was inline in `toybox.html`, but the game modules (`bubblePop.js`, `feedAnimal.js`, etc.) loaded via ES module dynamic imports were served from browser cache.

Client-side cache-busting approaches were evaluated:
- `?v=Date.now()` via `document.write` — broke vite HMR and caused page rendering issues
- `?v=N` on dynamic imports in `gameManager.js` — broke vite's module resolution
- Inline version strings on `<script>` and `<link>` tags — fragile and error-prone to maintain

## Decision
Use **server-side `Cache-Control` headers** via nginx configuration to prevent caching of JS, CSS, and HTML files:

```nginx
location ~* \.(js|css|html)$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires 0;
}
```

This is configured in `nginx.conf` and deployed via the Dockerfile.

## Consequences

### Positive
- No client-side hacks needed — HTML stays clean with plain `<script>` and `<link>` tags
- Works for all file types including dynamically imported ES modules
- Compatible with vite dev server (which already doesn't cache)
- Single place to manage caching policy

### Negative
- Every page load re-fetches all JS/CSS files (no browser caching benefit)
- Slightly higher bandwidth usage and slower loads on repeat visits

### Future
When the app stabilizes, consider switching to fingerprinted filenames (e.g. `app.a1b2c3.js`) with long cache lifetimes. This gives the best of both worlds: aggressive caching for unchanged files, instant cache invalidation for updated ones. A build step (vite build) would be needed for this.

## Notes
- iOS Safari is particularly aggressive about caching ES module imports
- The music box audio code is kept inline in `toybox.html` rather than as an external script because iOS Safari requires the `AudioContext` unlock listener to be registered from an inline script context for reliable behavior
