-- D1 schema for buildingTC.com property intelligence.

CREATE TABLE IF NOT EXISTS parcels (
  parcel_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  geometry_ref TEXT,
  acreage REAL,
  assessed_value INTEGER,
  owner_name TEXT,
  suppress_owner INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parcels_address ON parcels(address);
CREATE INDEX IF NOT EXISTS idx_parcels_updated_at ON parcels(updated_at);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parcel_id TEXT NOT NULL,
  sale_date TEXT,
  price INTEGER,
  instrument TEXT,
  buyer TEXT,
  seller TEXT,
  source_object_id TEXT,
  source_url TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_parcel_date ON sales(parcel_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date DESC);

CREATE TABLE IF NOT EXISTS auctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parcel_id TEXT,
  case_no TEXT,
  type TEXT NOT NULL CHECK (type IN ('sheriff', 'tax')),
  sale_date TEXT,
  min_bid INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  source_url TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id)
);

CREATE INDEX IF NOT EXISTS idx_auctions_date ON auctions(sale_date, status);
CREATE INDEX IF NOT EXISTS idx_auctions_parcel ON auctions(parcel_id);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error')),
  error TEXT
);
