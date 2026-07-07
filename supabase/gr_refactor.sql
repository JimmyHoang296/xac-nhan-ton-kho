-- ============================================================================
-- GR Refactor: gr_mapped view + RPCs dùng view làm tầng trung gian
-- Thay thế: gr_store_fields.sql + fix_pic_kstt_mapping.sql
-- Chạy trong Supabase ▸ SQL Editor
-- ============================================================================

-- ── 1. View gr_mapped ─────────────────────────────────────────────────────────
-- JOIN gr_records + stores một lần duy nhất.
-- Mọi RPC đọc GR đều query từ view này thay vì tự JOIN.

DROP VIEW IF EXISTS gr_mapped;

CREATE VIEW gr_mapped AS
SELECT
  g.*,
  COALESCE(st.kstt,      '') AS kstt,
  COALESCE(st.store_name,'') AS store_name,
  COALESCE(st.cht,       '') AS cht,
  COALESCE(st.sdt_cht,   '') AS sdt_cht,
  COALESCE(st.qlkv,      '') AS qlkv,
  COALESCE(st.sdt_qlkv,  '') AS sdt_qlkv,
  COALESCE(st.qlkv_id,   '') AS qlkv_id,
  COALESCE(st.gdv_id,    '') AS gdv_id,
  COALESCE(st.gdm_id,    '') AS gdm_id,
  COALESCE(st.gdc_id,    '') AS gdc_id
FROM gr_records g
LEFT JOIN stores st ON LOWER(BTRIM(g.site)) = LOWER(BTRIM(st.store));

-- ── 2. get_pic_stocks: filter theo stores.kstt (thay vì stocks.pic) ──────────

CREATE OR REPLACE FUNCTION get_pic_stocks(p_pic text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pic', p_pic,
    'stocks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'store',          s.store,
        'article',        s.article,
        'article_name',   s.article_name,
        'stock_day',      s.stock_day,
        'stock',          s.stock,
        'current_stock',  s.current_stock,
        'counted_stock',  s.counted_stock,
        'note',           s.note,
        'lat',            s.lat,
        'long',           s.long,
        'image',          s.image,
        'time_stamp',     s.time_stamp,
        'location_check', s.location_check,
        'pic_comment',    s.pic_comment,
        'pic_status',     s.pic_status,
        'thung',          s.thung,
        'risk',           s.risk,
        'store_name',     COALESCE(st.store_name, ''),
        'store_lat',      COALESCE(st.lat, ''),
        'store_long',     COALESCE(st.long, ''),
        'cht',            COALESCE(st.cht, ''),
        'sdt_cht',        COALESCE(st.sdt_cht, ''),
        'qlkv',           COALESCE(st.qlkv, ''),
        'sdt_qlkv',       COALESCE(st.sdt_qlkv, ''),
        'kstt',           COALESCE(st.kstt, '')
      ))
      FROM stores st
      JOIN stocks s ON LOWER(BTRIM(s.store)) = LOWER(BTRIM(st.store))
      WHERE LOWER(BTRIM(st.kstt)) = LOWER(BTRIM(p_pic))
    ), '[]'::jsonb)
  );
$$;

-- ── 3. get_pic_gr: filter qua gr_mapped.kstt ─────────────────────────────────

CREATE OR REPLACE FUNCTION get_pic_gr(p_pic text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pic', p_pic,
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'po_number',        po_number,
        'site',             site,
        'vendor',           vendor,
        'vendor_name',      vendor_name,
        'product',          product,
        'po_amount',        po_amount,
        'document_date',    document_date,
        'tuyen',            tuyen,
        'original_note',    original_note,
        'confirmed_amount', confirmed_amount,
        'confirm_note',     confirm_note,
        'time_stamp',       time_stamp,
        'image',            image,
        'pic_comment',      pic_comment,
        'pic_status',       pic_status,
        'store_name',       store_name,
        'cht',              cht,
        'sdt_cht',          sdt_cht,
        'qlkv',             qlkv,
        'sdt_qlkv',         sdt_qlkv,
        'kstt',             kstt
      ))
      FROM gr_mapped
      WHERE LOWER(BTRIM(kstt)) = LOWER(BTRIM(p_pic))
    ), '[]'::jsonb)
  );
$$;

-- ── 4. get_qlkv_gr: filter qua gr_mapped + id column động ───────────────────
-- Dynamic SQL chỉ còn dùng để chọn tên cột id (qlkv_id/gdv_id/gdm_id/gdc_id).
-- JOIN stores đã được xử lý trong view gr_mapped.

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
          'po_number',        po_number,
          'site',             site,
          'vendor',           vendor,
          'vendor_name',      vendor_name,
          'product',          product,
          'po_amount',        po_amount,
          'document_date',    document_date,
          'tuyen',            tuyen,
          'original_note',    original_note,
          'confirmed_amount', confirmed_amount,
          'confirm_note',     confirm_note,
          'time_stamp',       time_stamp,
          'image',            image,
          'pic_comment',      pic_comment,
          'pic_status',       pic_status,
          'store_name',       store_name,
          'cht',              cht,
          'sdt_cht',          sdt_cht,
          'qlkv',             qlkv,
          'sdt_qlkv',         sdt_qlkv,
          'kstt',             kstt
        ))
        FROM gr_mapped
        WHERE LOWER(BTRIM(%I)) = LOWER(BTRIM(%L))
      ), '[]'::jsonb)
    )
  $q$, p_username, v_role, v_idcol, p_username)
  INTO v_result;

  RETURN v_result;
END;
$$;

-- ── 5. admin_replace_table: fill gr_records.pic từ stores.kstt ───────────────
-- Cũ: fill từ stocks.pic (sai vì stocks.pic không đáng tin cậy).
-- Mới: fill từ stores.kstt — source of truth.

CREATE OR REPLACE FUNCTION admin_replace_table(p_password text, p_table text, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inserted int;
BEGIN
  IF NOT admin_check(p_password) THEN
    RETURN jsonb_build_object('error', 'Sai mật khẩu admin');
  END IF;
  IF p_table NOT IN ('stocks', 'stores', 'pic', 'qlkv', 'gr_records') THEN
    RETURN jsonb_build_object('error', 'Bảng không hợp lệ: ' || p_table);
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('error', 'Dữ liệu rows không hợp lệ');
  END IF;

  EXECUTE FORMAT('TRUNCATE TABLE %I', p_table);
  EXECUTE FORMAT(
    'INSERT INTO %1$I SELECT * FROM jsonb_populate_recordset(null::%1$I, $1)',
    p_table
  ) USING p_rows;

  IF p_table = 'gr_records' THEN
    UPDATE gr_records g
    SET pic = COALESCE(NULLIF(BTRIM(st.kstt), ''), g.pic)
    FROM stores st
    WHERE LOWER(BTRIM(g.site)) = LOWER(BTRIM(st.store));
  END IF;

  EXECUTE FORMAT('SELECT COUNT(*) FROM %I', p_table) INTO v_inserted;
  RETURN jsonb_build_object('success', true, 'table', p_table, 'inserted', v_inserted);
END;
$$;
