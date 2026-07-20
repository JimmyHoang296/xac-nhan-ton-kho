-- Hỗ trợ đăng nhập KSTT qua /pic
-- KSTT xem tồn kho và PO theo stores.kstt = username
-- Chạy trong Supabase ▸ SQL Editor

-- 1. Thêm cột type vào bảng pic (rỗng = PIC thường, 'kstt' = KSTT)
ALTER TABLE pic ADD COLUMN IF NOT EXISTS type text DEFAULT '';

-- 2. Cập nhật pic_login trả thêm type
CREATE OR REPLACE FUNCTION pic_login(p_pic text, p_password text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM pic
      WHERE BTRIM(pic) = BTRIM(p_pic) AND BTRIM(password) = BTRIM(p_password)
    )
    THEN jsonb_build_object(
      'success', true,
      'pic',  BTRIM(p_pic),
      'type', COALESCE(NULLIF(BTRIM((SELECT type FROM pic WHERE BTRIM(pic) = BTRIM(p_pic) LIMIT 1)), ''), 'pic')
    )
    ELSE jsonb_build_object('error', 'Sai tên PIC hoặc mật khẩu')
  END;
$$;

-- 3. get_kstt_stocks: tồn kho cho các CH theo stores.kstt
CREATE OR REPLACE FUNCTION get_kstt_stocks(p_kstt text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pic', p_kstt,
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
      JOIN stocks s ON s.store::text = st.store::text
      WHERE BTRIM(st.kstt) = BTRIM(p_kstt)
    ), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION get_kstt_stocks(text) TO anon;

-- 4. get_kstt_gr: phiếu PO cho các CH theo stores.kstt
CREATE OR REPLACE FUNCTION get_kstt_gr(p_kstt text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pic', p_kstt,
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
        'sdt_qlkv',         COALESCE(st.sdt_qlkv, ''),
        'kstt',             COALESCE(st.kstt,     '')
      ))
      FROM stores st
      JOIN gr_records g ON g.site::text = st.store::text
      WHERE BTRIM(st.kstt) = BTRIM(p_kstt)
    ), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION get_kstt_gr(text) TO anon;
