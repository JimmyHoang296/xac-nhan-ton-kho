// Chạy: node test.mjs
const API_URL = 'https://script.google.com/macros/s/AKfycbyLl2hJvtLQyoB4aJERmw_Pzd8PPDSrPIEJ_omwJOKTFonEOzm77V7XYc1wuPqufIG1_A/exec';

// Ảnh JPEG 1x1 pixel màu đỏ (base64) — dùng cho test
const TEST_IMAGE_B64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC gABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';

async function get(params) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function post(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  // 1. Lấy danh sách stores
  console.log('\n── GET stores ──');
  const storesRes = await get({ action: 'getStores' });
  if (storesRes.error) { console.error('Lỗi:', storesRes.error); return; }
  console.log(`Tìm thấy ${storesRes.stores.length} cửa hàng`);
  if (!storesRes.stores.length) { console.log('Không có store nào để test.'); return; }

  // Ưu tiên store có lat/long để test location_check
  const firstStore = storesRes.stores.find(s => s.lat && s.long) ?? storesRes.stores[0];
  console.log(`→ Dùng store: ${firstStore.store} - ${firstStore.store_name} (lat=${firstStore.lat}, long=${firstStore.long})`);

  // 2. Lấy stocks của store đầu tiên
  console.log(`\n── GET stocks (store=${firstStore.store}) ──`);
  const stocksRes = await get({ action: 'getStocks', store: firstStore.store });
  if (stocksRes.error) { console.error('Lỗi:', stocksRes.error); return; }
  console.log(`Tìm thấy ${stocksRes.stocks.length} sản phẩm`);

  const pending = stocksRes.stocks.filter(
    s => s.counted_stock === '' || s.counted_stock === null || s.counted_stock === undefined
  );
  if (!pending.length) { console.log('Không còn sản phẩm nào cần xác nhận.'); return; }

  const target = pending[0];
  console.log(`→ Test với: ${target.article} - ${target.article_name} (tồn HT: ${target.stock})`);

  // 3. Submit xác nhận
  console.log('\n── POST confirm ──');
  const confirmRes = await post({
    action: 'confirm',
    store: firstStore.store,
    article: target.article,
    current_stock: 10,
    counted_stock: 8,
    note: '[TEST] submit tự động',
    // Gửi tọa độ cách CH ~500m để test location_check
    lat: firstStore.lat ? Number(firstStore.lat) + 0.004 : 10.7769,
    long: firstStore.long ? Number(firstStore.long) + 0.004 : 106.7009,
    image: TEST_IMAGE_B64,
    imageType: 'image/jpeg',
  });

  if (confirmRes.error) {
    console.error('Lỗi:', confirmRes.error);
  } else {
    console.log('✓ Thành công!');
    console.log('  imageUrl:      ', confirmRes.imageUrl ?? '(không có)');
    console.log('  location_check:', confirmRes.location_check !== '' ? `${confirmRes.location_check} mét` : '(trống — store thiếu tọa độ)');
  }
}

main().catch(console.error);
