-- RPCs de galeria de fotos.
-- Documentadas retroativamente — funções criadas via dashboard do Supabase.
-- Ordem de criação respeita dependências: get_single_photo → get_gallery_metadata
--   → get_gallery_metadata_paged / get_photos_bulk.

-- ─── get_single_photo ────────────────────────────────────────────────────────
-- Retorna a URL de uma foto de item ou caixa embalada.
-- Fotos antigas em base64 (data:image/...) retornam NULL para não estourar gateway.

DROP FUNCTION IF EXISTS get_single_photo(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_single_photo(
  p_order_id   TEXT,
  p_photo_type TEXT,
  p_product_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result text;
BEGIN
  IF p_photo_type = 'packed' THEN
    SELECT packed_photo_url INTO v_result
    FROM   orders WHERE id::text = p_order_id;
  ELSE
    SELECT (item->>'photoUrl') INTO v_result
    FROM   orders,
           jsonb_array_elements(items) AS item
    WHERE  id::text = p_order_id
      AND  item->>'productId' = p_product_id
    LIMIT 1;
  END IF;

  IF v_result IS NOT NULL AND left(v_result, 5) = 'data:' THEN
    RETURN NULL;
  END IF;

  RETURN v_result;
END;
$$;

-- ─── get_gallery_metadata ────────────────────────────────────────────────────
-- Retorna metadados de todas as fotos (itens + caixas) de pedidos fechados/enviados.
-- Verifica existência da chave photoUrl sem extrair o valor (evita base64 em memória).

DROP FUNCTION IF EXISTS get_gallery_metadata();
CREATE OR REPLACE FUNCTION get_gallery_metadata()
RETURNS TABLE(
  id            TEXT,
  customer_name TEXT,
  campaign_code TEXT,
  created_at    BIGINT,
  photo_type    TEXT,
  order_id      TEXT,
  product_id    TEXT,
  item_name     TEXT,
  item_qty      INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY

  -- Itens com foto separada
  SELECT
    (o.id::text || '-item-' || COALESCE(item->>'productId', 'x')),
    o.customer_name,
    o.campaign_code,
    o.created_at,
    'item'::text,
    o.id::text,
    (item->>'productId'),
    (item->>'name'),
    (item->>'quantity')::int
  FROM   orders o
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS item
  WHERE  o.status IN ('closed', 'shipped')
    AND  item ? 'photoUrl'

  UNION ALL

  -- Caixas embaladas
  SELECT
    (o.id::text || '-packed'),
    o.customer_name,
    o.campaign_code,
    o.created_at,
    'packed'::text,
    o.id::text,
    NULL::text, NULL::text, NULL::int
  FROM   orders o
  WHERE  o.status IN ('closed', 'shipped')
    AND  packed_photo_url IS NOT NULL;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'get_gallery_metadata: %', SQLERRM;
  RETURN;
END;
$$;

-- ─── get_gallery_metadata_paged ──────────────────────────────────────────────
-- Versão paginada com deduplicação e total_count para o frontend.

DROP FUNCTION IF EXISTS get_gallery_metadata_paged(INT, INT);
CREATE OR REPLACE FUNCTION get_gallery_metadata_paged(
  p_limit  INT DEFAULT 24,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  id            TEXT,
  customer_name TEXT,
  campaign_code TEXT,
  created_at    BIGINT,
  photo_type    TEXT,
  order_id      TEXT,
  product_id    TEXT,
  item_name     TEXT,
  item_qty      INT,
  total_count   BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH deduped AS (
    SELECT DISTINCT ON (sub.id)
      sub.id::text            AS id,
      sub.customer_name::text AS customer_name,
      sub.campaign_code::text AS campaign_code,
      sub.created_at::bigint  AS created_at,
      sub.photo_type::text    AS photo_type,
      sub.order_id::text      AS order_id,
      sub.product_id::text    AS product_id,
      sub.item_name::text     AS item_name,
      sub.item_qty::int       AS item_qty
    FROM get_gallery_metadata() sub
    ORDER BY sub.id, sub.created_at DESC
  )
  SELECT
    d.*,
    COUNT(*) OVER ()::bigint AS total_count
  FROM   deduped d
  ORDER  BY d.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

-- ─── get_photos_bulk ────────────────────────────────────────────────────────
-- Resolve URLs de múltiplas fotos em uma única chamada RPC.

DROP FUNCTION IF EXISTS get_photos_bulk(JSONB);
CREATE OR REPLACE FUNCTION get_photos_bulk(p_requests JSONB)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_req    jsonb;
  v_url    text;
BEGIN
  FOR v_req IN SELECT value FROM jsonb_array_elements(p_requests)
  LOOP
    SELECT get_single_photo(
      v_req->>'order_id',
      v_req->>'photo_type',
      NULLIF(v_req->>'product_id', '')
    ) INTO v_url;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object('id', v_req->>'id', 'url', v_url)
    );
  END LOOP;

  RETURN v_result;
END;
$$;
