## Traverse City Plat Map

buildingTC.com

Modernized map-only rebuild of the original tcplatmap app.

### Run locally
1. Install deps:

```sh
npm install
```

2. Generate `data/sales.json` (offline, using the bundled legacy ArcGIS export):

```sh
npm run data:convert:legacy-sales
```

3. Start the server:

```sh
npm run dev
```

Open `http://localhost:8080`.

### Refresh sales data from ArcGIS REST (on-demand)
1. Copy env template:

```sh
cp .env.example .env
```

2. Set `ARCGIS_SALES_URL` in `.env` to the ArcGIS layer `/query` endpoint, then run:

```sh
npm run data:fetch:sales
```

### Legacy code
The original 2014-era app (auth + API demos + Mongo) is preserved under `legacy/` and is not used by the current server.
