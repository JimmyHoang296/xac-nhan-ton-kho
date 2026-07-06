-- ============================================================================
-- GR Records — Migration
-- Chạy trong Supabase ▸ SQL Editor (không DROP bảng cũ).
-- Thêm bảng gr_records và cập nhật các RPC admin.
-- ============================================================================

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gr_records (
  tuyen            text DEFAULT '',
  vendor           text DEFAULT '',
  vendor_name      text DEFAULT '',
  po_number        text DEFAULT '',
  site             text DEFAULT '',      -- mã cửa hàng (= stocks.store)
  document_date    text DEFAULT '',
  created_by       text DEFAULT '',
  currency         text DEFAULT 'VND',
  po_amount        text DEFAULT '0',
  product          text DEFAULT '',
  original_note    text DEFAULT '',
  pic              text DEFAULT '',      -- tự điền từ stocks khi import
  -- Trường nhân viên CH điền khi xác nhận
  confirmed_amount text DEFAULT '',
  confirm_note     text DEFAULT '',
  time_stamp       text DEFAULT '',
  lat              text DEFAULT '',
  long             text DEFAULT '',
  image            text DEFAULT '',
  -- PIC thẩm định
  pic_comment      text DEFAULT '',
  pic_status       text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS gr_records_site_idx ON gr_records (site);
CREATE INDEX IF NOT EXISTS gr_records_pic_idx  ON gr_records (pic);
CREATE INDEX IF NOT EXISTS gr_records_po_idx   ON gr_records (po_number, site);

ALTER TABLE gr_records ENABLE ROW LEVEL SECURITY;

-- ── Read RPCs ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_gr_by_store(p_store text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'site', p_store,
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'po_number', po_number, 'vendor', vendor, 'vendor_name', vendor_name,
        'product', product, 'po_amount', po_amount, 'document_date', document_date,
        'tuyen', tuyen, 'original_note', original_note, 'currency', currency,
        'confirmed_amount', confirmed_amount, 'confirm_note', confirm_note,
        'time_stamp', time_stamp, 'image', image,
        'pic_comment', pic_comment, 'pic_status', pic_status
      ))
      FROM gr_records WHERE site::text = p_store::text
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION get_pic_gr(p_pic text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pic', p_pic,
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'po_number', g.po_number, 'site', g.site, 'vendor', g.vendor,
        'vendor_name', g.vendor_name, 'product', g.product, 'po_amount', g.po_amount,
        'document_date', g.document_date, 'tuyen', g.tuyen, 'original_note', g.original_note,
        'confirmed_amount', g.confirmed_amount, 'confirm_note', g.confirm_note,
        'time_stamp', g.time_stamp, 'image', g.image,
        'pic_comment', g.pic_comment, 'pic_status', g.pic_status,
        'store_name', COALESCE(st.store_name, '')
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
          'po_number', g.po_number, 'site', g.site, 'vendor', g.vendor,
          'vendor_name', g.vendor_name, 'product', g.product, 'po_amount', g.po_amount,
          'document_date', g.document_date, 'tuyen', g.tuyen, 'original_note', g.original_note,
          'confirmed_amount', g.confirmed_amount, 'confirm_note', g.confirm_note,
          'time_stamp', g.time_stamp, 'image', g.image,
          'pic_comment', g.pic_comment, 'pic_status', g.pic_status,
          'store_name', COALESCE(st.store_name, '')
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

-- ── Write RPCs ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION confirm_gr(
  p_po_number text, p_site text,
  p_confirmed_amount text, p_note text,
  p_lat text, p_long text, p_image_urls text[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_po_number IS NULL OR p_site IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing required fields');
  END IF;

  UPDATE gr_records SET
    confirmed_amount = COALESCE(p_confirmed_amount, ''),
    confirm_note     = COALESCE(p_note, ''),
    lat              = COALESCE(p_lat, ''),
    long             = COALESCE(p_long, ''),
    image            = array_to_string(COALESCE(p_image_urls, '{}'), ','),
    time_stamp       = to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS')
  WHERE po_number::text = p_po_number::text AND site::text = p_site::text;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'GR record not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION save_gr_pic_comment(
  p_pic text, p_po_number text, p_site text, p_comment text, p_pic_status text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE gr_records SET
    pic_comment = COALESCE(p_comment, ''),
    pic_status  = COALESCE(p_pic_status, '')
  WHERE po_number::text = p_po_number::text AND site::text = p_site::text;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'GR record not found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- p_items: jsonb array [{po_number, site, comment, pic_status}]
CREATE OR REPLACE FUNCTION batch_save_gr_pic_comment(p_pic text, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item   jsonb;
  v_saved  int := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF p_pic IS NULL OR p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'Missing pic or items');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    UPDATE gr_records SET
      pic_status  = COALESCE(v_item->>'pic_status', ''),
      pic_comment = COALESCE(v_item->>'comment', '')
    WHERE BTRIM(po_number) = BTRIM(v_item->>'po_number')
      AND BTRIM(site) = BTRIM(v_item->>'site');
    IF FOUND THEN
      v_saved := v_saved + 1;
    ELSE
      v_errors := v_errors || to_jsonb((v_item->>'po_number') || '-' || (v_item->>'site') || ' not found');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'saved', v_saved,
    'total', jsonb_array_length(p_items), 'errors', v_errors);
END;
$$;

-- ── Updated Admin RPCs ────────────────────────────────────────────────────────

-- Thêm gr_records vào export
CREATE OR REPLACE FUNCTION admin_export_all(p_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT admin_check(p_password) THEN
    RETURN jsonb_build_object('error', 'Sai mật khẩu admin');
  END IF;
  RETURN jsonb_build_object(
    'stocks',     COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM stocks s), '[]'::jsonb),
    'stores',     COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM stores s), '[]'::jsonb),
    'pic',        COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM pic p), '[]'::jsonb),
    'qlkv',       COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM qlkv q), '[]'::jsonb),
    'gr_records', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM gr_records g), '[]'::jsonb)
  );
END;
$$;

-- Thêm gr_records vào whitelist; tự điền cột pic từ bảng stocks sau khi import
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

  -- Tự điền pic cho gr_records từ stocks (1 PIC đại diện mỗi store)
  IF p_table = 'gr_records' THEN
    UPDATE gr_records g
    SET pic = s.pic
    FROM (
      SELECT DISTINCT ON (store) store, pic
      FROM stocks
      WHERE pic IS NOT NULL AND pic <> ''
      ORDER BY store, pic
    ) s
    WHERE s.store::text = g.site::text AND (g.pic IS NULL OR g.pic = '');
  END IF;

  EXECUTE FORMAT('SELECT COUNT(*) FROM %I', p_table) INTO v_inserted;
  RETURN jsonb_build_object('success', true, 'table', p_table, 'inserted', v_inserted);
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_gr_by_store(text)                                     TO anon;
GRANT EXECUTE ON FUNCTION get_pic_gr(text)                                          TO anon;
GRANT EXECUTE ON FUNCTION get_qlkv_gr(text)                                         TO anon;
GRANT EXECUTE ON FUNCTION confirm_gr(text, text, text, text, text, text, text[])    TO anon;
GRANT EXECUTE ON FUNCTION save_gr_pic_comment(text, text, text, text, text)         TO anon;
GRANT EXECUTE ON FUNCTION batch_save_gr_pic_comment(text, jsonb)                    TO anon;
