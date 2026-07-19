-- pSEO support tables and browse fields for Phase 3 parcel pages.

ALTER TABLE parcels ADD COLUMN street_name TEXT;
ALTER TABLE parcels ADD COLUMN street_slug TEXT;
ALTER TABLE parcels ADD COLUMN plat_name TEXT;
ALTER TABLE parcels ADD COLUMN plat_slug TEXT;
ALTER TABLE parcels ADD COLUMN tier INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_parcels_street_slug ON parcels(street_slug);
CREATE INDEX IF NOT EXISTS idx_parcels_plat_slug ON parcels(plat_slug);
CREATE INDEX IF NOT EXISTS idx_parcels_tier ON parcels(tier, address, geometry_ref);

CREATE TABLE IF NOT EXISTS parcel_neighbors (
  parcel_id TEXT NOT NULL,
  neighbor_parcel_id TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT 'adjacent',
  PRIMARY KEY (parcel_id, neighbor_parcel_id),
  FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id),
  FOREIGN KEY (neighbor_parcel_id) REFERENCES parcels(parcel_id)
);

CREATE INDEX IF NOT EXISTS idx_parcel_neighbors_neighbor ON parcel_neighbors(neighbor_parcel_id);

CREATE TABLE IF NOT EXISTS auction_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'auctions_page',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
