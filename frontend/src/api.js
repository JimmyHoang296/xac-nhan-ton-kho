import { supabase, CLOUDINARY_CLOUD, CLOUDINARY_PRESET } from './supabaseClient';

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

export async function qlkvLogin(username) {
  return rpc('qlkv_login', { p_username: username });
}

export async function fetchQlkvStocks(username) {
  return rpc('get_qlkv_stocks', { p_username: username });
}

export async function batchSavePicComment(pic, items) {
  return rpc('batch_save_pic_comment', { p_pic: pic, p_items: items });
}

// ── Cloudinary unsigned upload ──────────────────────────────────────────────

// stock_day → "mmdd" (vd "0501"); khớp toMmdd cũ trong backend
function toMmdd(dateVal) {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'nodate';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return mm + dd;
}

async function uploadToCloudinary(base64, type, publicId) {
  const form = new FormData();
  form.append('file', `data:${type || 'image/jpeg'};base64,${base64}`);
  form.append('upload_preset', CLOUDINARY_PRESET);
  form.append('public_id', publicId);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: form }
  );
  const json = await res.json();
  if (!res.ok || !json.secure_url) {
    throw new Error(json?.error?.message || 'Lỗi tải ảnh lên Cloudinary');
  }
  return json.secure_url;
}

// payload: { store, article, current_stock, counted_stock, note, lat, long,
//            images:[{base64,type}], image, imageType, stock_day, pic }
export async function submitConfirmation(payload) {
  const {
    store, article, current_stock, counted_stock, note, lat, long,
    image, imageType, images, stock_day, pic,
  } = payload;

  // Chuẩn hoá danh sách ảnh: ưu tiên images[], fallback single image
  const imageList = Array.isArray(images) && images.length > 0
    ? images.slice(0, 5)
    : (image ? [{ base64: image, type: imageType || 'image/jpeg' }] : []);

  // Upload ảnh trực tiếp lên Cloudinary từ trình duyệt
  const imageUrls = [];
  if (imageList.length > 0) {
    const folder = `${toMmdd(stock_day)}/${pic || 'nopic'}_${store}`;
    for (let i = 0; i < imageList.length; i++) {
      const suffix = imageList.length > 1 ? `_${i + 1}` : '';
      const publicId = `${folder}/${store}_${String(article)}${suffix}`;
      const url = await uploadToCloudinary(imageList[i].base64, imageList[i].type, publicId);
      imageUrls.push(url);
    }
  }

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
