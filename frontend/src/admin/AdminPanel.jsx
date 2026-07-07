import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { TABLES, SHEET_TO_TABLE, dbRowToExcel, excelRowToDb } from './columnMap';

export default function AdminPanel({ password, onLogout }) {
  const [busy, setBusy]       = useState('');   // mô tả tác vụ đang chạy
  const [error, setError]     = useState('');
  const [parsed, setParsed]   = useState(null); // { tableName: rows[] }
  const [fileName, setFileName] = useState('');
  const [results, setResults] = useState([]);   // log kết quả import

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    setError(''); setBusy('Đang tải dữ liệu…');
    try {
      const { data, error: rpcErr } = await supabase.rpc('admin_export_all', { p_password: password });
      if (rpcErr) throw new Error(rpcErr.message);
      if (data?.error) throw new Error(data.error);

      const wb = XLSX.utils.book_new();
      for (const sheetName of Object.keys(TABLES)) {
        const dbKey = SHEET_TO_TABLE[sheetName.toLowerCase()];
        const rows = (data[dbKey] || []).map(r => dbRowToExcel(sheetName, r));
        const headers = TABLES[sheetName].map(p => p[0]);
        const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
      const ds = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `ton-kho_${ds}.xlsx`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  // ── Đọc file Excel cần import ───────────────────────────────────────────────
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setResults([]); setParsed(null); setFileName(file.name);
    setBusy('Đang đọc file…');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const out = {};
      for (const wsName of wb.SheetNames) {
        const table = SHEET_TO_TABLE[wsName.trim().toLowerCase()];
        if (!table) continue;
        const sheetKey = Object.keys(TABLES).find(k => k.toLowerCase() === wsName.trim().toLowerCase());
        const pairs = TABLES[sheetKey] || TABLES[table] || [];
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { raw: false, defval: '' });
        out[table] = raw.map(row => excelRowToDb(table, row, pairs));
      }
      if (Object.keys(out).length === 0) {
        throw new Error('File không có sheet hợp lệ (stocks / stores / PIC / qlkv / gr_records / Tổng hợp PO).');
      }
      setParsed(out);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  // ── Thay thế toàn bộ 1 bảng ─────────────────────────────────────────────────
  async function handleReplace(table, rows) {
    const ok = window.confirm(
      `Thao tác này sẽ XOÁ toàn bộ dữ liệu hiện có trong bảng "${table}" ` +
      `và thay bằng ${rows.length} dòng mới. Tiếp tục?`
    );
    if (!ok) return;
    setError(''); setBusy(`Đang thay thế bảng ${table}…`);
    try {
      const { data, error: rpcErr } = await supabase.rpc('admin_replace_table', {
        p_password: password, p_table: table, p_rows: rows,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (data?.error) throw new Error(data.error);
      setResults(prev => [...prev, `✓ ${table}: đã nạp ${data.inserted} dòng`]);
    } catch (err) {
      setError(`Lỗi khi thay thế bảng ${table}: ${err.message}`);
    } finally {
      setBusy('');
    }
  }

  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <h1 style={S.title}>Admin — Quản trị dữ liệu</h1>
        <button onClick={onLogout} style={S.logout}>Đăng xuất</button>
      </header>

      {busy && <div style={S.banner}>{busy}</div>}
      {error && <div style={S.errBanner}>{error}</div>}

      {/* Export */}
      <section style={S.card}>
        <h2 style={S.h2}>1. Tải dữ liệu ra Excel</h2>
        <p style={S.p}>Xuất toàn bộ dữ liệu (stocks, stores, PIC, qlkv) thành 1 file .xlsx để lưu trữ.</p>
        <button onClick={handleExport} disabled={!!busy} style={S.btnPrimary}>⬇️ Tải Excel</button>
      </section>

      {/* Import */}
      <section style={S.card}>
        <h2 style={S.h2}>2. Nạp dữ liệu mới từ Excel</h2>
        <p style={S.p}>
          Chọn file .xlsx. Mỗi sheet (stocks / stores / PIC / qlkv / gr_records / Tổng hợp PO) sẽ{' '}
          <b>thay thế toàn bộ</b> bảng tương ứng.{' '}
          <b>Hãy tải Excel sao lưu ở bước 1 trước khi nạp.</b>
        </p>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={!!busy} style={S.file} />
        {fileName && <p style={S.fileName}>📄 {fileName}</p>}

        {parsed && (
          <div style={S.tableList}>
            {Object.entries(parsed).map(([table, rows]) => (
              <div key={table} style={S.tableRow}>
                <span><b>{table}</b> — {rows.length} dòng</span>
                <button
                  onClick={() => handleReplace(table, rows)}
                  disabled={!!busy}
                  style={S.btnDanger}
                >
                  Thay thế bảng {table}
                </button>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <ul style={S.results}>
            {results.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

const S = {
  wrap: { maxWidth: 720, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif',
          color: '#111' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, margin: 0 },
  logout: { background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '6px 12px',
            cursor: 'pointer', fontSize: 14 },
  banner: { background: '#eff6ff', color: '#1d4ed8', padding: '10px 14px', borderRadius: 10,
            marginBottom: 12 },
  errBanner: { background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10,
               marginBottom: 12 },
  card: { background: '#fff', borderRadius: 14, padding: 20, marginBottom: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,.05)' },
  h2: { fontSize: 16, fontWeight: 700, margin: '0 0 8px' },
  p: { fontSize: 14, color: '#555', margin: '0 0 14px', lineHeight: 1.5 },
  btnPrimary: { padding: '12px 18px', borderRadius: 10, border: 'none', background: '#2563eb',
                color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  file: { display: 'block', fontSize: 14 },
  fileName: { fontSize: 13, color: '#444', margin: '10px 0 0' },
  tableList: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  tableRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: '#f9fafb', borderRadius: 10, fontSize: 14 },
  btnDanger: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#dc2626',
               color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  results: { marginTop: 16, fontSize: 14, color: '#16a34a', paddingLeft: 18 },
};
