import { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { fetchPicStocks, savePicComment } from '../api';
import styles from './PicDashboard.module.css';

export default function PicDashboard({ pic, onLogout }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'confirmed' | 'pending'
  const [picStatusFilter, setPicStatusFilter] = useState('all'); // 'all' | 'ok' | 'xlvp' | 'xac_minh_them' | 'none'
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyPendingStores, setShowOnlyPendingStores] = useState(false);

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

  function handleCommentSaved(store, article, comment, status) {
    setStocks(prev => prev.map(s =>
      s.store === store && String(s.article) === String(article)
        ? { ...s, pic_comment: comment, pic_status: status }
        : s
    ));
  }

  const confirmed = stocks.filter(s => s.counted_stock !== null && s.counted_stock !== '');
  const pending   = stocks.filter(s => s.counted_stock === null || s.counted_stock === '');

  const isConfirmedFn = s => s.counted_stock !== null && s.counted_stock !== '';
  const byXnFilter = filter === 'confirmed' ? stocks.filter(isConfirmedFn)
                   : filter === 'pending'   ? stocks.filter(s => !isConfirmedFn(s))
                   : stocks;

  const filteredStocks = picStatusFilter === 'all'  ? byXnFilter
    : picStatusFilter === 'none' ? byXnFilter.filter(s => !s.pic_status || s.pic_status === '')
    : byXnFilter.filter(s => s.pic_status === picStatusFilter);

  // Đếm số item theo từng pic_status (trên toàn bộ stocks, không phụ thuộc filter XN)
  const picCounts = {
    all:           stocks.length,
    none:          stocks.filter(s => !s.pic_status || s.pic_status === '').length,
    ok:            stocks.filter(s => s.pic_status === 'ok').length,
    xlvp:          stocks.filter(s => s.pic_status === 'xlvp').length,
    xac_minh_them: stocks.filter(s => s.pic_status === 'xac_minh_them').length,
  };

  const byStore = filteredStocks.reduce((acc, s) => {
    const key = s.store;
    if (!acc[key]) acc[key] = { store: s.store, store_name: s.store_name, items: [] };
    acc[key].items.push(s);
    return acc;
  }, {});

  const storePendingSet = new Set(
    stocks.filter(s => !s.pic_status || s.pic_status === '').map(s => String(s.store))
  );

  const displayedGroups = Object.values(byStore).filter(g => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!String(g.store).toLowerCase().includes(q) && !String(g.store_name).toLowerCase().includes(q)) return false;
    }
    if (showOnlyPendingStores && !storePendingSet.has(String(g.store))) return false;
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
              <>
              <button className={styles.downloadBtnQlkv} onClick={() => downloadExcelByQlkv(pic, stocks)} title="Tải Excel theo QLKV">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v13M7 11l5 5 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 20h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>QLKV</span>
              </button>
              <button className={styles.downloadBtn} onClick={() => downloadExcel(pic, stocks)} title="Tải Excel chi tiết">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v13M7 11l5 5 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 20h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Excel</span>
              </button>
              </>
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
              <p className={styles.emptyText}>Không có sản phẩm nào được giao.</p>
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
                <button
                  className={`${styles.filterToggle} ${showOnlyPendingStores ? styles.filterToggleActive : ''}`}
                  onClick={() => setShowOnlyPendingStores(v => !v)}
                >
                  PIC chưa XN
                </button>
              </div>

              {/* Filter chips theo pic_status */}
              <div className={styles.picFilterBar}>
                {[
                  { key: 'all',           label: 'Tất cả',        cls: '' },
                  { key: 'none',          label: 'Chưa set',      cls: styles.pfNone },
                  { key: 'ok',            label: 'OK',            cls: styles.pfOk },
                  { key: 'xlvp',          label: 'XLVP',          cls: styles.pfXlvp },
                  { key: 'xac_minh_them', label: 'Xác minh thêm', cls: styles.pfXmt },
                ].map(({ key, label, cls }) => (
                  <button
                    key={key}
                    className={`${styles.pfChip} ${cls} ${picStatusFilter === key ? styles.pfChipActive : ''}`}
                    onClick={() => setPicStatusFilter(key)}
                  >
                    {label}
                    {picCounts[key] > 0 && <span className={styles.pfCount}>{picCounts[key]}</span>}
                  </button>
                ))}
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
              pic={pic}
              onBack={() => setSelectedKey(null)}
              onCommentSaved={handleCommentSaved}
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

/* ─────────────────────────────────────────
   StockRow — compact clickable list item
───────────────────────────────────────── */
function StockRow({ stock, isConfirmed, isSelected, onClick }) {
  const diff = isConfirmed
    ? Number(stock.counted_stock) - Number(stock.current_stock || 0)
    : null;

  const statusCls = stock.pic_status === 'ok'            ? styles.picStatusOk
                  : stock.pic_status === 'xlvp'          ? styles.picStatusXlvp
                  : stock.pic_status === 'xac_minh_them' ? styles.picStatusXacMinhThem
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

      <div className={styles.rowRight}>
        {statusCls && (
          <span className={`${styles.picStatusTag} ${statusCls}`}>
            {PIC_STATUS_LABELS[stock.pic_status]}
          </span>
        )}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={styles.chevronRight}>
          <path d="M6 4l4 4-4 4" stroke="#bdc1c6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────
   DetailPanel — right-side detail view
───────────────────────────────────────── */
function DetailPanel({ stock, pic, onBack, onCommentSaved }) {
  const [comment, setComment] = useState(stock.pic_comment || '');
  const [status,  setStatus]  = useState(stock.pic_status  || '');
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Sync when different item is selected
  useEffect(() => {
    setComment(stock.pic_comment || '');
    setStatus(stock.pic_status   || '');
    setSaveMsg('');
  }, [stock.store, stock.article]);

  const isConfirmed = stock.counted_stock !== null && stock.counted_stock !== '';
  const diff = isConfirmed
    ? Number(stock.counted_stock) - Number(stock.current_stock || 0)
    : null;

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      await savePicComment(pic, stock.store, stock.article, comment, status);
      onCommentSaved(stock.store, stock.article, comment, status);
      setSaveMsg('Đã lưu');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('Lỗi lưu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.detailPanelInner}>
      {/* Sticky header */}
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
        </div>

        {(stock.cht || stock.qlkv) && (
          <div className={styles.contactStrip}>
            {stock.cht && (
              <span className={styles.contactItem}>
                <span className={styles.contactRole}>CHT</span>
                <span className={styles.contactName}>{stock.cht}</span>
                {stock.sdt_cht && (
                  <a href={`tel:${String(stock.sdt_cht).replace(/\s/g, '')}`} className={styles.contactPhone}>
                    📞 {stock.sdt_cht}
                  </a>
                )}
              </span>
            )}
            {stock.qlkv && (
              <span className={styles.contactItem}>
                <span className={styles.contactRole}>QLKV</span>
                <span className={styles.contactName}>{stock.qlkv}</span>
                {stock.sdt_qlkv && (
                  <a href={`tel:${String(stock.sdt_qlkv).replace(/\s/g, '')}`} className={styles.contactPhone}>
                    📞 {stock.sdt_qlkv}
                  </a>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chips */}
      <div className={styles.chipStrip}>
        <Chip label="Tồn HT"      value={stock.stock} />
        <Chip label="Hiện tại"    value={stock.current_stock} />
        <Chip label="Kiểm kho"    value={isConfirmed ? stock.counted_stock : null} green={isConfirmed} />
        <Chip label="Chênh lệch"
          value={isConfirmed ? (diff > 0 ? `+${diff}` : diff) : null}
          green={isConfirmed && diff >= 0}
          red={isConfirmed && diff < 0}
        />
        <Chip label="Ngày tồn"    value={formatDate(stock.stock_day)} />
        <Chip label="XN lúc"      value={formatDateTime(stock.time_stamp)} />
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
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={`${styles.mapBtn} ${far ? styles.mapBtnFar : ''}`}
              title={far ? 'Dẫn đường từ cửa hàng đến vị trí chụp' : 'Mở vị trí chụp ảnh trên Google Maps'}
            >
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
        {/* Top row: note | PIC status + comment */}
        <div className={styles.detailTop}>
          {stock.note && (
            <div className={styles.noteBox}>
              <span className={styles.noteLabel}>Ghi chú nhân viên</span>
              <p className={styles.noteText}>{stock.note}</p>
            </div>
          )}

          <div className={styles.commentSection}>
            <label className={styles.commentLabel}>Trạng thái PIC</label>
            <select
              className={styles.statusSelect}
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              {PIC_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <label className={styles.commentLabel}>Comment PIC</label>
            <textarea
              className={styles.commentInput}
              rows={4}
              placeholder="Nhập nhận xét của PIC..."
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <div className={styles.commentFooter}>
              {saveMsg && <span className={styles.saveMsg}>{saveMsg}</span>}
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>

        {/* Images below */}
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

/* ── Shared helpers ── */
function Chip({ label, value, green, red }) {
  const cls = [styles.chipValue, green ? styles.chipGreen : '', red ? styles.chipRed : ''].join(' ');
  return (
    <div className={styles.chip}>
      <span className={styles.chipLabel}>{label}</span>
      <span className={cls}>{value ?? '—'}</span>
    </div>
  );
}

const PIC_STATUSES = [
  { value: '',               label: '— Chọn trạng thái —' },
  { value: 'ok',             label: 'OK' },
  { value: 'xlvp',           label: 'XLVP' },
  { value: 'xac_minh_them',  label: 'Xác minh thêm' },
];

function downloadExcelByQlkv(pic, stocks) {
  // Group: qlkv → store → items
  const qlkvMap = {};
  stocks.forEach(s => {
    const qlkv = s.qlkv || 'Chưa phân công';
    const key  = String(s.store);
    if (!qlkvMap[qlkv]) qlkvMap[qlkv] = {};
    if (!qlkvMap[qlkv][key]) qlkvMap[qlkv][key] = { store_name: s.store_name, items: [] };
    qlkvMap[qlkv][key].items.push(s);
  });

  const rows = [];
  const isConf = s => s.counted_stock !== null && s.counted_stock !== '';

  Object.entries(qlkvMap).sort(([a], [b]) => a.localeCompare(b, 'vi')).forEach(([qlkv, stores]) => {
    const allItems = Object.values(stores).flatMap(s => s.items);
    const confAll  = allItems.filter(isConf);

    // QLKV tổng hợp row
    rows.push({
      'Loại':           'QLKV',
      'QLKV':           qlkv,
      'Mã CH':          '',
      'Tên CH':         '',
      'Số mã':          allItems.length,
      'Tổng tồn HT':    allItems.reduce((s, i) => s + Number(i.stock  || 0), 0),
      'Số mã đã XN':    confAll.length,
      'Tổng tồn TT':    confAll.reduce((s, i) => s + Number(i.counted_stock || 0), 0),
    });

    // CH detail rows
    Object.entries(stores).sort(([a], [b]) => String(a).localeCompare(String(b))).forEach(([storeCode, { store_name, items }]) => {
      const conf = items.filter(isConf);
      rows.push({
        'Loại':        'CH',
        'QLKV':        qlkv,
        'Mã CH':       storeCode,
        'Tên CH':      store_name,
        'Số mã':       items.length,
        'Tổng tồn HT': items.reduce((s, i) => s + Number(i.stock  || 0), 0),
        'Số mã đã XN': conf.length,
        'Tổng tồn TT': conf.reduce((s, i) => s + Number(i.counted_stock || 0), 0),
      });
    });

    rows.push({ 'Loại': '', 'QLKV': '', 'Mã CH': '', 'Tên CH': '', 'Số mã': '', 'Tổng tồn HT': '', 'Số mã đã XN': '', 'Tổng tồn TT': '' });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2,
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Theo QLKV');

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2,'0')}${String(today.getMonth()+1).padStart(2,'0')}${today.getFullYear()}`;
  XLSX.writeFile(wb, `PIC_${pic}_QLKV_${dateStr}.xlsx`);
}

const PIC_STATUS_LABELS = {
  ok:            'OK',
  xlvp:          'XLVP',
  xac_minh_them: 'Xác minh thêm',
};

function downloadExcel(pic, stocks) {
  const rows = stocks.map(s => ({
    'CH':              s.store,
    'Tên CH':          s.store_name,
    'Mã SP':           s.article,
    'Tên SP':          s.article_name,
    'Tồn HT':          s.stock ?? '',
    'Ngày tồn':        s.stock_day ?? '',
    'Tồn hiện tại':    s.current_stock ?? '',
    'Tồn thực tế':     s.counted_stock ?? '',
    'Chênh lệch':      (s.counted_stock !== null && s.counted_stock !== '')
                         ? Number(s.counted_stock) - Number(s.current_stock || 0)
                         : '',
    'Ghi chú NV':      s.note ?? '',
    'Trạng thái PIC':  PIC_STATUS_LABELS[s.pic_status] ?? s.pic_status ?? '',
    'Comment PIC':     s.pic_comment ?? '',
    'Khoảng cách (m)': s.location_check ?? '',
    'Thời gian XN':    s.time_stamp ?? '',
    'Ảnh':             s.image ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
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
