DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS app_state;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS saved_products;
DROP TABLE IF EXISTS compare_items;
DROP TABLE IF EXISTS outfit_slots;

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  store TEXT NOT NULL,
  category TEXT NOT NULL,
  bucket TEXT NOT NULL,
  slot TEXT NOT NULL,
  price INTEGER NOT NULL,
  mrp INTEGER NOT NULL,
  color TEXT NOT NULL,
  material TEXT NOT NULL,
  fit_score INTEGER NOT NULL,
  confidence INTEGER NOT NULL,
  breakdown TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'curated'
);

CREATE TABLE app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  profile_setup_done INTEGER NOT NULL DEFAULT 0,
  consent_photos INTEGER NOT NULL DEFAULT 0,
  consent_sharing INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'style',
  feedback_choice TEXT,
  feedback_note TEXT NOT NULL DEFAULT '',
  feedback_submitted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE saved_products (
  product_id INTEGER PRIMARY KEY
);

CREATE TABLE compare_items (
  product_id INTEGER PRIMARY KEY
);

CREATE TABLE outfit_slots (
  slot TEXT PRIMARY KEY,
  product_id INTEGER
);
