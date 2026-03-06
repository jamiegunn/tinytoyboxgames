# ADR-005: Purely Client-Side

## Status
Accepted

## Context
A kids' game collection should be simple to deploy, fast to load, and work offline.

## Decision
Tiny Toybox is purely client-side. No backend, no accounts, no analytics.

- Static HTML/JS/CSS served from any static host
- ES modules with dynamic `import()` for lazy loading
- External libraries loaded via CDN (canvas-confetti)
- No build step required (vanilla JS)
- No frameworks

## Consequences
- Deploy anywhere: GitHub Pages, Netlify, any static server
- Works offline once cached
- No privacy concerns (no data collection)
- No server costs
- Trade-off: no cloud save, no multiplayer (not needed for target audience)
