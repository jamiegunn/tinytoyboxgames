# Build & Deploy Improvement Plan

Build and deployment concerns identified during comprehensive code review (March 2026).

---

## BD 1: Vite is in `dependencies` instead of `devDependencies`

**Severity:** Medium  
**Affected file:** `package.json`  
**Symptom:** The production Docker image installs Vite and all build tooling before it's discarded in the multi-stage build. Not a runtime issue, but it inflates the build stage and misrepresents what's needed at runtime.

**Root cause:** `vite` is listed under `dependencies` rather than `devDependencies`.

**Fix:**
```bash
npm install --save-dev vite
```

Or manually move in `package.json`:
```json
{
  "devDependencies": {
    "vite": "^7.3.1"
  }
}
```

Since the Docker build stage runs `npm ci` (which installs both deps and devDeps), this won't break the build. It simply communicates intent correctly.

**Impact:** Cleaner dependency semantics. No functional change.

---

## BD 2: Vite config uses CommonJS format

**Severity:** Low  
**Affected file:** `vite.config.js`  
**Symptom:** `require()` and `module.exports` in `vite.config.js` while the rest of the codebase uses ES modules. Vite natively supports ESM config.

**Root cause:** Config was written in CommonJS style.

**Fix:**
```js
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        toybox: resolve(import.meta.dirname, 'toybox.html'),
      },
    },
  },
})
```

`import.meta.dirname` is available in Node 22+ (the project's minimum).

**Validation:** Run `npm run build` and confirm output is identical.

---

## BD 3: No CI/CD pipeline

**Severity:** Medium  
**Affected file:** (none — needs to be created)  
**Symptom:** No automated build, test, or deploy pipeline. All builds and deploys are manual.

**Root cause:** The project doesn't have a `.github/workflows/` directory or any CI configuration.

**Recommendation:**
Create a minimal GitHub Actions workflow:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build

  docker:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t tinytoyboxgames .
      - run: docker scout cves tinytoyboxgames --exit-code
```

This validates that:
1. `npm ci` succeeds (dependencies resolve)
2. `npm run build` succeeds (Vite produces output)
3. Docker image builds successfully
4. No critical CVEs in the Docker image

**Impact:** Catches build failures before deploy. Foundation for future test automation.

---

## BD 4: No build artifact validation

**Severity:** Low  
**Affected file:** `Dockerfile`  
**Symptom:** If the Vite build silently fails or produces incomplete output, the Docker image still builds but serves broken content.

**Root cause:** The Dockerfile copies `dist/` to nginx without verifying it contains expected files.

**Fix:**
Add a validation step in the Dockerfile after the build:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Validate critical files exist
RUN test -f dist/index.html && test -f dist/toybox.html \
    || (echo "Build validation failed: missing HTML files" && exit 1)

FROM nginx:alpine
# ... rest unchanged
```

**Impact:** Fail-fast on broken builds instead of deploying a broken site.

---

## BD 5: nginx health check returns plain text

**Severity:** Low  
**Affected file:** `nginx.conf`  
**Symptom:** The `/health` endpoint returns `200 ok` as plain text. This works but could be more useful.

**Root cause:** Minimal health check implementation.

**Recommendation:**
This is fine for a simple container health check. If you want to make it more useful for monitoring dashboards, consider returning JSON:

```nginx
location /health {
    access_log off;
    default_type application/json;
    return 200 '{"status":"ok"}';
}
```

Or leave as-is — plain text is perfectly adequate for Docker `HEALTHCHECK` and load balancer probes.

**Impact:** Optional improvement. Current implementation works.

---

## Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | BD 1 — Move Vite to devDependencies | 2 min | Medium — correctness |
| 2 | BD 3 — Add CI/CD pipeline | 30 min | Medium — automation |
| 3 | BD 4 — Build artifact validation | 5 min | Low — safety net |
| 4 | BD 2 — ESM Vite config | 5 min | Low — consistency |
| 5 | BD 5 — Health check format | 2 min | Low — optional |

Total estimated effort: ~45 minutes.
