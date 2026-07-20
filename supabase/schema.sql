-- ============================================================================
-- Stock Confirmation — Supabase schema (Postgres)
-- Chạy 1 lần trong Supabase ▸ SQL Editor.
--
-- Thiết kế:
--   • Mọi cột để kiểu TEXT (mirror Google Sheets — mỗi ô là 1 giá trị chuỗi),
--     giúp import/export Excel round-trip không lỗi ép kiểu. RPC tự cast khi cần.
--   • Bật RLS, KHÔNG cấp policy đọc/ghi trực tiếp cho anon.
--   • Toàn bộ truy cập đi qua RPC SECURITY DEFINER (chạy bằng quyền owner, bỏ qua RLS),
--     chỉ trả về đúng cột cần thiết. Anon chỉ được EXECUTE các function này.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────

drop table if exists stocks      cascade;
drop table if exists stores      cascade;
drop table if exists pic         cascade;
drop table if exists qlkv        cascade;
drop table if exists app_config  cascade;

create table stocks (
  store          text,
  store_name     text,
  article        text,
  article_name   text,
  thung          text,
  risk           text,
  history        text,
  stock_day      text,
  stock          text,
  current_stock  text,
  counted_stock  text,
  note           text,
  lat            text,
  long           text,
  stock_check    text,
  time_stamp     text,
  location_check text,
  image          text,
  pic_status     text,
  pic_comment    text
);

create index stocks_store_idx   on stocks (store);
create index stocks_pic_idx     on stocks (pic);
create index stocks_sa_idx      on stocks (store, article);

create table stores (
  store      text,
  store_name text,
  lat        text,
  long       text,
  cht        text,
  sdt_cht    text,
  qlkv       text,
  qlkv_id    text,
  sdt_qlkv   text,
  kstt       text,
  gdv        text,
  gdv_id     text,
  gdm        text,
  gdm_id     text,
  gdc        text,
  gdc_id     text
);

create index stores_store_idx on stores (store);

create table pic (
  pic      text,
  password text
);

create table qlkv (
  username text,
  name     text,
  role     text
);

create table app_config (
  key   text primary key,
  value text
);

-- Mật khẩu trang Admin — ĐỔI giá trị này sau khi chạy schema.
insert into app_config (key, value) values ('admin_password', 'changeme')
  on conflict (key) do nothing;

-- ── RLS: bật và chặn truy cập trực tiếp (không tạo policy nào cho anon) ───────

alter table stocks      enable row level security;
alter table stores      enable row level security;
alter table pic         enable row level security;
alter table qlkv        enable row level security;
alter table app_config  enable row level security;

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- Ép text → double precision an toàn (rỗng/không hợp lệ → null)
create or replace function num(t text)
returns double precision language sql immutable as $$
  select case when t is null or btrim(t) = '' then null
              else (replace(btrim(t), ',', '.'))::double precision end
$$;

-- Haversine — khoảng cách (mét), thay cho haversineDistance trong Code.js
create or replace function haversine_m(lat1 double precision, lon1 double precision,
                                       lat2 double precision, lon2 double precision)
returns double precision language sql immutable as $$
  select round(
    6371000 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lon2 - lon1) / 2), 2)
    ))
  )
$$;

-- Kiểm tra mật khẩu admin
create or replace function admin_check(p_password text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from app_config
    where key = 'admin_password' and value = p_password
  )
$$;

-- ── Read RPCs ───────────────────────────────────────────────────────────────

create or replace function get_stores()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('stores', coalesce(jsonb_agg(
    jsonb_build_object('store', store, 'store_name', store_name, 'lat', lat, 'long', long)
  ), '[]'::jsonb))
  from stores
  where store is not null and store <> '';
$$;

create or replace function get_stocks_by_store(p_store text)
returns jsonb language sql security definer set search_path = public as $$
  with st as (
    select store_name from stores where store::text = p_store::text limit 1
  )
  select case
    when not exists (select 1 from st) then jsonb_build_object('error', 'Store not found')
    else jsonb_build_object(
      'store', p_store,
      'store_name', (select store_name from st),
      'stocks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'article', article, 'article_name', article_name, 'stock_day', stock_day,
          'stock', stock, 'current_stock', current_stock,
          'counted_stock', counted_stock, 'note', note, 'thung', thung, 'risk', risk,
          'history', history
        ))
        from stocks where store::text = p_store::text
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function get_pic_stocks(p_pic text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'pic', p_pic,
    'stocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'store', s.store, 'article', s.article, 'article_name', s.article_name,
        'stock_day', s.stock_day, 'stock', s.stock, 'current_stock', s.current_stock,
        'counted_stock', s.counted_stock, 'note', s.note, 'lat', s.lat, 'long', s.long,
        'image', s.image, 'time_stamp', s.time_stamp, 'location_check', s.location_check,
        'pic_comment', s.pic_comment, 'pic_status', s.pic_status, 'thung', s.thung, 'risk', s.risk,
        'history', coalesce(s.history, ''),
        'store_name', coalesce(st.store_name, ''), 'store_lat', coalesce(st.lat, ''),
        'store_long', coalesce(st.long, ''), 'cht', coalesce(st.cht, ''),
        'sdt_cht', coalesce(st.sdt_cht, ''), 'qlkv', coalesce(st.qlkv, ''),
        'sdt_qlkv', coalesce(st.sdt_qlkv, '')
      ))
      from stores st
      join stocks s on s.store::text = st.store::text
      where btrim(st.kstt) = btrim(p_pic)
    ), '[]'::jsonb)
  );
$$;

create or replace function get_qlkv_stocks(p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_role  text;
  v_idcol text;
  v_result jsonb;
begin
  select coalesce(nullif(lower(btrim(role)), ''), 'qlkv') into v_role
  from qlkv where lower(btrim(username)) = lower(btrim(p_username)) limit 1;
  if v_role is null then v_role := 'qlkv'; end if;

  v_idcol := case v_role
    when 'gdv' then 'gdv_id'
    when 'gdm' then 'gdm_id'
    when 'gdc' then 'gdc_id'
    else 'qlkv_id'
  end;

  execute format($q$
    select jsonb_build_object(
      'username', %L, 'role', %L,
      'stocks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'store', s.store, 'store_name', st.store_name, 'article', s.article,
          'article_name', s.article_name, 'stock_day', s.stock_day, 'stock', s.stock,
          'current_stock', s.current_stock, 'counted_stock', s.counted_stock,
          'note', s.note, 'lat', s.lat, 'long', s.long, 'image', s.image,
          'time_stamp', s.time_stamp, 'location_check', s.location_check, 'thung', s.thung,
          'risk', s.risk, 'history', coalesce(s.history, ''), 'store_lat', st.lat, 'store_long', st.long,
          'cht', st.cht, 'sdt_cht', st.sdt_cht, 'qlkv', st.qlkv, 'qlkv_id', st.qlkv_id,
          'sdt_qlkv', st.sdt_qlkv, 'gdv', st.gdv, 'gdv_id', st.gdv_id, 'gdm', st.gdm,
          'gdm_id', st.gdm_id, 'gdc', st.gdc, 'gdc_id', st.gdc_id
        ))
        from stores st
        join stocks s on s.store::text = st.store::text
        where lower(btrim(st.%I)) = lower(btrim(%L))
      ), '[]'::jsonb)
    )
  $q$, p_username, v_role, v_idcol, p_username)
  into v_result;

  return v_result;
end;
$$;

create or replace function get_progress()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'stocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'store', s.store, 'pic', coalesce(st.kstt, ''),
        'counted_stock', s.counted_stock, 'pic_status', coalesce(s.pic_status, '')
      ))
      from stocks s
      left join stores st on st.store::text = s.store::text
      where s.store is not null and s.store <> ''
    ), '[]'::jsonb),
    'storeMap', coalesce((
      select jsonb_object_agg(store, jsonb_build_object(
        'store_name', coalesce(store_name, ''), 'kstt', coalesce(kstt, ''),
        'qlkv', coalesce(qlkv, '')
      ))
      from stores where store is not null and store <> ''
    ), '{}'::jsonb)
  );
$$;

-- ── Auth RPCs ───────────────────────────────────────────────────────────────

create or replace function pic_login(p_pic text, p_password text)
returns jsonb language sql security definer set search_path = public as $$
  select case
    when exists (
      select 1 from pic
      where btrim(pic) = btrim(p_pic) and btrim(password) = btrim(p_password)
    )
    then jsonb_build_object('success', true, 'pic', btrim(p_pic))
    else jsonb_build_object('error', 'Sai tên PIC hoặc mật khẩu')
  end;
$$;

create or replace function qlkv_login(p_username text)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'success', true,
      'username', btrim(username),
      'name', btrim(name),
      'role', coalesce(nullif(lower(btrim(role)), ''), 'qlkv')
    )
    from qlkv
    where lower(btrim(username)) = lower(btrim(p_username))
    limit 1
  ), jsonb_build_object('error', 'Không tìm thấy tài khoản'));
$$;

-- ── Write RPCs ──────────────────────────────────────────────────────────────

-- p_image_urls: mảng URL ảnh đã upload sẵn lên Cloudinary từ trình duyệt
create or replace function confirm_stock(
  p_store text, p_article text, p_current_stock text, p_counted_stock text,
  p_note text, p_lat text, p_long text, p_image_urls text[]
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_exists boolean;
  v_loc text := '';
  v_slat double precision;
  v_slong double precision;
  v_check text;
begin
  if p_store is null or p_article is null or p_counted_stock is null or btrim(p_counted_stock) = '' then
    return jsonb_build_object('error', 'Missing required fields: store, article, counted_stock');
  end if;

  select true into v_exists from stocks
  where store::text = p_store::text and article::text = p_article::text limit 1;
  if not v_exists then
    return jsonb_build_object('error', 'Stock record not found');
  end if;

  v_check := (coalesce(num(p_counted_stock), 0) - coalesce(num(p_current_stock), 0))::text;

  -- location_check theo Haversine nếu có GPS user và GPS cửa hàng
  if num(p_lat) is not null and num(p_long) is not null then
    select num(lat), num(long) into v_slat, v_slong
    from stores where store::text = p_store::text limit 1;
    if v_slat is not null and v_slong is not null then
      v_loc := haversine_m(num(p_lat), num(p_long), v_slat, v_slong)::text;
    end if;
  end if;

  update stocks set
    current_stock  = coalesce(p_current_stock, ''),
    counted_stock  = p_counted_stock,
    note           = coalesce(p_note, ''),
    lat            = coalesce(p_lat, ''),
    long           = coalesce(p_long, ''),
    stock_check    = v_check,
    time_stamp     = to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS'),
    location_check = v_loc,
    image          = array_to_string(coalesce(p_image_urls, '{}'), ',')
  where store::text = p_store::text and article::text = p_article::text;

  return jsonb_build_object('success', true,
    'imageUrls', to_jsonb(coalesce(p_image_urls, '{}')),
    'location_check', v_loc);
end;
$$;

create or replace function save_pic_comment(
  p_pic text, p_store text, p_article text, p_comment text, p_pic_status text
)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_pic is null or p_store is null or p_article is null then
    return jsonb_build_object('error', 'Missing required fields');
  end if;
  update stocks set
    pic_comment = coalesce(p_comment, ''),
    pic_status  = coalesce(p_pic_status, '')
  where store::text = p_store::text and article::text = p_article::text;
  if not found then
    return jsonb_build_object('error', 'Stock record not found');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

-- p_items: jsonb array [{store, article, comment, pic_status}]
create or replace function batch_save_pic_comment(p_pic text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item   jsonb;
  v_saved  int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_key    text;
begin
  if p_pic is null or p_items is null or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('error', 'Missing pic or items');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_key := btrim(v_item->>'store') || '-' || btrim(v_item->>'article');
    update stocks set
      pic_status  = coalesce(v_item->>'pic_status', ''),
      pic_comment = coalesce(v_item->>'comment', '')
    where btrim(store) = btrim(v_item->>'store')
      and btrim(article) = btrim(v_item->>'article');
    if found then
      v_saved := v_saved + 1;
    else
      v_errors := v_errors || to_jsonb(v_key || ' not found');
    end if;
  end loop;

  return jsonb_build_object('success', true, 'saved', v_saved,
    'total', jsonb_array_length(p_items), 'errors', v_errors);
end;
$$;

-- ── Admin RPCs (cổng mật khẩu) ───────────────────────────────────────────────

create or replace function admin_export_all(p_password text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not admin_check(p_password) then
    return jsonb_build_object('error', 'Sai mật khẩu admin');
  end if;
  return jsonb_build_object(
    'stocks', coalesce((select jsonb_agg(to_jsonb(s)) from stocks s), '[]'::jsonb),
    'stores', coalesce((select jsonb_agg(to_jsonb(s)) from stores s), '[]'::jsonb),
    'pic',    coalesce((select jsonb_agg(to_jsonb(p)) from pic p), '[]'::jsonb),
    'qlkv',   coalesce((select jsonb_agg(to_jsonb(q)) from qlkv q), '[]'::jsonb)
  );
end;
$$;

-- Hàm dùng chung: thay thế toàn bộ 1 bảng từ jsonb array các dòng.
-- p_table chỉ nhận whitelist để tránh SQL injection.
create or replace function admin_replace_table(p_password text, p_table text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inserted int;
begin
  if not admin_check(p_password) then
    return jsonb_build_object('error', 'Sai mật khẩu admin');
  end if;
  if p_table not in ('stocks', 'stores', 'pic', 'qlkv') then
    return jsonb_build_object('error', 'Bảng không hợp lệ: ' || p_table);
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('error', 'Dữ liệu rows không hợp lệ');
  end if;

  execute format('truncate table %I', p_table);
  execute format(
    'insert into %1$I select * from jsonb_populate_recordset(null::%1$I, $1)',
    p_table
  ) using p_rows;

  execute format('select count(*) from %I', p_table) into v_inserted;
  return jsonb_build_object('success', true, 'table', p_table, 'inserted', v_inserted);
end;
$$;

-- Thay thế bảng stocks từ Excel format mới (history, không còn pic trong stocks).
create or replace function admin_upsert_stocks(p_password text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not admin_check(p_password) then
    return jsonb_build_object('error', 'Sai mật khẩu admin');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('error', 'Dữ liệu rows không hợp lệ');
  end if;

  truncate table stocks;

  insert into stocks (
    store, store_name, article, article_name, thung, risk, history,
    stock_day, stock, current_stock, counted_stock, note, lat, long,
    stock_check, time_stamp, location_check, image, pic_status, pic_comment
  )
  select
    r->>'store', r->>'store_name', r->>'article', r->>'article_name',
    r->>'thung', r->>'risk', r->>'history',
    r->>'stock_day', r->>'stock',
    coalesce(nullif(r->>'current_stock',  ''), ''),
    coalesce(nullif(r->>'counted_stock',  ''), ''),
    coalesce(nullif(r->>'note',           ''), ''),
    coalesce(nullif(r->>'lat',            ''), ''),
    coalesce(nullif(r->>'long',           ''), ''),
    coalesce(nullif(r->>'stock_check',    ''), ''),
    coalesce(nullif(r->>'time_stamp',     ''), ''),
    coalesce(nullif(r->>'location_check', ''), ''),
    coalesce(nullif(r->>'image',          ''), ''),
    coalesce(nullif(r->>'pic_status',     ''), ''),
    coalesce(nullif(r->>'pic_comment',    ''), '')
  from jsonb_array_elements(p_rows) r;

  select count(*) into v_count from stocks;
  return jsonb_build_object('success', true, 'table', 'stocks', 'inserted', v_count);
end;
$$;

-- ── Grants: anon chỉ được EXECUTE các RPC (không SELECT bảng) ─────────────────

grant execute on function get_stores()                                   to anon;
grant execute on function get_stocks_by_store(text)                      to anon;
grant execute on function get_pic_stocks(text)                           to anon;
grant execute on function get_qlkv_stocks(text)                          to anon;
grant execute on function get_progress()                                 to anon;
grant execute on function pic_login(text, text)                          to anon;
grant execute on function qlkv_login(text)                               to anon;
grant execute on function confirm_stock(text, text, text, text, text, text, text, text[]) to anon;
grant execute on function save_pic_comment(text, text, text, text, text) to anon;
grant execute on function batch_save_pic_comment(text, jsonb)            to anon;
grant execute on function admin_check(text)                              to anon;
grant execute on function admin_export_all(text)                         to anon;
grant execute on function admin_replace_table(text, text, jsonb)         to anon;
grant execute on function admin_upsert_stocks(text, jsonb)               to anon;
