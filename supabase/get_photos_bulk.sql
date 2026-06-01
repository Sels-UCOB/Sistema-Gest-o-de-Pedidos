-- Busca URLs de foto para múltiplos itens em um único round-trip.
-- Recebe um array JSON [{id, order_id, photo_type, product_id}]
-- Retorna  [{id, url}]  — url pode ser null se não houver foto.
-- Execute no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION get_photos_bulk(p_requests jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
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
