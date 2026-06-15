-- Schema inicial: profiles, products, inventory, shipments, orders.
-- Estas tabelas foram criadas via dashboard do Supabase e documentadas aqui retroativamente.
-- Usar CREATE TABLE IF NOT EXISTS para ser idempotente.

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Criada automaticamente pelo trigger de sign-up do Supabase Auth.

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  role       TEXT    NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  campo      TEXT    CHECK (campo IN ('GO', 'MT', 'MS'))
);

-- RLS gerenciada em 20260615000000_security_rls_restricoes.sql

-- ─── products ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados_products" ON products;
CREATE POLICY "autenticados_products"
  ON products FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─── inventory ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory (
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, warehouse_id)
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados_inventory" ON inventory;
CREATE POLICY "autenticados_inventory"
  ON inventory FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─── shipments ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shipments (
  id                 UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID   REFERENCES auth.users(id),
  type               TEXT   NOT NULL CHECK (type IN ('transportadora', 'presencial', 'acerto')),
  carrier_name       TEXT,
  carrier_phone      TEXT,
  shipping_date      BIGINT NOT NULL,
  pickup_name        TEXT,
  order_ids          TEXT[] NOT NULL DEFAULT '{}',
  status             TEXT   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shipped')),
  receipt_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at         BIGINT NOT NULL
);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados_shipments" ON shipments;
CREATE POLICY "autenticados_shipments"
  ON shipments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─── orders ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id               UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID   REFERENCES auth.users(id),
  customer_name    TEXT   NOT NULL,
  campaign_code    TEXT   NOT NULL DEFAULT '',
  destination_city TEXT   NOT NULL DEFAULT '',
  responsible      TEXT   NOT NULL DEFAULT '',
  status           TEXT   NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'separating', 'closed', 'shipped')),
  tipo             TEXT   NOT NULL DEFAULT 'envio'
                          CHECK (tipo IN ('envio', 'acerto')),
  items            JSONB  NOT NULL DEFAULT '[]',
  packed_photo_url TEXT,
  created_at       BIGINT NOT NULL,
  shipment_id      UUID   REFERENCES shipments(id)
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados_orders" ON orders;
CREATE POLICY "autenticados_orders"
  ON orders FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─── RPC: inventário ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION add_inventory(
  p_product_id   UUID,
  p_warehouse_id TEXT,
  p_quantity     INTEGER
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO inventory (product_id, warehouse_id, quantity)
  VALUES (p_product_id, p_warehouse_id, p_quantity)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity;
END;
$$;

CREATE OR REPLACE FUNCTION deduct_inventory(
  p_product_id   UUID,
  p_warehouse_id TEXT,
  p_quantity     INTEGER
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE inventory
     SET quantity = GREATEST(0, quantity - p_quantity)
   WHERE product_id = p_product_id
     AND warehouse_id = p_warehouse_id;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_set_inventory(rows JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r JSONB;
BEGIN
  FOR r IN SELECT value FROM jsonb_array_elements(rows)
  LOOP
    INSERT INTO inventory (product_id, warehouse_id, quantity)
    VALUES (
      (r->>'product_id')::UUID,
       r->>'warehouse_id',
      (r->>'quantity')::INTEGER
    )
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET quantity = EXCLUDED.quantity;
  END LOOP;
END;
$$;

-- ─── RPC: perfis com e-mail ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_profiles_with_email()
RETURNS TABLE(id UUID, full_name TEXT, email TEXT, role TEXT, campo TEXT)
LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
  SELECT p.id, p.full_name, u.email::TEXT, p.role, p.campo
  FROM   profiles p
  JOIN   auth.users u ON u.id = p.id
  ORDER  BY p.full_name;
$$;

-- ─── RPC: pedidos slim (sem URLs de foto nos items) ──────────────────────────
-- Retorna pedidos sem photo_url dentro de cada item para reduzir payload.

CREATE OR REPLACE FUNCTION get_orders_slim()
RETURNS TABLE(
  id               UUID,
  customer_name    TEXT,
  campaign_code    TEXT,
  destination_city TEXT,
  responsible      TEXT,
  status           TEXT,
  tipo             TEXT,
  items            JSONB,
  created_at       BIGINT,
  shipment_id      TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    id,
    customer_name,
    campaign_code,
    destination_city,
    responsible,
    status,
    tipo,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'productId',   item->>'productId',
          'name',        item->>'name',
          'quantity',    item->'quantity',
          'isSeparated', item->'isSeparated'
        )
      )
      FROM jsonb_array_elements(items) AS item
    ) AS items,
    created_at,
    shipment_id
  FROM orders
  ORDER BY created_at DESC;
$$;
