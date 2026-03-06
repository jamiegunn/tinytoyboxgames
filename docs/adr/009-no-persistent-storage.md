# ADR-009: Disable All Persistent Browser Storage

## Status
Accepted

## Context
Tiny Toybox is designed for preschool-age children (3-5). As outlined in ADR-005 (Client-Side Only), the app collects no data and requires no accounts. There is no reason for any code — ours or third-party (e.g. confetti library, future additions) — to write to `localStorage` or `sessionStorage`. Persisting data on a child's device is unnecessary and undesirable.

## Decision
Override `Storage.prototype` methods (`setItem`, `getItem`, `removeItem`, `clear`) in an inline `<script>` at the top of `<head>` in every HTML page, before any other scripts execute. `setItem` silently no-ops, `getItem` always returns `null`.

## Consequences
- No code on the page can persist data to browser storage, intentionally or accidentally.
- Third-party scripts that depend on storage for functionality (e.g. saving preferences) will degrade silently — acceptable since we have no such dependencies.
- If we ever need storage in the future, we would remove or scope this override. This is unlikely given the app's design principles.
- Cookies and IndexedDB are not covered by this override. Neither is currently used.
