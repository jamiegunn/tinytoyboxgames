FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY src/package.json src/bun.lock ./
RUN bun install --frozen-lockfile
COPY src/ .
RUN bun run build

# ── Build validation ──────────────────────────────────────────────
# Every check must pass or the image build fails — a broken build
# never reaches production.
RUN set -e \
    && echo "▸ Checking dist/index.html exists…" \
    && test -f dist/index.html \
    && echo "▸ Checking JS bundle exists in dist/assets/…" \
    && ls dist/assets/*.js 1>/dev/null 2>&1 \
    && echo "▸ Checking CSS bundle exists in dist/assets/…" \
    && ls dist/assets/*.css 1>/dev/null 2>&1 \
    && echo "▸ Checking index.html references a JS bundle…" \
    && grep -q '\.js' dist/index.html \
    && echo "▸ Checking index.html references a CSS bundle…" \
    && grep -q '\.css' dist/index.html \
    && echo "▸ Checking JS bundle is non-empty (>1 KB)…" \
    && JS_SIZE=$(stat -c%s dist/assets/*.js | sort -rn | head -1) \
    && test "$JS_SIZE" -gt 1024 \
    && echo "✔ All build checks passed (main bundle: ${JS_SIZE} bytes)" \
    && echo "{\"status\":\"ok\",\"built\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"js_bytes\":${JS_SIZE}}" > dist/build-status.json

FROM nginx:1.28-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
