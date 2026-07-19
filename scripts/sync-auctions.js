const fs = require("fs");
const path = require("path");
const { sleep, DEFAULT_USER_AGENT } = require("./lib/arcgis");
require("dotenv").config();

const sources = [
  { type: "sheriff", url: process.env.SHERIFF_FORECLOSURE_URL || "https://www.gtcountymi.gov/2246/Foreclosure-SalesAdjournments" },
  { type: "tax", url: process.env.TAX_FORECLOSURE_URL || "https://www.tax-sale.info/auctions" },
];
const outputPath = path.resolve(process.env.AUCTIONS_SYNC_OUT || "data/auctions-sync.json");

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": DEFAULT_USER_AGENT, accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}
function extractLinks(html, base, type) {
  const rows = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!/foreclosure|sale|adjourn|auction|grand traverse|summary|lot/i.test(text)) continue;
    rows.push({ parcel_id: null, case_no: null, type, sale_date: null, min_bid: null, status: "source_found", source_url: new URL(match[1], base).toString(), title: text });
  }
  return rows;
}
async function main() {
  const rows = [];
  for (const source of sources) {
    const html = await fetchText(source.url);
    rows.push(...extractLinks(html, source.url, source.type));
    await sleep(500);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
  console.log(`[auctions] wrote ${rows.length} source rows to ${outputPath}`);
}
main().catch((error) => { console.error(error); process.exit(1); });
