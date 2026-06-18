import { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { fetchQlkvStocks } from '../api';
import styles from '../pic/PicDashboard.module.css';

export default function QlkvDashboard({ username, name, onLogout }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchQlkvStocks(username);
      setStocks(data.stocks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { load(); }, [load]);

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

  const displayedGroups = Object.values(byStore).filter(g => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!String(g.store).toLowerCase().includes(q) && !String(g.store_name).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const currentSelectedStock = selectedKey
    ? stocks.find(s => `${s.store}-${s.article}` === selectedKey)
    : null;

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <p className={styles.headerLabel}>QLKV Dashboard</p>
            <h1 className={styles.headerPic}>{name || username}</h1>
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
              <button className={styles.downloadBtn} onClick={() => downloadExcel(username, stocks)} title="Tải Excel">
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

      <div className={styles.masterDetail}>
        {/* ── LEFT: List panel ── */}
        <div className={`${styles.listPanel} ${selectedKey ? styles.listPanelMobileHidden : ''}`}>
          {loading && <div className={styles.center}><span className={styles.spinner} /></div>}
          {error   && <p className={styles.errorMsg}>{error}</p>}

          {!loading && !error && stocks.length === 0 && (
            <div className={styles.center}>
              <p className={styles.emptyText}>Không có sản phẩm nào.</p>
            </div>
          )}

          {!loading && !error && stocks.length > 0 && (
            <>
              <div className={styles.searchBar}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={styles.searchIcon}>
                  <circle cx="11" cy="11" r="7" stroke="#80868b" strokeWidth="2"/>
                  <path d="M16.5 16.5l4 4" stroke="#80868b" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Tìm cửa hàng (mã hoặc tên)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className={styles.searchClear} onClick={() => setSearchQuery('')} title="Xóa">✕</button>
                )}
              </div>

              {displayedGroups.length === 0 && (
                <div className={styles.center}>
                  <p className={styles.emptyText}>Không tìm thấy cửa hàng phù hợp.</p>
                </div>
              )}

              <div className={styles.storeList}>
                {displayedGroups.map(group => (
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
                          isConfirmed={isConfirmed}
                          isSelected={selectedKey === key}
                          onClick={() => setSelectedKey(key)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Detail pane ── */}
        <div className={`${styles.detailPane} ${selectedKey ? styles.detailPaneVisible : ''}`}>
          {currentSelectedStock ? (
            <DetailPanel
              stock={currentSelectedStock}
              onBack={() => setSelectedKey(null)}
            />
          ) : (
            <div className={styles.detailPlaceholder}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                <path d="M9 12h6M9 16h6M7 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 4h6a1 1 0 010 2H9a1 1 0 010-2z"
                  stroke="#bdc1c6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className={styles.placeholderText}>Chọn sản phẩm để xem chi tiết</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── StockRow ─── */
function StockRow({ stock, isConfirmed, isSelected, onClick }) {
  const diff = isConfirmed
    ? Number(stock.counted_stock) - Number(stock.current_stock || 0)
    : null;

  return (
    <button
      className={`${styles.row} ${isConfirmed ? styles.rowDone : styles.rowPending} ${isSelected ? styles.rowSelected : ''}`}
      onClick={onClick}
    >
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
            </>
          )}
        </div>
      </div>
      <div className={styles.rowRight}>
        {stock.pic && <span className={styles.metaItem} style={{ fontSize: '11px', color: '#80868b' }}>{stock.pic}</span>}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={styles.chevronRight}>
          <path d="M6 4l4 4-4 4" stroke="#bdc1c6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}

/* ─── DetailPanel (không có pic_status / pic_comment) ─── */
function DetailPanel({ stock, onBack }) {
  const isConfirmed = stock.counted_stock !== null && stock.counted_stock !== '';
  const diff = isConfirmed
    ? Number(stock.counted_stock) - Number(stock.current_stock || 0)
    : null;

  return (
    <div className={styles.detailPanelInner}>
      <div className={styles.detailPanelHeader}>
        <button className={styles.backBtn} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Danh sách
        </button>
        <div className={styles.detailTitleRow}>
          <span className={`${styles.badge} ${isConfirmed ? styles.badgeDone : styles.badgePending}`}>
            {isConfirmed ? '✓ Đã XN' : 'Chờ XN'}
          </span>
          <h2 className={styles.detailArticleName}>{stock.article_name}</h2>
        </div>
        <div className={styles.detailStoreRow}>
          <span className={styles.storeCode}>{stock.store}</span>
          <span className={styles.detailStoreName}>{stock.store_name}</span>
          {stock.pic && <span style={{ fontSize: '12px', color: '#80868b', marginLeft: '8px' }}>PIC: {stock.pic}</span>}
        </div>

        {(stock.cht || stock.qlkv) && (
          <div className={styles.contactStrip}>
            {stock.cht && (
              <span className={styles.contactItem}>
                <span className={styles.contactRole}>CHT</span>
                <span className={styles.contactName}>{stock.cht}</span>
                {stock.sdt_cht && (
                  <a href={viberUrl(stock.sdt_cht)} className={styles.contactPhone}>
                    💬 {normalizePhone(stock.sdt_cht)}
                  </a>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chips */}
      <div className={styles.chipStrip}>
        <Chip label="Tồn HT"    value={stock.stock} />
        <Chip label="Hiện tại"  value={stock.current_stock} />
        <Chip label="Kiểm kho"  value={isConfirmed ? stock.counted_stock : null} green={isConfirmed} />
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
        {stock.lat && stock.long && (() => {
          const realDist = stock.store_lat && stock.store_long
            ? haversineMeters(Number(stock.lat), Number(stock.long), Number(stock.store_lat), Number(stock.store_long))
            : null;
          const far = realDist !== null ? realDist > 200 : Number(stock.location_check) > 200;
          const href = far && stock.store_lat && stock.store_long
            ? `https://www.google.com/maps/dir/${stock.store_lat},${stock.store_long}/${stock.lat},${stock.long}`
            : `https://www.google.com/maps?q=${stock.lat},${stock.long}`;
          return (
            <a href={href} target="_blank" rel="noreferrer"
              className={`${styles.mapBtn} ${far ? styles.mapBtnFar : ''}`}
              title={far ? 'Dẫn đường từ cửa hàng đến vị trí chụp' : 'Mở vị trí chụp ảnh trên Google Maps'}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2"/>
              </svg>
              {far ? 'Dẫn đường' : 'Vị trí chụp'}
            </a>
          );
        })()}
      </div>

      {/* Body */}
      <div className={styles.detailBody}>
        {stock.note && (
          <div className={styles.noteBox}>
            <span className={styles.noteLabel}>Ghi chú nhân viên</span>
            <p className={styles.noteText}>{stock.note}</p>
          </div>
        )}

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
  );
}

/* ── Helpers ── */
function Chip({ label, value, green, red }) {
  const cls = [styles.chipValue, green ? styles.chipGreen : '', red ? styles.chipRed : ''].join(' ');
  return (
    <div className={styles.chip}>
      <span className={styles.chipLabel}>{label}</span>
      <span className={cls}>{value ?? '—'}</span>
    </div>
  );
}

function downloadExcel(username, stocks) {
  const rows = stocks.map(s => ({
    'CH':           s.store,
    'Tên CH':       s.store_name,
    'PIC':          s.pic ?? '',
    'Mã SP':        s.article,
    'Tên SP':       s.article_name,
    'Tồn HT':       s.stock ?? '',
    'Ngày tồn':     s.stock_day ?? '',
    'Tồn hiện tại': s.current_stock ?? '',
    'Tồn thực tế':  s.counted_stock ?? '',
    'Chênh lệch':   (s.counted_stock !== null && s.counted_stock !== '')
                      ? Number(s.counted_stock) - Number(s.current_stock || 0) : '',
    'Ghi chú NV':   s.note ?? '',
    'Khoảng cách':  s.location_check ?? '',
    'Thời gian XN': s.time_stamp ?? '',
    'Ảnh':          s.image ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tồn kho');
  const today = new Date();
  const ds = `${String(today.getDate()).padStart(2,'0')}${String(today.getMonth()+1).padStart(2,'0')}${today.getFullYear()}`;
  XLSX.writeFile(wb, `QLKV_${username}_${ds}.xlsx`);
}

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('0') ? digits : '0' + digits;
}

function viberUrl(raw) {
  const phone = normalizePhone(raw);
  if (!phone) return '#';
  return `viber://chat?number=${encodeURIComponent('+84' + phone.slice(1))}`;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function driveEmbedUrl(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
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
