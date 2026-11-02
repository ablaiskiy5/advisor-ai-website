#!/usr/bin/env node
// Public, read-only demo release gate: no credentials, real users, inference or customer data.
// Run from an external GitHub Actions runner to check the published site, not local files.
export const DEMO_PAGES = Object.freeze([
  'workspace.html', 'ai-chat.html', 'portfolio-report.html', 'bond-analysis.html',
  'ideas-risk-budget.html', 'tasks-board.html', 'tools-health.html'
]);
const DEFAULT_SITE = 'https://ablaiskiy5.github.io/advisor-ai-website/';
const DEFAULT_API = 'https://xhewhzgzzonpgsjznmyl.supabase.co/functions/v1/';

function assert(condition, message) { if (!condition) throw new Error('DEMO SMOKE FAIL: ' + message); }
function baseUrl(value, label) {
  const url = new URL(value);
  assert(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash, label + ' must be a clean HTTPS URL');
  assert(url.pathname.endsWith('/'), label + ' must end in /');
  return url;
}
function localAssetUrls(markup, pageUrl, site) {
  const assets = new Set();
  const matches = markup.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi);
  for (const match of matches) {
    let url;
    try { url = new URL(match[1], pageUrl); } catch { continue; }
    if (url.origin !== site.origin || !url.pathname.startsWith(site.pathname)) continue;
    if (!/\.(?:js|css)$/i.test(url.pathname)) continue;
    assets.add(url.href);
  }
  return assets;
}
export async function verifyDemoReadiness({
  fetcher = fetch,
  siteUrl = DEFAULT_SITE,
  apiUrl = DEFAULT_API,
  timeoutMs = 12000
} = {}) {
  const site = baseUrl(siteUrl, 'siteUrl');
  const api = baseUrl(apiUrl, 'apiUrl');
  const fetchBounded = async (url, options={}) => {
    const result = await fetcher(url, {...options, signal:AbortSignal.timeout(timeoutMs), redirect:'follow'});
    assert(result && typeof result.status === 'number', 'invalid HTTP response for ' + url);
    return result;
  };
  const pageResults = await Promise.all(DEMO_PAGES.map(async name => {
    const url = new URL(name, site);
    const result = await fetchBounded(url.href);
    assert(result.status === 200, name + ' HTTP ' + result.status);
    const html = await result.text();
    assert(/<html\b/i.test(html) && /<\/html>/i.test(html), name + ' is not a complete HTML page');
    assert(/advisor\s*ai/i.test(html), name + ' is not the Advisor AI application');
    return {name, assets:localAssetUrls(html, url.href, site)};
  }));
  const assets = new Set(pageResults.flatMap(p => [...p.assets]));
  assert(assets.size > 0, 'no production CSS/JS assets found in published pages');
  await Promise.all([...assets].map(async url => {
    const result = await fetchBounded(url);
    assert(result.status === 200, 'linked asset HTTP ' + result.status + ': ' + url);
    const body = await result.text();
    assert(body.trim().length >= 20, 'empty/too-short asset: ' + url);
  }));
  for (const slug of ['advisor-ai-chat','advisor-ai-organize-tasks']) {
    const url = new URL(slug,api);
    const result = await fetchBounded(url.href, {
      method:'POST', headers:{'content-type':'application/json'}, body:'{}'
    });
    assert([401,403].includes(result.status), slug + ' accepted unsigned request or failed with HTTP ' + result.status);
  }
  return {pages:pageResults.length, assets:assets.size, protectedFunctions:2};
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  verifyDemoReadiness().then(result => {
    console.log('PASS: production Advisor AI ' + result.pages + ' pages, ' + result.assets + ' linked assets, ' + result.protectedFunctions + ' unsigned-request guards');
    console.log('LIMITATION: public smoke does not test login, account isolation, paid model inference, private uploads or quality of responses.');
  }).catch(err => { console.error(err.message); process.exitCode=1; });
}
