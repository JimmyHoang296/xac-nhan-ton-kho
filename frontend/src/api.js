import { supabase } from './supabaseClient';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyPE_f3Mn17IhGLZjL45q9GSqU3vAy7JKlHLlhhdapiTnFKv3jIpymbYQipoj04ysMX/exec';

export async function fetchGrByStore(store) {
  return rpc('get_gr_by_store', { p_store: String(store) });
}

export async function fetchPicGr(pic) {
  return rpc('get_pic_gr', { p_pic: pic });
}

export async function fetchQlkvGr(username) {
  return rpc('get_qlkv_gr', { p_username: username });
}

export async function saveGrPicComment(pic, po_number, site, comment, pic_status) {
  return rpc('save_gr_pic_comment', {
    p_pic: pic, p_po_number: String(po_number), p_site: String(site),
    p_comment: comment, p_pic_status: pic_status,
  });
}

export async function batchSaveGrPicComment(pic, items) {
  return rpc('batch_save_gr_pic_comment', { p_pic: pic, p_items: items });
}

// Gọi RPC Supabase và chuẩn hoá lỗi giống cách cũ (throw Error để UI hiển thị).
async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(error.message || 'Lỗi kết nối máy chủ');
  if (data && data.error) throw new Error(data.error);
  return data;
}

export async function fetchStocks(store) {
  return rpc('get_stocks_by_store', { p_store: String(store) });
}

export async function picLogin(pic, password) {
  return rpc('pic_login', { p_pic: pic, p_password: password });
}

export async function fetchPicStocks(pic) {
  return rpc('get_pic_stocks', { p_pic: pic });
}

export async function savePicComment(pic, store, article, comment, pic_status) {
  return rpc('save_pic_comment', {
    p_pic: pic, p_store: String(store), p_article: String(article),
    p_comment: comment, p_pic_status: pic_status,
  });
}

export async function fetchProgress() {
  return rpc('get_progress', {});
}

export async function fetchAllGr() {
  return rpc('get_all_gr', {});
}

export async function qlkvLogin(username) {
  return rpc('qlkv_login', { p_username: username });
}

export async function fetchQlkvStocks(username) {
  return rpc('get_qlkv_stocks', { p_username: username });
}

export async function batchSavePicComment(pic, items) {
  return rpc('batch_save_pic_comment', { p_pic: pic, p_items: items });
}

export async function submitGrConfirmation(payload) {
  const { po_number, site, confirmed_amount, note, lat, long, images } = payload;

  const imageList = Array.isArray(images) && images.length > 0 ? images.slice(0, 5) : [];
  const imageUrls = imageList.length > 0
    ? await uploadImagesToDrive(imageList, String(site), String(po_number), 'gr', '')
    : [];

  return rpc('confirm_gr', {
    p_po_number: String(po_number),
    p_site: String(site),
    p_confirmed_amount: confirmed_amount == null ? '' : String(confirmed_amount),
    p_note: note || '',
    p_lat: lat == null ? '' : String(lat),
    p_long: long == null ? '' : String(long),
    p_image_urls: imageUrls,
  });
}

// ── Google Drive upload (qua GAS) ───────────────────────────────────────────

async function uploadImagesToDrive(images, store, article, pic, stock_day) {
  if (!images || images.length === 0) return [];
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'uploadImages', store, article, pic, stock_day, images }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.imageUrls || [];
}

// payload: { store, article, current_stock, counted_stock, note, lat, long,
//            images:[{base64,type}], image, imageType, stock_day, pic }
export async function submitConfirmation(payload) {
  const {
    store, article, current_stock, counted_stock, note, lat, long,
    image, imageType, images, stock_day, pic,
  } = payload;

  // Chuẩn hoá danh sách ảnh
  const imageList = Array.isArray(images) && images.length > 0
    ? images.slice(0, 5)
    : (image ? [{ base64: image, type: imageType || 'image/jpeg' }] : []);

  // Upload ảnh lên Google Drive qua GAS
  const imageUrls = await uploadImagesToDrive(imageList, String(store), String(article), pic, stock_day);

  return rpc('confirm_stock', {
    p_store: String(store),
    p_article: String(article),
    p_current_stock: current_stock === '' || current_stock == null ? '' : String(current_stock),
    p_counted_stock: counted_stock == null ? '' : String(counted_stock),
    p_note: note || '',
    p_lat: lat == null ? '' : String(lat),
    p_long: long == null ? '' : String(long),
    p_image_urls: imageUrls,
  });
}
