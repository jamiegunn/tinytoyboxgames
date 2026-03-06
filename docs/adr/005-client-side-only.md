# ADR-005: Purely Client-Side

## Status
Accepted with Tooling Amendments

## Context
A kids' game collection should stay simple to deploy, fast to load, and low-risk from a privacy standpoint.

## Decision
Tiny Toybox remains a client-side experience. There is no backend, no accounts, and no analytics.

- Static HTML/CSS/JS remains the runtime model
- ES modules with dynamic `import()` are used for lazy loading
- External libraries may be loaded via CDN
- Vite is used for local development and production builds
- A small optional Node server can serve the built output

## Consequences
- Privacy and operational complexity stay low
- The runtime is still client-side even though build tooling now exists
- Docs should describe Vite and `server.js` as tooling, not as an application backend
