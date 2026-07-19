const DEFAULT_USER_AGENT = "tcplatmap-sync/1.0 (+https://buildingTC.com/about-data)";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildArcgisQueryUrl(baseUrl, { offset = 0, pageSize = 2000, where = "1=1", outFields = "*", returnGeometry = false, outSR } = {}) {
  const url = new URL(baseUrl);
  url.searchParams.set("f", "json");
  url.searchParams.set("where", where);
  url.searchParams.set("outFields", outFields);
  url.searchParams.set("returnGeometry", String(returnGeometry));
  url.searchParams.set("resultOffset", String(offset));
  url.searchParams.set("resultRecordCount", String(pageSize));
  if (outSR) url.searchParams.set("outSR", String(outSR));
  return url;
}

async function fetchJsonWithBackoff(url, { userAgent = DEFAULT_USER_AGENT, maxAttempts = 5 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json", "user-agent": userAgent } });
      if (response.status === 429 || response.status >= 500) {
        const text = await response.text().catch(() => "");
        throw new Error(`retryable HTTP ${response.status} ${text}`.trim());
      }
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${response.statusText} ${text}`.trim());
      }
      const json = await response.json();
      if (json?.error) throw new Error(`ArcGIS error: ${json.error.message || JSON.stringify(json.error)}`);
      return json;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      await sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function* arcgisPages(baseUrl, options = {}) {
  const pageSize = Math.min(10000, Math.max(1, Number(options.pageSize) || 2000));
  let offset = Number(options.offset) || 0;
  for (;;) {
    const url = buildArcgisQueryUrl(baseUrl, { ...options, offset, pageSize });
    const json = await fetchJsonWithBackoff(url, options);
    const features = Array.isArray(json?.features) ? json.features : [];
    yield { offset, features, json, url: url.toString() };
    if (features.length === 0) break;
    if (json?.exceededTransferLimit !== true && features.length < pageSize) break;
    offset += features.length;
    await sleep(500); // ≤2 requests/sec.
  }
}

module.exports = { DEFAULT_USER_AGENT, arcgisPages, buildArcgisQueryUrl, fetchJsonWithBackoff, sleep };
