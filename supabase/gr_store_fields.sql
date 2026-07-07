-- Thêm cht / sdt_cht / qlkv / sdt_qlkv vào get_pic_gr và get_qlkv_gr
-- Chạy trong Supabase ▸ SQL Editor

CREATE OR REPLACE FUNCTION get_pic_gr(p_pic text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pic', p_pic,
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'po_number',       g.po_number,
        'site',            g.site,
        'vendor',          g.vendor,
        'vendor_name',     g.vendor_name,
        'product',         g.product,
        'po_amount',       g.po_amount,
        'document_date',   g.document_date,
        'tuyen',           g.tuyen,
        'original_note',   g.original_note,
        'confirmed_amount',g.confirmed_amount,
        'confirm_note',    g.confirm_note,
        'time_stamp',      g.time_stamp,
        'image',           g.image,
        'pic_comment',     g.pic_comment,
        'pic_status',      g.pic_status,
        'store_name',      COALESCE(st.store_name, ''),
        'cht',             COALESCE(st.cht,      ''),
        'sdt_cht',         COALESCE(st.sdt_cht,  ''),
        'qlkv',            COALESCE(st.qlkv,     ''),
        'sdt_qlkv',        COALESCE(st.sdt_qlkv, '')
      ))
      FROM gr_records g
      LEFT JOIN stores st ON st.store::text = g.site::text
      WHERE BTRIM(g.pic) = BTRIM(p_pic)
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION get_qlkv_gr(p_username text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role   text;
  v_idcol  text;
  v_result jsonb;
BEGIN
  SELECT COALESCE(NULLIF(LOWER(BTRIM(role)), ''), 'qlkv') INTO v_role
  FROM qlkv WHERE LOWER(BTRIM(username)) = LOWER(BTRIM(p_username)) LIMIT 1;
  IF v_role IS NULL THEN v_role := 'qlkv'; END IF;

  v_idcol := CASE v_role
    WHEN 'gdv' THEN 'gdv_id'
    WHEN 'gdm' THEN 'gdm_id'
    WHEN 'gdc' THEN 'gdc_id'
    ELSE 'qlkv_id'
  END;

  EXECUTE FORMAT($q$
    SELECT jsonb_build_object(
      'username', %L, 'role', %L,
      'records', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'po_number',        g.po_number,
          'site',             g.site,
          'vendor',           g.vendor,
          'vendor_name',      g.vendor_name,
          'product',          g.product,
          'po_amount',        g.po_amount,
          'document_date',    g.document_date,
          'tuyen',            g.tuyen,
          'original_note',    g.original_note,
          'confirmed_amount', g.confirmed_amount,
          'confirm_note',     g.confirm_note,
          'time_stamp',       g.time_stamp,
          'image',            g.image,
          'pic_comment',      g.pic_comment,
          'pic_status',       g.pic_status,
          'store_name',       COALESCE(st.store_name, ''),
          'cht',              COALESCE(st.cht,      ''),
          'sdt_cht',          COALESCE(st.sdt_cht,  ''),
          'qlkv',             COALESCE(st.qlkv,     ''),
          'sdt_qlkv',         COALESCE(st.sdt_qlkv, '')
        ))
        FROM stores st
        JOIN gr_records g ON g.site::text = st.store::text
        WHERE LOWER(BTRIM(st.%I)) = LOWER(BTRIM(%L))
      ), '[]'::jsonb)
    )
  $q$, p_username, v_role, v_idcol, p_username)
  INTO v_result;

  RETURN v_result;
END;
$$;
