# Security & Configuration Plan

Security and configuration concerns identified during comprehensive code review (March 2026).

---


## Sec 2: Docker base images have known vulnerabilities

**Severity:** Medium  
**Affected file:** `Dockerfile`  
**Symptom:** VS Code reports 9 high vulnerabilities in `node:22-alpine` and 1 in `nginx:alpine`.

**Root cause:** Unpinned Alpine tags pull whatever was latest at build time. The underlying Alpine packages may have unpatched CVEs.

**Fix:**
1. Pin to specific digest or patch versions:
   ```dockerfile
   FROM node:22.14-alpine3.21 AS build
   ...
   FROM nginx:1.27-alpine3.21
   ```
2. Add a scheduled rebuild (weekly or on dependency update) to pick up base image patches.
3. Consider adding a `docker scan` or `trivy` step to your CI pipeline.

**Validation:** Run `docker scout cves` or `trivy image` on the built image and confirm high/critical CVEs are resolved.

---

## Sec 3: Storage API monkey-patching may cause unexpected breakage

**Severity:** Low  
**Affected files:** `index.html`, `toybox.html`  
**Symptom:** Not a current bug, but a maintenance hazard. Both HTML files override `Storage.prototype` methods to no-op, preventing any localStorage/sessionStorage use.

**Root cause:** Intentional per ADR-009 (no persistent storage), but it's a global prototype override that affects everything on the page, including:
- Browser devtools extensions
- Any future analytics or error-tracking scripts
- Third-party libraries

**Recommendation:**
This is working as designed and the ADR documents the tradeoff. No fix needed, but add a comment explaining the scope:

```html
<script>
// ADR-009: No persistent storage. This overrides Storage globally
// to ensure no game, library, or extension can store data.
// WARNING: This will break any code that expects localStorage to work.
Storage.prototype.setItem = function(){};
Storage.prototype.getItem = function(){ return null; };
Storage.prototype.removeItem = function(){};
Storage.prototype.clear = function(){};
</script>
```

**Impact:** Documentation only. Prevents future confusion when onboarding contributors.

---

## Sec 4: SPA fallback serves index.html for all unknown routes

**Severity:** Low  
**Affected file:** `nginx.conf`  
**Symptom:** Any request to a non-existent path (e.g., `/admin`, `/api/anything`) returns `index.html` with a 200 status. This isn't a security hole per se, but it returns misleading 200s for resources that don't exist.

**Root cause:** `try_files $uri $uri/ /index.html` is a standard SPA pattern, but this isn't really a SPA — it has exactly two pages (`index.html` and `toybox.html`).

**Fix:**
Since this is a static multi-page app (not a SPA with client-side routing), remove the SPA fallback:

```nginx
location / {
    try_files $uri $uri/ =404;
}
```

Or, if you want a friendly 404, create a simple 404 page:

```nginx
error_page 404 /index.html;
```

**Impact:** Unknown routes return proper 404s instead of silently serving the landing page.

---

## Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 2 | Sec 2 — Pin Docker images | 10 min | Medium — security |
| 3 | Sec 4 — Remove SPA fallback | 5 min | Low — correctness |
| 4 | Sec 3 — Add storage override comments | 2 min | Low — documentation |

Total estimated effort: ~30 minutes.
