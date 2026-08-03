/**
 * Does the built site actually RENDER?
 *
 * `vite build` exiting 0 says the bundler was happy. Grepping index.html says
 * the bundler wrote the URLs it was told to. Neither says a browser that loads
 * the page ends up with anything on screen — and the gap between those claims
 * shipped a blank white deploy on 2026-08-02 that passed every check in
 * `.github/workflows/ci.yml`.
 *
 * The defect was one flag. The Pages job built with
 * `--base=/tinytoyboxgames/game/`, correct for a project page at
 * `jamiegunn.github.io/tinytoyboxgames/`. The site has a custom domain, and a
 * custom domain serves the repo from the DOMAIN root — so every bundle was
 * requested from `tinytoyboxgames.com/tinytoyboxgames/game/assets/…`, a 404, and
 * the page mounted nothing.
 *
 * The step that was supposed to catch it grepped `index.html` for the very
 * string the build had just been told to write. Input and expected value were
 * the same literal, so it could only confirm that Vite obeyed its flag.
 *
 * THE LESSON THIS FILE IS: a check whose expected value is copied from the input
 * proves nothing. This one has an independent oracle — a real browser — and it
 * asserts the property that actually matters. It catches the 404 case, and it
 * also catches a case no amount of grepping could: a bundle that loads fine and
 * then throws.
 *
 * Usage: node scripts/smoke-site.mjs <url>
 * Exit 0 if the page rendered, 1 if it did not, 2 on bad usage.
 */
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/smoke-site.mjs <url>');
  process.exit(2);
}

// Never proxy a loopback URL. A sandbox or corporate proxy will answer
// localhost itself, and the smoke test then grades the proxy's error page
// instead of the site — which it will duly report as a failure, for the wrong
// reason, and send the next reader looking for a bug in the build.
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);
const proxy = isLocal ? null : process.env.HTTPS_PROXY || process.env.https_proxy;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  ...(proxy ? { proxy: { server: proxy } } : {}),
});
const page = await browser.newPage();

const failedRequests = [];
const pageErrors = [];
page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`));
page.on('response', (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
});
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? -1);
const bodyText = (await page.evaluate(() => document.body.innerText || '')).trim();

console.log(`url                 ${url}`);
console.log(`#root children      ${rootChildren}`);
console.log(`visible text        ${bodyText ? JSON.stringify(bodyText.slice(0, 120)) : '(none)'}`);
console.log(`failed requests     ${failedRequests.length}`);
for (const f of failedRequests.slice(0, 8)) console.log(`  ✖ ${f}`);
console.log(`page errors         ${pageErrors.length}`);
for (const e of pageErrors.slice(0, 5)) console.log(`  ✖ ${e}`);

await browser.close();

const problems = [];
// TWO KINDS OF PAGE, ONE SCRIPT. The game is a React shell whose whole content
// arrives by script, so "did it render" means "#root has children". The landing
// and docs pages are static HTML with no #root at all, and demanding one there
// would fail every page that cannot possibly have the defect. So: if there is a
// #root it must be populated; otherwise the page must have visible text.
if (rootChildren === 0) {
  problems.push('#root is empty: the page loaded and mounted nothing');
} else if (rootChildren < 0 && !bodyText) {
  problems.push('no #root element and no visible text — the page rendered nothing at all');
}
if (failedRequests.length) problems.push(`${failedRequests.length} request(s) failed to load`);
if (pageErrors.length) problems.push(`${pageErrors.length} uncaught error(s) on the page`);

if (problems.length) {
  console.error(`\n✖ smoke test failed:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log('\n✔ the page rendered');
