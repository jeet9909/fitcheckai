# Engineering — Database Design

PostgreSQL (system of record) + Redis (cache/queue) + R2 (assets) + pgvector (V2 recs). Full ER + retention in `architecture/data-architecture.md`; this file adds concrete schema/migration guidance.

## 1. Schema (DDL sketch)
```sql
-- users & consent
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE, phone TEXT UNIQUE,
  auth_provider TEXT, status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('processing','storage','model_improvement','transfer')),
  granted BOOLEAN NOT NULL, version TEXT NOT NULL,
  ts TIMESTAMPTZ DEFAULT now()
);

-- body & avatar (sensitive)
CREATE TABLE body_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  height_cm NUMERIC, weight_kg NUMERIC, posture TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE TABLE avatar_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_profile_id UUID REFERENCES body_profiles(id) ON DELETE CASCADE,
  smpl_params_ref TEXT, mesh_ref TEXT, skin_tone TEXT,
  measurements JSONB, confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- catalog (normalized cache)
CREATE TABLE stores (id TEXT PRIMARY KEY, name TEXT, capability JSONB);
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT REFERENCES stores(id), external_id TEXT,
  title TEXT, brand TEXT, category TEXT,
  price NUMERIC, currency TEXT,
  images JSONB, sizes JSONB, colors JSONB, availability TEXT,
  size_chart JSONB, deep_link_tmpl TEXT, affiliate_params JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (store_id, external_id)
);
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  size TEXT, color TEXT, sku TEXT, price NUMERIC, availability TEXT
);

-- outfits
CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE outfit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id UUID REFERENCES outfits(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id), category TEXT
);

-- jobs, renders, fit
CREATE TABLE tryon_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  avatar_id UUID REFERENCES avatar_versions(id),
  item_set_hash TEXT, status TEXT DEFAULT 'queued',
  cost NUMERIC, latency_ms INT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON tryon_jobs (item_set_hash, avatar_id);  -- render reuse
CREATE TABLE renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES tryon_jobs(id) ON DELETE CASCADE,
  angle INT, storage_ref TEXT, resolution TEXT
);
CREATE TABLE fit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES tryon_jobs(id) ON DELETE CASCADE,
  regions JSONB, score NUMERIC, confidence NUMERIC, recommendations JSONB
);

-- cart, connected stores, feedback, audit
CREATE TABLE carts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE cart_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID, variant_id UUID, store_id TEXT, added_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE connected_stores (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  store_id TEXT REFERENCES stores(id), capability_snapshot JSONB,
  connected_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE fit_feedback (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, product_id UUID, purchased_size TEXT,
  fit_accurate BOOLEAN, notes TEXT, ts TIMESTAMPTZ DEFAULT now());
CREATE TABLE audit_log (id BIGSERIAL PRIMARY KEY, actor TEXT, action TEXT,
  entity TEXT, meta JSONB, ts TIMESTAMPTZ DEFAULT now());
```

## 2. Indexing
- `products (store_id, external_id)` unique; GIN on `products.title`/JSONB for search (or external search engine at scale).
- `tryon_jobs (item_set_hash, avatar_id)` for render reuse.
- `consents (user_id, type, ts)` for latest-consent lookups.

## 3. Migrations
- **Alembic**, one migration per change, forward + down.
- Seed data: stores + capability snapshots; sample products for dev.

## 4. Privacy-driven schema choices
- `deleted_at` soft-delete on user-erasable tables + a **hard-delete worker** honoring DPDP erasure SLA.
- Sensitive refs (`smpl_params_ref`, `storage_ref`) point to **encrypted R2 objects**, not inline blobs.
- Consent is **versioned & append-only** (audit trail).

## 5. Vector search (V2)
`pgvector` column on an `outfit_embeddings`/`style_embeddings` table for recommendations & "complete the look."

## 6. Backups & residency
Automated PITR backups; region selection to satisfy DPDP residency expectations if required (`compliance/privacy.md`).
