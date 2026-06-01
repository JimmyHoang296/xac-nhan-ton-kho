import { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { fetchPicStocks, savePicComment } from '../api';
import styles from './PicDashboard.module.css';

export default function PicDashboard({ pic, onLogout }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'confirmed' | 'pending'

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPicStocks(pic);
      setStocks(data.stocks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pic]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(key) {
    setExpandedKey(prev => prev === key ? null : key);
  }

  function handleCommentSaved(store, article, comment) {
    setStocks(prev => prev.map(s =>
      s.store === store && String(s.article) === String(article)
        ? { ...s, pic_comment: comment }
        : s
    ));
  }

  const confirmed = stocks.filter(s => s.counted_stock !== null && s.counted_stock !== '');
  const pending   = stocks.filter(s => s.counted_stock === null || s.counted_stock === '');

  const isConfirmedFn = s => s.counted_stock !== null && s.counted_stock !== '';
  const filteredStocks = filter === 'confirmed' ? stocks.filter(isConfirmedFn)
                       : filter === 'pending'   ? stocks.filter(s => !isConfirmedFn(s))
                       : stocks;

  const byStore = filteredStocks.reduce((acc, s) => {
    const key = s.store;
    if (!acc[key]) acc[key] = { store: s.store, store_name: s.store_name, items: [] };
    acc[key].items.push(s);
    return acc;
  }, {});

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <p className={styles.headerLabel}>PIC Dashboard</p>
            <h1 className={styles.headerPic}>{pic}</h1>
          </div>

          {!loading && !error && (
            <div className={styles.headerStats}>
              <button
                className={`${styles.statBox} ${filter === 'all' ? styles.statBoxActive : ''}`}
                onClick={() => setFilter('all')}
              >
                <span className={styles.statNum}>{stocks.length}</span>
                <span className={styles.statLabel}>Tổng SP</span>
              </button>
              <button
                className={`${styles.statBox} ${styles.statBoxDone} ${filter === 'confirmed' ? styles.statBoxActive : ''}`}
                onClick={() => setFilter('confirmed')}
              >
                <span className={styles.statNum}>{confirmed.length}</span>
                <span className={styles.statLabel}>Đã XN</span>
              </button>
              <button
                className={`${styles.statBox} ${styles.statBoxPending} ${filter === 'pending' ? styles.statBoxActive : ''}`}
                onClick={() => setFilter('pending')}
              >
                <span className={styles.statNum}>{pending.length}</span>
                <span className={styles.statLabel}>Chờ XN</span>
              </button>
            </div>
          )}

          <div className={styles.headerRight}>
            <button className={styles.refreshBtn} onClick={load} title="Làm mới">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v5h5M20 20v-5h-5" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.07 13a8 8 0 1013.55-8.36L20 2M20 22l-2.38-2.64A8 8 0 014.07 13" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {!loading && !error && stocks.length > 0 && (
              <button className={styles.downloadBtn} onClick={() => downloadExcel(pic, stocks)} title="Tải Excel">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v13M7 11l5 5 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 20h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Excel</span>
              </button>
            )}
            <button className={styles.logoutBtn} onClick={onLogout}>Đăng xuất</button>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.pageContent}>
          {loading && <div className={styles.center}><span className={styles.spinner} /></div>}
          {error   && <p className={styles.errorMsg}>{error}</p>}

          {!loading && !error && stocks.length === 0 && (
            <div className={styles.center}>
              <p className={styles.emptyText}>Không có sản phẩm nào được giao.</p>
            </div>
          )}

          {!loading && !error && stocks.length > 0 && (
            <div className={styles.storeGrid}>
              {Object.values(byStore).map(group => (
                <div key={group.store} className={styles.storeGroup}>
                  <div className={styles.storeHeader}>
                    <span className={styles.storeCode}>{group.store}</span>
                    <span className={styles.storeName}>{group.store_name}</span>
                    <span className={styles.storeBadge}>
                      {group.items.filter(i => i.counted_stock !== null && i.counted_stock !== '').length}
                      /{group.items.length} XN
                    </span>
                  </div>

                  {group.items.map(stock => {
                    const key = `${stock.store}-${stock.article}`;
                    const isConfirmed = stock.counted_stock !== null && stock.counted_stock !== '';
                    return (
                      <StockRow
                        key={key}
                        stock={stock}
                        pic={pic}
                        isConfirmed={isConfirmed}
                        isExpanded={expandedKey === key}
                        onToggle={() => toggleExpand(key)}
                        onCommentSaved={handleCommentSaved}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StockRow({ stock, pic, isConfirmed, isExpanded, onToggle, onCommentSaved }) {
  const [comment, setComment] = useState(stock.pic_comment || '');
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const diff = isConfirmed
    ? Number(stock.counted_stock) - Number(stock.current_stock || 0)
    : null;

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      await savePicComment(pic, stock.store, stock.article, comment);
      onCommentSaved(stock.store, stock.article, comment);
      setSaveMsg('Đã lưu');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('Lỗi lưu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${styles.row} ${isConfirmed ? styles.rowDone : styles.rowPending}`}>
      {/* ── Collapsed header ── */}
      <button className={styles.rowMain} onClick={onToggle}>
        <div className={styles.rowInfo}>
          <div className={styles.rowTopLine}>
            <span className={`${styles.badge} ${isConfirmed ? styles.badgeDone : styles.badgePending}`}>
              {isConfirmed ? '✓ Đã XN' : 'Chờ XN'}
            </span>
            <span className={styles.articleName}>{stock.article_name}</span>
          </div>

          <div className={styles.metaStrip}>
            <span className={styles.metaItem}>{stock.article}</span>
            <span className={styles.metaSep}>·</span>
            <span className={styles.metaItem}>HT: <strong>{stock.stock ?? '—'}</strong></span>
            {isConfirmed && (
              <>
                <span className={styles.metaSep}>·</span>
                <span className={styles.metaItem}>Hiện: <strong>{stock.current_stock ?? '—'}</strong></span>
                <span className={styles.metaSep}>·</span>
                <span className={`${styles.metaItem} ${styles.metaGreen}`}>
                  XN: <strong>{stock.counted_stock}</strong>
                </span>
                <span className={styles.metaSep}>·</span>
                <span className={`${styles.metaItem} ${diff < 0 ? styles.metaRed : diff > 0 ? styles.metaBlue : styles.metaGray}`}>
                  {diff > 0 ? '+' : ''}{diff}
                </span>
                {stock.location_check ? (
                  <>
                    <span className={styles.metaSep}>·</span>
                    <span className={`${styles.metaItem} ${Number(stock.location_check) > 50 ? styles.metaRed : styles.metaGreen}`}>
                      {stock.location_check} m
                    </span>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>

        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={styles.chevron}
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M4 6l4 4 4-4" stroke="#80868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ── Expanded detail ── */}
      {isExpanded && (
        <div className={styles.detail}>
          {/* Stat chips row */}
          <div className={styles.chipStrip}>
            <Chip label="Tồn HT"   value={stock.stock} />
            <Chip label="Hiện tại" value={stock.current_stock} />
            <Chip label="Kiểm kho" value={isConfirmed ? stock.counted_stock : null} green={isConfirmed} />
            <Chip label="Chênh lệch"
              value={isConfirmed ? (diff > 0 ? `+${diff}` : diff) : null}
              green={isConfirmed && diff >= 0}
              red={isConfirmed && diff < 0}
            />
            <Chip label="Ngày tồn"  value={formatDate(stock.stock_day)} />
            <Chip label="XN lúc"    value={formatDateTime(stock.time_stamp)} />
            <Chip label="Cách CH"
              value={stock.location_check ? `${stock.location_check} m` : null}
              green={!!stock.location_check && Number(stock.location_check) <= 50}
              red={!!stock.location_check && Number(stock.location_check) > 50}
            />
          </div>

          {/* Detail body: left (note + comment) | right (image) */}
          <div className={styles.detailBody}>
            <div className={styles.detailLeft}>
              {stock.note && (
                <div className={styles.noteBox}>
                  <span className={styles.noteLabel}>Ghi chú nhân viên</span>
                  <p className={styles.noteText}>{stock.note}</p>
                </div>
              )}

              <div className={styles.commentSection}>
                <label className={styles.commentLabel}>Comment PIC</label>
                <textarea
                  className={styles.commentInput}
                  rows={3}
                  placeholder="Nhập nhận xét của PIC..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
                <div className={styles.commentFooter}>
                  {saveMsg && <span className={styles.saveMsg}>{saveMsg}</span>}
                  <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                    {saving ? 'Đang lưu...' : 'Lưu comment'}
                  </button>
                </div>
              </div>
            </div>

            {stock.image && (
              <div className={styles.imgSection}>
                {stock.image.split(',').map((url, idx) => (
                  <div key={idx} className={styles.imgItem}>
                    <img
                      src={driveEmbedUrl(url.trim())}
                      alt={`Ảnh ${idx + 1}`}
                      className={styles.confirmImg}
                    />
                    <a href={url.trim()} target="_blank" rel="noreferrer" className={styles.imgLink}>
                      Mở ảnh {stock.image.split(',').length > 1 ? idx + 1 : 'gốc'}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value, green, red }) {
  const cls = [styles.chipValue, green ? styles.chipGreen : '', red ? styles.chipRed : ''].join(' ');
  return (
    <div className={styles.chip}>
      <span className={styles.chipLabel}>{label}</span>
      <span className={cls}>{value ?? '—'}</span>
    </div>
  );
}

function downloadExcel(pic, stocks) {
  const rows = stocks.map(s => ({
    'CH': s.store,
    'Tên CH': s.store_name,
    'Mã SP': s.article,
    'Tên SP': s.article_name,
    'Tồn HT': s.stock ?? '',
    'Ngày tồn': s.stock_day ?? '',
    'Tồn hiện tại': s.current_stock ?? '',
    'Tồn thực tế': s.counted_stock ?? '',
    'Chênh lệch': (s.counted_stock !== null && s.counted_stock !== '')
      ? Number(s.counted_stock) - Number(s.current_stock || 0)
      : '',
    'Ghi chú NV': s.note ?? '',
    'Comment PIC': s.pic_comment ?? '',
    'Khoảng cách (m)': s.location_check ?? '',
    'Thời gian XN': s.time_stamp ?? '',
    'Ảnh': s.image ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Độ rộng cột tự động theo nội dung
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2,
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tồn kho');

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2,'0')}${String(today.getMonth()+1).padStart(2,'0')}${today.getFullYear()}`;
  XLSX.writeFile(wb, `PIC_${pic}_${dateStr}.xlsx`);
}

function driveEmbedUrl(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return url;
}

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString('vi-VN');
}

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
