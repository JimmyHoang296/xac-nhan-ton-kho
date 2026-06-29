import { useState } from 'react';
import { supabase } from '../supabaseClient';
import AdminPanel from './AdminPanel.jsx';

export default function AdminApp() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed]     = useState(false);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!password) { setError('Vui lòng nhập mật khẩu.'); return; }
    setBusy(true);
    setError('');
    try {
      // Xác thực mật khẩu bằng cách thử gọi 1 RPC admin nhẹ
      const { data, error: rpcErr } = await supabase.rpc('admin_check', { p_password: password });
      if (rpcErr) throw new Error(rpcErr.message);
      if (data !== true) throw new Error('Sai mật khẩu admin');
      setAuthed(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (authed) {
    return <AdminPanel password={password} onLogout={() => { setAuthed(false); setPassword(''); }} />;
  }

  return (
    <div style={S.wrap}>
      <form style={S.card} onSubmit={handleLogin}>
        <h1 style={S.title}>Admin — Quản trị dữ liệu</h1>
        <p style={S.sub}>Xuất / nhập dữ liệu tồn kho</p>
        <input
          type="password"
          placeholder="Mật khẩu admin"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={S.input}
          autoFocus
        />
        {error && <p style={S.err}>{error}</p>}
        <button type="submit" disabled={busy} style={S.btn}>
          {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}

const S = {
  wrap: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, background: '#f4f5f7', fontFamily: 'system-ui, sans-serif' },
  card: { width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 24,
          boxShadow: '0 4px 24px rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', gap: 12 },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: '#111' },
  sub: { margin: '0 0 4px', color: '#666', fontSize: 14 },
  input: { padding: '12px 14px', borderRadius: 10, border: '1px solid #ddd', fontSize: 16 },
  btn: { padding: '12px 14px', borderRadius: 10, border: 'none', background: '#2563eb',
         color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  err: { color: '#dc2626', fontSize: 14, margin: 0 },
};
