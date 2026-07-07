-- Fix mapping PIC/KSTT: dùng stores.kstt làm source of truth thay vì stocks.pic / gr_records.pic
-- Chạy trong Supabase ▸ SQL Editor

-- ── get_pic_stocks: filter theo stores.kstt thay vì stocks.pic ─────────────
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

-- ── get_pic_gr: filter theo stores.kstt (gr_records.pic rỗng, stores.kstt đầy đủ) ──
-- Dùng BTRIM + LOWER cả hai vế để tránh lỗi khoảng trắng / hoa thường.
CREATE OR REPLACE FUNCTION get_pic_gr(p_pic text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pic', p_pic,
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
      JOIN gr_records g ON LOWER(BTRIM(g.site)) = LOWER(BTRIM(st.store))
      WHERE LOWER(BTRIM(st.kstt)) = LOWER(BTRIM(p_pic))
    ), '[]'::jsonb)
  );
$$;
