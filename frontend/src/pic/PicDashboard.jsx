import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { batchSavePicComment } from '../api';
import styles from './PicDashboard.module.css';

export default function PicDashboard({ pic, stocks, setStocks, grRecords = [], loading, error, onRefresh, onLogout, onSwitchProgress, onSwitchGr }) {
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [detailTab, setDetailTab] = useState('stock'); // 'stock' | 'gr'
  const [filter, setFilter] = useState('all');
  const [picStatusFilter, setPicStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyPendingStores, setShowOnlyPendingStores] = useState(false);
  const [localChanges, setLocalChanges] = useState({});
  const originalsRef = useRef({});
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');

  function handleLocalChange(store, article, comment, status) {
    const key = `${store}-${article}`;
    if (!originalsRef.current[key]) {
      const s = stocks.find(s => String(s.store) === String(store) && String(s.article) === String(article));
      originalsRef.current[key] = { comment: s?.pic_comment || '', status: s?.pic_status || '' };
    }
    const orig = originalsRef.current[key];
    if (comment === orig.comment && status === orig.status) {
      setLocalChanges(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setLocalChanges(prev => ({
        ...prev,
        [key]: { store: String(store), article: String(article), comment, pic_status: status },
      }));
    }
    setStocks(prev => prev.map(s =>
      String(s.store) === String(store) && String(s.article) === String(article)
        ? { ...s, pic_comment: comment, pic_status: status }
        : s
    ));
  }

  const pendingCount = Object.keys(localChanges).length;

  async function handleBatchSave() {
    if (pendingCount === 0) return;
    setBatchSaving(true);
    setBatchMsg('');
    try {
      const items = Object.values(localChanges);
      console.log('[BatchSave] sending', items.length, 'items:', JSON.stringify(items));
      const result = await batchSavePicComment(pic, items);
      console.log('[BatchSave] result:', JSON.stringify(result));
      setLocalChanges({});
      originalsRef.current = {};
      const msg = result.errors && result.errors.length > 0
        ? `Lưu ${result.saved}/${result.total}, lỗi: ${result.errors.join(', ')}`
        : `Đã lưu ${result.saved}/${result.total} mục`;
      setBatchMsg(msg);
      setTimeout(() => setBatchMsg(''), 5000);
    } catch (err) {
      setBatchMsg(`Lỗi: ${err.message}`);
    } finally {
      setBatchSaving(false);
    }
  }

  const confirmed = stocks.filter(s => s.counted_stock !== null && s.counted_stock !== '');
  const pending   = stocks.filter(s => s.counted_stock === null || s.counted_stock === '');

  const isConfirmedFn = s => s.counted_stock !== null && s.counted_stock !== '';
  const byXnFilter = filter === 'confirmed' ? stocks.filter(isConfirmedFn)
                   : filter === 'pending'   ? stocks.filter(s => !isConfirmedFn(s))
                   : stocks;

  const byPicStatus = picStatusFilter === 'all'  ? byXnFilter
    : picStatusFilter === 'none' ? byXnFilter.filter(s => !s.pic_status || s.pic_status === '')
    : byXnFilter.filter(s => s.pic_status === picStatusFilter);

  const filteredStocks = riskFilter === 'all' ? byPicStatus
    : riskFilter === 'none' ? byPicStatus.filter(s => !s.risk || String(s.risk).trim() === '')
    : byPicStatus.filter(s => normalizeRisk(s.risk) === riskFilter);

  const picCounts = {
    all:           stocks.length,
    none:          stocks.filter(s => !s.pic_status || s.pic_status === '').length,
    ok:            stocks.filter(s => s.pic_status === 'ok').length,
    xlvp:          stocks.filter(s => s.pic_status === 'xlvp').length,
    xac_minh_them: stocks.filter(s => s.pic_status === 'xac_minh_them').length,
  };

  const riskCounts = {
    all:  stocks.length,
    none:   stocks.filter(s => !s.risk || String(s.risk).trim() === '').length,
    ratcao: stocks.filter(s => normalizeRisk(s.risk) === 'ratcao').length,
    cao:    stocks.filter(s => normalizeRisk(s.risk) === 'cao').length,
    tb:     stocks.filter(s => normalizeRisk(s.risk) === 'tb').length,
    thap:   stocks.filter(s => normalizeRisk(s.risk) === 'thap').length,
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

  // GR data grouped by store
  const grByStore = grRecords.reduce((acc, r) => {
    if (!acc[r.site]) acc[r.site] = [];
    acc[r.site].push(r);
    return acc;
  }, {});

  const isGrConfirmed = r => r.time_stamp !== null && r.time_stamp !== '' && r.time_stamp !== undefined;

  function handleSelectStock(key, store) {
    setSelectedKey(key);
    setSelectedStore(store);
    setDetailTab('stock');
  }

  function handleSelectGr(store) {
    setSelectedKey(null);
    setSelectedStore(store);
    setDetailTab('gr');
  }

  function handleBackToList() {
    setSelectedKey(null);
    setSelectedStore(null);
  }


  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <p className={styles.headerLabel}>PIC Dashboard</p>
            <h1 className={styles.headerPic}>{pic}</h1>
          </div>

          {!loading && !error && (() => {
            const reviewed = stocks.filter(s => s.pic_status && s.pic_status !== '').length;
            const reviewRate = confirmed.length > 0
              ? Math.round(reviewed / confirmed.length * 100)
              : 0;
            return (
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
              <div className={`${styles.statBox} ${styles.statBoxReview}`}>
                <span className={styles.statNum}>{reviewed}<span className={styles.statSlash}>/{confirmed.length}</span></span>
                <span className={styles.statLabel}>Thẩm định</span>
                <span className={styles.statRate}>{reviewRate}%</span>
              </div>
            </div>
            );
          })()}

          <div className={styles.headerRight}>
            <button className={styles.refreshBtn} onClick={onRefresh} title="Làm mới">
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
            {onSwitchGr && (
              <button className={styles.progressBtn} onClick={onSwitchGr}>Nhập kho</button>
            )}
            {onSwitchProgress && (
              <button className={styles.progressBtn} onClick={onSwitchProgress}>Tổng quan</button>
            )}
            <button className={styles.logoutBtn} onClick={onLogout}>Đăng xuất</button>
          </div>
        </div>
      </header>

      <div className={styles.masterDetail}>
        {/* ── LEFT: List panel ── */}
        <div className={`${styles.listPanel} ${selectedStore ? styles.listPanelMobileHidden : ''}`}>
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

              {/* Filter chips theo risk */}
              <div className={styles.picFilterBar}>
                {[
                  { key: 'all',    label: 'Risk: Tất cả', cls: '' },
                  { key: 'ratcao', label: 'Rất cao',      cls: styles.rfVeryHigh },
                  { key: 'cao',    label: 'Cao',          cls: styles.rfHigh },
                  { key: 'tb',     label: 'Trung bình',   cls: styles.rfMedium },
                  { key: 'thap',   label: 'Thấp',         cls: styles.rfLow },
                  { key: 'none', label: 'Chưa set',      cls: styles.pfNone },
                ].map(({ key, label, cls }) => (
                  <button
                    key={key}
                    className={`${styles.pfChip} ${cls} ${riskFilter === key ? styles.pfChipActive : ''}`}
                    onClick={() => setRiskFilter(key)}
                  >
                    {label}
                    {riskCounts[key] > 0 && <span className={styles.pfCount}>{riskCounts[key]}</span>}
                  </button>
                ))}
              </div>

              {displayedGroups.length === 0 && (
                <div className={styles.center}>
                  <p className={styles.emptyText}>Không tìm thấy cửa hàng phù hợp.</p>
                </div>
              )}

              <div className={styles.storeList}>
                {displayedGroups.map(group => {
                  const grItems = grByStore[group.store] || [];
                  const grPending = grItems.filter(r => !isGrConfirmed(r)).length;
                  const grDone = grItems.length - grPending;
                  const grRate = grItems.length > 0 ? Math.round(grDone / grItems.length * 100) : 0;
                  return (
                    <div key={group.store} className={styles.storeGroup}>
                      <div className={styles.storeHeader}>
                        <span className={styles.storeCode}>{group.store}</span>
                        <span className={styles.storeName}>{group.store_name}</span>
                        <span className={styles.storeBadge}>
                          {group.items.filter(i => i.counted_stock !== null && i.counted_stock !== '').length}
                          /{group.items.length} XN
                        </span>
                        <button
                          className={`${styles.grStatsRow} ${grPending > 0 ? styles.grStatsRowPending : ''}`}
                          onClick={e => { e.stopPropagation(); handleSelectGr(group.store); }}
                        >
                          <span className={styles.grStatCol}>
                            <span className={`${styles.grStatColNum} ${grPending > 0 ? styles.grStatColNumPending : styles.grStatColNumDone}`}>{grPending}</span>
                            <span className={styles.grStatColLabel}>PO chờ</span>
                          </span>
                          <span className={styles.grStatCol}>
                            <span className={`${styles.grStatColNum} ${styles.grStatColNumDone}`}>{grDone}</span>
                            <span className={styles.grStatColLabel}>Đã XN</span>
                          </span>
                          <span className={styles.grStatCol}>
                            <span className={`${styles.grStatColNum} ${styles.grStatColNumRate}`}>{grRate}%</span>
                            <span className={styles.grStatColLabel}>Tỷ lệ</span>
                          </span>
                        </button>
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
                            hasUnsaved={!!localChanges[key]}
                            onClick={() => handleSelectStock(key, stock.store)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Detail pane ── */}
        <div className={`${styles.detailPane} ${selectedStore ? styles.detailPaneVisible : ''}`}>
          {selectedStore ? (
            <>
              {/* Tab bar */}
              <div className={styles.detailTabs}>
                <button
                  className={`${styles.detailTabBtn} ${detailTab === 'stock' ? styles.detailTabActive : ''}`}
                  onClick={() => setDetailTab('stock')}
                >Tồn kho</button>
                <button
                  className={`${styles.detailTabBtn} ${detailTab === 'gr' ? styles.detailTabActive : ''}`}
                  onClick={() => setDetailTab('gr')}
                >
                  Phiếu NK
                  {(() => { const p = (grByStore[selectedStore] || []).filter(r => !isGrConfirmed(r)).length; return p > 0 ? <span className={styles.detailTabBadge}>{p}</span> : null; })()}
                </button>
              </div>

              {detailTab === 'stock' ? (
                currentSelectedStock ? (
                  <DetailPanel
                    stock={currentSelectedStock}
                    onBack={handleBackToList}
                    onLocalChange={handleLocalChange}
                    hasUnsaved={!!localChanges[selectedKey]}
                  />
                ) : (
                  <div className={styles.detailPlaceholder}>
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12h6M9 16h6M7 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 4h6a1 1 0 010 2H9a1 1 0 010-2z"
                        stroke="#bdc1c6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className={styles.placeholderText}>Chọn sản phẩm để xem chi tiết</p>
                  </div>
                )
              ) : (
                <GrDetailPane
                  records={grByStore[selectedStore] || []}
                  onBack={handleBackToList}
                />
              )}
            </>
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

      {/* Floating batch save */}
      {(pendingCount > 0 || batchMsg) && (
        <div className={styles.batchBar}>
          {batchMsg && <span className={styles.batchMsg}>{batchMsg}</span>}
          {pendingCount > 0 && (
            <button className={styles.batchBtn} onClick={handleBatchSave} disabled={batchSaving}>
              {batchSaving
                ? <><span className={styles.spinnerSmall} /> Đang lưu...</>
                : <>Lưu {pendingCount} thay đổi</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   StockRow — compact clickable list item
───────────────────────────────────────── */
function StockRow({ stock, isConfirmed, isSelected, hasUnsaved, onClick }) {
  const diff = isConfirmed
    ? Number(stock.counted_stock) - Number(stock.current_stock || 0)
    : null;

  const statusCls = stock.pic_status === 'ok'            ? styles.picStatusOk
                  : stock.pic_status === 'xlvp'          ? styles.picStatusXlvp
                  : stock.pic_status === 'xac_minh_them' ? styles.picStatusXacMinhThem
                  : null;

  return (
    <button
      className={`${styles.row} ${isConfirmed ? styles.rowDone : styles.rowPending} ${isSelected ? styles.rowSelected : ''} ${hasUnsaved ? styles.rowUnsaved : ''}`}
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
        {hasUnsaved && <span className={styles.unsavedDot} title="Chưa lưu" />}
        {riskTagEl(stock.risk)}
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
function DetailPanel({ stock, onBack, onLocalChange, hasUnsaved }) {
  const [comment, setComment] = useState(stock.pic_comment || '');
  const [status,  setStatus]  = useState(stock.pic_status  || '');

  useEffect(() => {
    setComment(stock.pic_comment || '');
    setStatus(stock.pic_status   || '');
  }, [stock.store, stock.article]);

  const isConfirmed = stock.counted_stock !== null && stock.counted_stock !== '';
  const diff = isConfirmed
    ? Number(stock.counted_stock) - Number(stock.current_stock || 0)
    : null;

  function handleStatusChange(val) {
    setStatus(val);
    onLocalChange(stock.store, stock.article, comment, val);
  }

  function handleCommentChange(val) {
    setComment(val);
    onLocalChange(stock.store, stock.article, val, status);
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
          {riskTagEl(stock.risk)}
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
                  <a href={viberUrl(stock.sdt_cht)} className={styles.contactPhone}>
                    💬 {normalizePhone(stock.sdt_cht)}
                  </a>
                )}
              </span>
            )}
            {stock.qlkv && (
              <span className={styles.contactItem}>
                <span className={styles.contactRole}>QLKV</span>
                <span className={styles.contactName}>{stock.qlkv}</span>
                {stock.sdt_qlkv && (
                  <a href={viberUrl(stock.sdt_qlkv)} className={styles.contactPhone}>
                    💬 {normalizePhone(stock.sdt_qlkv)}
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
        {thungInfo(stock)}
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
            <label className={styles.commentLabel}>PIC thẩm định</label>
            <select
              className={styles.statusSelect}
              value={status}
              onChange={e => handleStatusChange(e.target.value)}
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
              onChange={e => handleCommentChange(e.target.value)}
            />
            {hasUnsaved && <span className={styles.unsavedLabel}>Chưa lưu lên server</span>}
          </div>
        </div>

        {/* Images below */}
        {stock.image && (
          <div className={styles.imgSection}>
            {stock.image.split(',').map((url, idx) => (
              <div key={idx} className={styles.imgItem}>
                <img
                  src={imageUrl(url.trim())}
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

/* ─────────────────────────────────────────
   GrDetailPane — GR records for a store
───────────────────────────────────────── */
function GrDetailPane({ records, onBack }) {
  const isGrConfirmedFn = r => r.time_stamp !== null && r.time_stamp !== '' && r.time_stamp !== undefined;
  const confirmedCount = records.filter(isGrConfirmedFn).length;

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
          <h2 className={styles.detailArticleName}>Phiếu nhập kho</h2>
          <span className={styles.badge} style={{ background: '#e6f4ea', color: '#137333' }}>
            {confirmedCount}/{records.length} đã XN
          </span>
        </div>
      </div>

      {records.length === 0 ? (
        <div className={styles.grEmptyPane}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M9 12h6M9 16h6M7 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 4h6a1 1 0 010 2H9a1 1 0 010-2z"
              stroke="#bdc1c6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p>Cửa hàng này không có phiếu nhập kho</p>
        </div>
      ) : (
        <div className={styles.grPane}>
          {records.map(r => {
            const isDone = isGrConfirmedFn(r);
            return (
              <div key={r.po_number}
                className={`${styles.grRecord} ${isDone ? styles.grRecordConfirmed : styles.grRecordPending}`}
              >
                <div className={styles.grRecordTop}>
                  <span className={styles.grPoNum}>PO {r.po_number}</span>
                  <span className={`${styles.grBadgeSmall} ${isDone ? styles.grBadgeSmallDone : styles.grBadgeSmallPending}`}>
                    {isDone ? '✓ Đã XN' : 'Chờ XN'}
                  </span>
                </div>
                <p className={styles.grProductName}>{r.product || r.vendor_name || '—'}</p>
                <div className={styles.grMeta}>
                  <span className={styles.grMetaItem}>
                    PO: {fmtAmount(r.po_amount)} {r.currency || 'VND'}
                  </span>
                  {isDone && (
                    <span className={styles.grMetaItem}>
                      Nhận: <strong>{r.confirmed_amount ? Number(r.confirmed_amount).toLocaleString('vi-VN') : '0'}</strong>
                    </span>
                  )}
                  {r.time_stamp && (
                    <span className={styles.grMetaItem}>{formatDateTime(r.time_stamp)}</span>
                  )}
                </div>
                {(r.pic_status || r.pic_comment) && (
                  <div className={styles.grPicCommentBox}>
                    {r.pic_status && (
                      <span className={styles.grMetaItem} style={{ fontWeight: 600 }}>
                        PIC: {r.pic_status === 'ok' ? 'OK' : r.pic_status === 'xlvp' ? 'XLVP' : 'Xác minh thêm'}
                      </span>
                    )}
                    {r.pic_comment && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#444' }}>{r.pic_comment}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function normalizeRisk(risk) {
  if (!risk) return '';
  const r = String(risk).toLowerCase().trim();
  if (r === 'rất cao' || r === 'rat cao' || r === 'ratcao') return 'ratcao';
  if (r === 'cao') return 'cao';
  if (r === 'trung bình' || r === 'trung binh' || r === 'tb') return 'tb';
  if (r === 'thấp' || r === 'thap') return 'thap';
  return '';
}

/* ── Risk & Thùng helpers ── */
function riskTagEl(risk) {
  if (!risk) return null;
  const r = String(risk).toLowerCase().trim();
  const cls = (r === 'rất cao' || r === 'rat cao' || r === 'ratcao') ? styles.riskVeryHigh
    : r === 'cao' ? styles.riskHigh
    : (r === 'trung bình' || r === 'trung binh' || r === 'tb') ? styles.riskMedium
    : (r === 'thấp' || r === 'thap') ? styles.riskLow
    : null;
  if (!cls) return null;
  return <span className={`${styles.riskTag} ${cls}`}>{risk}</span>;
}

function formatThung(qty, thung) {
  if (!thung || thung <= 0) return '';
  const boxes = Math.floor(qty / thung);
  const remainder = qty % thung;
  if (remainder === 0) return `${boxes} thùng`;
  return `${boxes} thùng + ${remainder} lẻ`;
}

function thungInfo(stock) {
  const thung = stock.thung ? Number(stock.thung) : 0;
  if (!thung) return null;
  const isConfirmed = stock.counted_stock !== null && stock.counted_stock !== '';
  const qty = isConfirmed ? Number(stock.counted_stock) : null;
  return (
    <div className={styles.thungChip}>
      <span>📦</span>
      <span className={styles.thungChipText}>
        {thung} SP/thùng
        {qty != null && ` → ${formatThung(qty, thung)}`}
      </span>
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
      'Loại':        'QLKV',
      'QLKV':        qlkv,
      'Mã CH':       '',
      'Tên CH':      '',
      'Số mã':       allItems.length,
      'Số mã đã XN': confAll.length,
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
        'Số mã đã XN': conf.length,
      });
    });

    rows.push({ 'Loại': '', 'QLKV': '', 'Mã CH': '', 'Tên CH': '', 'Số mã': '', 'Số mã đã XN': '' });
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
    'QLKV':            s.qlkv ?? '',
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
    'PIC thẩm định':   PIC_STATUS_LABELS[s.pic_status] ?? s.pic_status ?? '',
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

function imageUrl(url) {
  if (url.includes('cloudinary.com') || url.includes('res.cloudinary.com')) return url;
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

function fmtAmount(val) {
  if (!val && val !== 0) return '—';
  const n = Number(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? '—' : n.toLocaleString('vi-VN');
}

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('0') ? digits : '0' + digits;
}

function viberUrl(raw) {
  const phone = normalizePhone(raw);
  if (!phone) return '#';
  const intl = '+84' + phone.slice(1);
  return `viber://chat?number=${encodeURIComponent(intl)}`;
}
