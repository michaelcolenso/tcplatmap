(() => {
  const elIntroCard = document.getElementById("introCard");
  const elPropertyCard = document.getElementById("propertyCard");
  const elProperty = document.getElementById("property");
  const elSalesHistory = document.getElementById("saleshistory");
  const elTbody = document.getElementById("tbody");

  const fmtMoney = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  function normalizePin(pin) {
    const p = String(pin ?? "").trim();
    if (!p) return null;
    if (p.startsWith("28-")) return p;
    return `28-${p}`;
  }

  function parseLegacyDate(s) {
    const t = String(s ?? "").trim();
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
    if (!m) return null;
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);
    if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yyyy))
      return null;
    return new Date(yyyy, mm - 1, dd);
  }

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  function fromNow(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const diffMs = date.getTime() - Date.now();
    const abs = Math.abs(diffMs);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;

    if (abs >= year) return rtf.format(Math.round(diffMs / year), "year");
    if (abs >= month) return rtf.format(Math.round(diffMs / month), "month");
    if (abs >= week) return rtf.format(Math.round(diffMs / week), "week");
    if (abs >= day) return rtf.format(Math.round(diffMs / day), "day");
    if (abs >= hour) return rtf.format(Math.round(diffMs / hour), "hour");
    if (abs >= minute) return rtf.format(Math.round(diffMs / minute), "minute");
    return rtf.format(Math.round(diffMs / 1000), "second");
  }

  function setPropertyInfo(props) {
    const street = props?.propstreetcombined ?? props?.address ?? "Unknown address";
    const owner = props?.ownername1 ?? "Suppressed";
    const assessed = Number(props?.adjass_3 ?? props?.assessed_value ?? 0);
    const lotAcres = props?.land_netAcres ?? props?.acreage ?? "NA";
    const propclass = String(props?.propclass ?? "");

    let yearBuilt = "NA";
    if (propclass === "201") yearBuilt = props?.cib_yearbuilt ?? "NA";
    else if (propclass === "401") yearBuilt = props?.resb_yearbuilt ?? "NA";

    elProperty.innerHTML = [
      `<h3>${escapeHtml(street)}</h3>`,
      `<p><strong>Owner:</strong> ${escapeHtml(owner)}</p>`,
      `<p><strong>Assessed Value:</strong> ${fmtMoney.format(
        Number.isFinite(assessed) ? assessed : 0
      )}</p>`,
      `<p><strong>Year Built:</strong> ${escapeHtml(String(yearBuilt))}</p>`,
      `<p><strong>Lot Area:</strong> ${escapeHtml(String(lotAcres))} Acres</p>`,
    ].join("");

    if (elIntroCard) elIntroCard.hidden = true;
    elPropertyCard.hidden = false;
  }

  function renderSales(records) {
    const list = Array.isArray(records) ? records : [];
    elTbody.innerHTML = "";

    for (const r of list) {
      const date = parseLegacyDate(r?.DateOfSale ?? r?.sale_date);
      const price = Number(r?.saleprice ?? r?.price ?? 0);
      const buyer = String(r?.grantee ?? r?.buyer ?? "").trim();
      const seller = String(r?.grantor ?? r?.seller ?? "").trim();
      const terms = String(r?.terms ?? r?.instrument ?? "").trim();

      const tr = document.createElement("tr");
      tr.innerHTML = [
        `<td>${escapeHtml(fromNow(date) || String(r?.sale_date ?? ""))}</td>`,
        `<td>${escapeHtml(fmtMoney.format(Number.isFinite(price) ? price : 0))}</td>`,
        `<td>${escapeHtml(buyer)}</td>`,
        `<td>${escapeHtml(seller)}</td>`,
        `<td>${escapeHtml(terms)}</td>`,
      ].join("");
      elTbody.appendChild(tr);
    }

    elSalesHistory.textContent = `This property has ${list.length} public records in the sales database.`;
  }

  async function loadSales(pin) {
    const pnum = normalizePin(pin);
    if (!pnum) {
      renderSales([]);
      return;
    }
    try {
      const response = await fetch(`/api/sales/${encodeURIComponent(pnum)}`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Sales API returned ${response.status}`);
      const data = await response.json();
      renderSales(data.records);
    } catch (err) {
      console.error(err);
      elSalesHistory.textContent = "Sales history failed to load.";
      renderSales([]);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function quantizeOpacity(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return 0.1;
    const min = 1;
    const max = 100000;
    const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
    const idx = Math.max(0, Math.min(4, Math.floor(t * 5)));
    return [0.1, 0.4, 0.6, 0.9, 1][idx];
  }

  function classColor(props) {
    const desc = String(props?.classdesc ?? "").toUpperCase();
    if (desc.includes("RESIDENTIAL")) return "#377eb8";
    if (desc.includes("COMMERCIAL")) return "#e41a1c";
    if (desc.includes("RELIGIOUS") || desc.includes("CHURCH")) return "#e9d558";
    if (desc.includes("CITY") || desc.includes("PUBLIC")) return "#4daf4a";
    if (desc.includes("VACANT")) return "#434d53";
    return "#9aa3ad";
  }

  const map = L.map("map", {
    center: [44.7631, -85.6206],
    zoom: 14,
    minZoom: 12,
    maxZoom: 17,
  });
  L.tileLayer(
    "https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png",
    {
      attribution:
        'Map tiles by <a href="https://stamen.com">Stamen Design</a>. Data by <a href="https://www.openstreetmap.org/">OpenStreetMap</a>.',
      maxZoom: 20,
    }
  ).addTo(map);

  let parcelsLayer = null;
  const geoJsonFactory = L.geoJSON || L.geoJson;
  if (typeof geoJsonFactory !== "function") {
    console.error("Leaflet GeoJSON layer factory not found on L.");
  }

  fetch("/js/tcgeo.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load tcgeo.json: ${r.status}`);
      return r.json();
    })
    .then((geojson) => {
      parcelsLayer = geoJsonFactory(geojson, {
        style: (feature) => {
          const props = feature?.properties ?? {};
          return {
            color: "rgba(255,255,255,1)",
            weight: 0.5,
            fillColor: classColor(props),
            fillOpacity: quantizeOpacity(props?.adjass_3),
          };
        },
        onEachFeature: (feature, layer) => {
          layer.on("click", () => {
            const props = feature?.properties ?? {};
            setPropertyInfo(props);
            loadSales(props?.PIN ?? props?.parcel_id);
          });
          layer.on("mouseover", () => {
            layer.setStyle({ color: "red", weight: 1, fillOpacity: 0 });
          });
          layer.on("mouseout", () => {
            if (parcelsLayer) parcelsLayer.resetStyle(layer);
          });
        },
      }).addTo(map);

      if (parcelsLayer && typeof parcelsLayer.getBounds === "function") {
        const bounds = parcelsLayer.getBounds();
        if (bounds && typeof map.fitBounds === "function") {
          map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
        }
        if (bounds && typeof map.setMaxBounds === "function") {
          const padded = typeof bounds.pad === "function" ? bounds.pad(0.15) : bounds;
          map.setMaxBounds(padded);
          map.on("drag", () => {
            if (typeof map.panInsideBounds === "function") {
              map.panInsideBounds(padded, { animate: false });
            }
          });
        }
      }
    })
    .catch((err) => {
      console.error(err);
      if (elSalesHistory) {
        elSalesHistory.textContent =
          "Failed to load parcel geometry. See console for details.";
      }
    });
})();
