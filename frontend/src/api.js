const API_URL = import.meta.env.VITE_API_URL;

export async function fetchStocks(store) {
  const res = await fetch(`${API_URL}?action=getStocks&store=${encodeURIComponent(store)}`);
  if (!res.ok) throw new Error('Lỗi kết nối máy chủ');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function picLogin(pic, password) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'picLogin', pic, password }),
  });
  if (!res.ok) throw new Error('Lỗi kết nối máy chủ');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchPicStocks(pic) {
  const res = await fetch(`${API_URL}?action=getPicStocks&pic=${encodeURIComponent(pic)}`);
  if (!res.ok) throw new Error('Lỗi kết nối máy chủ');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function savePicComment(pic, store, article, comment) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'savePicComment', pic, store, article, comment }),
  });
  if (!res.ok) throw new Error('Lỗi kết nối máy chủ');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function submitConfirmation(payload) {
  // GAS không hỗ trợ preflight OPTIONS nên dùng text/plain để tránh CORS preflight
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'confirm', ...payload }),
  });
  if (!res.ok) throw new Error('Lỗi kết nối máy chủ');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
