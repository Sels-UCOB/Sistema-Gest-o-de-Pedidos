-- Versão paginada de get_gallery_metadata.
-- Envolve a função existente e adiciona LIMIT/OFFSET + total_count.
-- Execute no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION get_gallery_metadata_paged(
  p_limit  int DEFAULT 24,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id            text,
  customer_name text,
  campaign_code text,
  created_at    bigint,
  photo_type    text,
  order_id      text,
  product_id    text,
  item_name     text,
  item_qty      int,
  total_count   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- DISTINCT ON elimina duplicatas que a função base possa retornar
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
  FROM deduped d
  ORDER BY d.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;
