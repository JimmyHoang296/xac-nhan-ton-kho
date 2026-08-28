-- ============================================================================
-- Abnormal Stocks — Migration
-- Chạy trong Supabase ▸ SQL Editor (không DROP bảng cũ).
-- Thêm bảng abnormal_stocks + RPC cho tính năng "Xác nhận tồn kho bất thường".
--
-- Khác với gr_records (Admin nạp Excel định kỳ), bảng này do PIC tự upload danh
-- sách mã hàng cần CH xác nhận lại vì bất thường — không gắn chu kỳ nạp hàng tuần.
-- Mỗi lần PIC upload sẽ CỘNG DỒN (append), trùng store+article thì bỏ qua.
-- ============================================================================

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS abnormal_stocks (
  store          text DEFAULT '',
  store_name     text DEFAULT '',
  article        text DEFAULT '',
  article_name   text DEFAULT '',
  stock          text DEFAULT '',   -- Tồn hệ thống, PIC nhập tay lúc upload
  reason         text DEFAULT '',   -- Lý do bất thường, PIC nhập lúc upload
  uploaded_by    text DEFAULT '',
  uploaded_at    text DEFAULT '',
  -- Trường nhân viên CH điền khi xác nhận (mirror stocks)
  current_stock  text DEFAULT '',
  counted_stock  text DEFAULT '',
  note           text DEFAULT '',
  lat            text DEFAULT '',
  long           text DEFAULT '',
  stock_check    text DEFAULT '',
  time_stamp     text DEFAULT '',
  location_check text DEFAULT '',
  image          text DEFAULT '',
  -- PIC thẩm định
  pic_comment    text DEFAULT '',
  pic_status     text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS abnormal_stocks_store_idx ON abnormal_stocks (store);
CREATE INDEX IF NOT EXISTS abnormal_stocks_sa_idx    ON abnormal_stocks (store, article);

ALTER TABLE abnormal_stocks ENABLE ROW LEVEL SECURITY;
-- Không cấp policy nào cho anon — mọi truy cập đi qua RPC SECURITY DEFINER bên dưới.

-- ── Read RPCs ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_abnormal_by_store(p_store text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'store', p_store,
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'store', store, 'article', article, 'article_name', article_name,
        'stock', stock, 'reason', reason,
        'current_stock', current_stock, 'counted_stock', counted_stock, 'note', note,
        'stock_check', stock_check, 'time_stamp', time_stamp, 'location_check', location_check,
        'image', image, 'pic_comment', pic_comment, 'pic_status', pic_status
      ))
      FROM abnormal_stocks WHERE store::text = p_store::text
    ), '[]'::jsonb)
  );
$$;

-- Khác với get_pic_stocks/get_pic_gr (lọc theo stores.kstt — CH được PHÂN CÔNG cho PIC), ở đây
-- lọc theo NGƯỜI ĐÃ UPLOAD (abnormal_stocks.uploaded_by) — ai upload danh sách thì thấy trên
-- trang của người đó, không phụ thuộc CH đó do PIC nào phụ trách.
-- Match trực tiếp p_pic (username) với uploaded_by (đã lưu là username lúc upload); fallback
-- tra qua pic.name cho trường hợp admin drill-down (truyền thẳng tên kstt thay vì username).
CREATE OR REPLACE FUNCTION get_pic_abnormal(p_pic text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN jsonb_build_object(
    'pic', p_pic,
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'store', a.store, 'article', a.article, 'article_name', a.article_name,
        'stock', a.stock, 'reason', a.reason, 'uploaded_by', a.uploaded_by, 'uploaded_at', a.uploaded_at,
        'current_stock', a.current_stock, 'counted_stock', a.counted_stock, 'note', a.note,
        'lat', a.lat, 'long', a.long, 'image', a.image, 'time_stamp', a.time_stamp,
        'location_check', a.location_check,
        'pic_comment', a.pic_comment, 'pic_status', a.pic_status,
        'store_name', COALESCE(st.store_name, ''), 'store_lat', COALESCE(st.lat, ''),
        'store_long', COALESCE(st.long, ''), 'cht', COALESCE(st.cht, ''),
        'sdt_cht', COALESCE(st.sdt_cht, ''), 'qlkv', COALESCE(st.qlkv, ''),
        'sdt_qlkv', COALESCE(st.sdt_qlkv, '')
      ))
      FROM abnormal_stocks a
      LEFT JOIN stores st ON st.store::text = a.store::text
      WHERE normalize(btrim(a.uploaded_by), nfc) = normalize(btrim(p_pic), nfc)
         OR normalize(btrim(a.uploaded_by), nfc) IN (
              SELECT normalize(btrim(pic), nfc) FROM pic WHERE normalize(btrim(name), nfc) = normalize(btrim(p_pic), nfc)
            )
    ), '[]'::jsonb)
  );
END;
$$;

-- ── Write RPCs ──────────────────────────────────────────────────────────────

-- p_image_urls: mảng URL ảnh đã upload sẵn (Google Drive qua GAS, giống confirm_stock/confirm_gr)
CREATE OR REPLACE FUNCTION confirm_abnormal_stock(
  p_store text, p_article text, p_current_stock text, p_counted_stock text,
  p_note text, p_lat text, p_long text, p_image_urls text[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exists boolean;
  v_loc text := '';
  v_slat double precision;
  v_slong double precision;
  v_check text;
BEGIN
  IF p_store IS NULL OR p_article IS NULL OR p_counted_stock IS NULL OR btrim(p_counted_stock) = '' THEN
    RETURN jsonb_build_object('error', 'Missing required fields: store, article, counted_stock');
  END IF;

  SELECT true INTO v_exists FROM abnormal_stocks
  WHERE store::text = p_store::text AND article::text = p_article::text LIMIT 1;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('error', 'Abnormal stock record not found');
  END IF;

  v_check := (COALESCE(num(p_counted_stock), 0) - COALESCE(num(p_current_stock), 0))::text;

  IF num(p_lat) IS NOT NULL AND num(p_long) IS NOT NULL THEN
    SELECT num(lat), num(long) INTO v_slat, v_slong FROM stores WHERE store::text = p_store::text LIMIT 1;
    IF v_slat IS NOT NULL AND v_slong IS NOT NULL THEN
      v_loc := haversine_m(num(p_lat), num(p_long), v_slat, v_slong)::text;
    END IF;
  END IF;

  UPDATE abnormal_stocks SET
    current_stock  = COALESCE(p_current_stock, ''),
    counted_stock  = p_counted_stock,
    note           = COALESCE(p_note, ''),
    lat            = COALESCE(p_lat, ''),
    long           = COALESCE(p_long, ''),
    stock_check    = v_check,
    time_stamp     = to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS'),
    location_check = v_loc,
    image          = array_to_string(COALESCE(p_image_urls, '{}'), ',')
  WHERE store::text = p_store::text AND article::text = p_article::text;

  RETURN jsonb_build_object('success', true,
    'imageUrls', to_jsonb(COALESCE(p_image_urls, '{}')),
    'location_check', v_loc);
END;
$$;

CREATE OR REPLACE FUNCTION save_abnormal_pic_comment(
  p_pic text, p_store text, p_article text, p_comment text, p_pic_status text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_pic IS NULL OR p_store IS NULL OR p_article IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing required fields');
  END IF;
  UPDATE abnormal_stocks SET
    pic_comment = COALESCE(p_comment, ''),
    pic_status  = COALESCE(p_pic_status, '')
  WHERE store::text = p_store::text AND article::text = p_article::text;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Abnormal stock record not found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- p_items: jsonb array [{store, article, comment, pic_status}]
CREATE OR REPLACE FUNCTION batch_save_abnormal_pic_comment(p_pic text, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item   jsonb;
  v_saved  int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_key    text;
BEGIN
  IF p_pic IS NULL OR p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'Missing pic or items');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_key := btrim(v_item->>'store') || '-' || btrim(v_item->>'article');
    UPDATE abnormal_stocks SET
      pic_status  = COALESCE(v_item->>'pic_status', ''),
      pic_comment = COALESCE(v_item->>'comment', '')
    WHERE btrim(store) = btrim(v_item->>'store')
      AND btrim(article) = btrim(v_item->>'article');
    IF FOUND THEN
      v_saved := v_saved + 1;
    ELSE
      v_errors := v_errors || to_jsonb(v_key || ' not found');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'saved', v_saved,
    'total', jsonb_array_length(p_items), 'errors', v_errors);
END;
$$;

-- PIC upload danh sách mã hàng bất thường (cộng dồn — bỏ qua nếu store+article đã có sẵn).
-- p_rows: jsonb array [{store, article, article_name, stock, reason}]
CREATE OR REPLACE FUNCTION pic_upload_abnormal_stocks(p_pic text, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row      jsonb;
  v_store    text;
  v_article  text;
  v_store_name text;
  v_inserted int := 0;
  v_skipped  int := 0;
  v_errors   jsonb := '[]'::jsonb;
BEGIN
  IF p_pic IS NULL OR btrim(p_pic) = '' THEN
    RETURN jsonb_build_object('error', 'Thiếu thông tin PIC');
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN jsonb_build_object('error', 'Danh sách rỗng hoặc không hợp lệ');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_store   := btrim(COALESCE(v_row->>'store', ''));
    v_article := btrim(COALESCE(v_row->>'article', ''));

    IF v_store = '' OR v_article = '' THEN
      v_errors := v_errors || to_jsonb('Thiếu mã CH hoặc mã SP: ' || (v_row->>'store') || '/' || (v_row->>'article'));
      CONTINUE;
    END IF;

    SELECT store_name INTO v_store_name FROM stores WHERE btrim(store) = v_store LIMIT 1;
    IF v_store_name IS NULL THEN
      v_errors := v_errors || to_jsonb('Không tìm thấy cửa hàng: ' || v_store);
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM abnormal_stocks WHERE btrim(store) = v_store AND btrim(article) = v_article) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO abnormal_stocks (
      store, store_name, article, article_name, stock, reason, uploaded_by, uploaded_at
    ) VALUES (
      v_store, v_store_name, v_article,
      btrim(COALESCE(v_row->>'article_name', '')),
      btrim(COALESCE(v_row->>'stock', '')),
      btrim(COALESCE(v_row->>'reason', '')),
      btrim(p_pic),
      to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS')
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'inserted', v_inserted, 'skipped', v_skipped, 'errors', v_errors);
END;
$$;

-- PIC xoá dòng nhập nhầm — chỉ cho xoá khi CH CHƯA xác nhận (tránh mất dữ liệu CH đã nộp).
CREATE OR REPLACE FUNCTION delete_abnormal_stock(p_pic text, p_store text, p_article text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_counted text;
BEGIN
  IF p_store IS NULL OR p_article IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing required fields');
  END IF;

  SELECT counted_stock INTO v_counted FROM abnormal_stocks
  WHERE store::text = p_store::text AND article::text = p_article::text LIMIT 1;

  IF v_counted IS NULL THEN
    RETURN jsonb_build_object('error', 'Abnormal stock record not found');
  END IF;
  IF v_counted <> '' THEN
    RETURN jsonb_build_object('error', 'Cửa hàng đã xác nhận, không thể xoá');
  END IF;

  DELETE FROM abnormal_stocks WHERE store::text = p_store::text AND article::text = p_article::text;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── Admin: thêm abnormal_stocks vào export/import ────────────────────────────

CREATE OR REPLACE FUNCTION admin_export_all(p_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
SET statement_timeout = '120s' AS $$
BEGIN
  IF NOT admin_check(p_password) THEN
    RETURN jsonb_build_object('error', 'Sai mật khẩu admin');
  END IF;
  RETURN jsonb_build_object(
    'stocks',          COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM stocks s), '[]'::jsonb),
    'stores',          COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM stores s), '[]'::jsonb),
    'pic',             COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM pic p), '[]'::jsonb),
    'qlkv',            COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM qlkv q), '[]'::jsonb),
    'gr_records',      COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM gr_records g), '[]'::jsonb),
    'abnormal_stocks', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM abnormal_stocks a), '[]'::jsonb)
  );
END;
$$;

-- Mirror bản admin_replace_table hiện hành (gr_refactor.sql — fill gr_records.pic từ
-- stores.kstt, không dùng stocks.pic vì không đáng tin cậy). Chỉ thêm 'abnormal_stocks'
-- vào whitelist — bảng này không cần auto-fill vì lọc theo PIC đi qua JOIN stores.kstt.
CREATE OR REPLACE FUNCTION admin_replace_table(p_password text, p_table text, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
SET statement_timeout = '120s' AS $$
DECLARE
  v_inserted int;
BEGIN
  IF NOT admin_check(p_password) THEN
    RETURN jsonb_build_object('error', 'Sai mật khẩu admin');
  END IF;
  IF p_table NOT IN ('stocks', 'stores', 'pic', 'qlkv', 'gr_records', 'abnormal_stocks') THEN
    RETURN jsonb_build_object('error', 'Bảng không hợp lệ: ' || p_table);
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('error', 'Dữ liệu rows không hợp lệ');
  END IF;

  EXECUTE format('truncate table %I', p_table);
  EXECUTE format(
    'insert into %1$I select * from jsonb_populate_recordset(null::%1$I, $1)',
    p_table
  ) USING p_rows;

  IF p_table = 'gr_records' THEN
    UPDATE gr_records g
    SET pic = COALESCE(NULLIF(btrim(st.kstt), ''), g.pic)
    FROM stores st
    WHERE lower(btrim(g.site)) = lower(btrim(st.store));
  END IF;

  EXECUTE format('select count(*) from %I', p_table) INTO v_inserted;
  RETURN jsonb_build_object('success', true, 'table', p_table, 'inserted', v_inserted);
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION get_abnormal_by_store(text)                              TO anon;
GRANT EXECUTE ON FUNCTION get_pic_abnormal(text)                                   TO anon;
GRANT EXECUTE ON FUNCTION confirm_abnormal_stock(text, text, text, text, text, text, text, text[]) TO anon;
GRANT EXECUTE ON FUNCTION save_abnormal_pic_comment(text, text, text, text, text)   TO anon;
GRANT EXECUTE ON FUNCTION batch_save_abnormal_pic_comment(text, jsonb)              TO anon;
GRANT EXECUTE ON FUNCTION pic_upload_abnormal_stocks(text, jsonb)                   TO anon;
GRANT EXECUTE ON FUNCTION delete_abnormal_stock(text, text, text)                   TO anon;
