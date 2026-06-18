const API_URL = "https://script.google.com/macros/s/AKfycbzB-fOf5kOKeS_FOkw-6BGlrid2FgSJjjEyVrPb88nI1Lix2kyWDg-qAf0aedYTefCo/exec";

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

export async function savePicComment(pic, store, article, comment, pic_status) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'savePicComment', pic, store, article, comment, pic_status }),
  });
  if (!res.ok) throw new Error('Lỗi kết nối máy chủ');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchProgress(pic) {
  const res = await fetch(`${API_URL}?action=getProgress&pic=${encodeURIComponent(pic)}`);
  if (!res.ok) throw new Error('Lỗi kết nối máy chủ');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function qlkvLogin(username) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'qlkvLogin', username }),
  });
  if (!res.ok) throw new Error('Lỗi kết nối máy chủ');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchQlkvStocks(username) {
  const res = await fetch(`${API_URL}?action=getQlkvStocks&username=${encodeURIComponent(username)}`);
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
