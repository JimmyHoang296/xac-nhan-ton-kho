// Test backend Supabase (RPC) — chạy: node test-supabase.mjs
// Đọc biến từ frontend/.env, gọi vài RPC để xác minh schema đã deploy & dữ liệu đã nạp.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── Load .env thủ công (node không tự inject như Vite) ──
const env = {};
for (const line of readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].trim();
}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
console.log('Supabase URL:', url);
const supabase = createClient(url, key, { auth: { persistSession: false } });

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name} ${extra}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(`${name}: ${error.message}`);
  if (data && data.error) throw new Error(`${name}: ${data.error}`);
  return data;
}

async function main() {
  // 1. get_stores
  console.log('\n── get_stores ──');
  const stores = await rpc('get_stores', {});
  ok('trả về mảng stores', Array.isArray(stores?.stores), `(${stores?.stores?.length ?? 0} cửa hàng)`);
  if (!stores.stores?.length) { console.log('  ⚠ Chưa có dữ liệu stores — hãy nạp Excel qua /admin trước.'); return; }

  const store = stores.stores.find(s => s.lat && s.long) ?? stores.stores[0];
  console.log(`  → store mẫu: ${store.store} - ${store.store_name}`);

  // 2. get_stocks_by_store
  console.log('\n── get_stocks_by_store ──');
  const byStore = await rpc('get_stocks_by_store', { p_store: String(store.store) });
  ok('có store_name', !!byStore.store_name, `(${byStore.store_name})`);
  ok('có mảng stocks', Array.isArray(byStore.stocks), `(${byStore.stocks?.length ?? 0} sản phẩm)`);

  // 3. get_progress
  console.log('\n── get_progress ──');
  const prog = await rpc('get_progress', {});
  ok('có stocks', Array.isArray(prog.stocks), `(${prog.stocks?.length ?? 0})`);
  ok('có storeMap', prog.storeMap && typeof prog.storeMap === 'object');

  // 4. get_pic_stocks (lấy 1 pic bất kỳ từ stocks nếu có)
  const samplePic = byStore.stocks?.find(s => s.pic)?.pic;
  if (samplePic) {
    console.log(`\n── get_pic_stocks (pic=${samplePic}) ──`);
    const picData = await rpc('get_pic_stocks', { p_pic: String(samplePic) });
    ok('có mảng stocks', Array.isArray(picData.stocks), `(${picData.stocks?.length ?? 0})`);
    ok('stock có store_name join', picData.stocks?.length ? 'store_name' in picData.stocks[0] : true);
  }

  // 5. Bảo mật: anon KHÔNG được đọc thẳng bảng pic (chứa mật khẩu)
  console.log('\n── RLS: chặn đọc trực tiếp bảng pic ──');
  const direct = await supabase.from('pic').select('*').limit(1);
  ok('select thẳng bảng pic bị chặn (RLS)', !!direct.error || (direct.data?.length ?? 0) === 0,
     direct.error ? `(${direct.error.message})` : '(trả 0 dòng)');

  console.log(`\n=== Kết quả: ${pass} pass, ${fail} fail ===`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('\n✗ LỖI:', e.message); process.exit(1); });
