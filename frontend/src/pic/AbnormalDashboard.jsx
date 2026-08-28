import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { batchSaveAbnormalPicComment, uploadAbnormalStocks, deleteAbnormalStock } from '../api';
import styles from './PicDashboard.module.css';

const PIC_STATUSES = [
  { value: '',      label: '— Chọn trạng thái —' },
  { value: 'next',  label: 'Xác nhận tiếp tuần sau' },
  { value: 'ex1',   label: 'Miễn 1 tuần' },
  { value: 'ex2',   label: 'Miễn 2 tuần' },
  { value: 'ex3',   label: 'Miễn 3 tuần' },
  { value: 'ex4',   label: 'Miễn 4 tuần' },
];
const PIC_STATUS_LABELS = {
  next: 'XN tiếp tuần sau', ex1: 'Miễn 1 tuần', ex2: 'Miễn 2 tuần', ex3: 'Miễn 3 tuần', ex4: 'Miễn 4 tuần',
};

const isConfirmedFn = r => r.counted_stock !== null && r.counted_stock !== '' && r.counted_stock !== undefined;

export default function AbnormalDashboard({
  pic, records = [], setRecords, loading, error,
  onRefresh, onLogout, onSwitchProgress, onSwitchStock, onSwitchGr,
  allowUpload = true, headerLabel = 'Tồn bất thường',
}) {
  const [selectedKey, setSelectedKey]     = useState(null);
  const [filter, setFilter]               = useState('all');
  const [picStatusFilter, setPicStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery]     = useState('');
  const [localChanges, setLocalChanges]   = useState({});
  const [lightboxUrl, setLightboxUrl]     = useState(null);
  const [showUpload, setShowUpload]       = useState(false);
  const [batchSaving, setBatchSaving]     = useState(false);
  const [batchMsg, setBatchMsg]           = useState('');
  const originalsRef = useRef({});

  function handleLocalChange(store, article, comment, status) {
    const key = `${store}-${article}`;
    if (!originalsRef.current[key]) {
      const r = records.find(r => String(r.store) === String(store) && String(r.article) === String(article));
      originalsRef.current[key] = { comment: r?.pic_comment || '', status: r?.pic_status || '' };
    }
    const orig = originalsRef.current[key];
    if (comment === orig.comment && status === orig.status) {
      setLocalChanges(prev => { const next = { ...prev }; delete next[key]; return next; });
    } else {
      setLocalChanges(prev => ({ ...prev, [key]: { store: String(store), article: String(article), comment, pic_status: status } }));
    }
    setRecords(prev => prev.map(r =>
      String(r.store) === String(store) && String(r.article) === String(article)
        ? { ...r, pic_comment: comment, pic_status: status }
        : r
    ));
  }

  const pendingCount = Object.keys(localChanges).length;

  async function handleBatchSave() {
    if (pendingCount === 0) return;
    setBatchSaving(true);
    setBatchMsg('');
    try {
      const items = Object.values(localChanges);
      const result = await batchSaveAbnormalPicComment(pic, items);
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

  async function handleDelete(record) {
    if (!window.confirm(`Xoá "${record.article_name || record.article}" khỏi danh sách tồn bất thường?`)) return;
    try {
      await deleteAbnormalStock(pic, record.store, record.article);
      setRecords(prev => prev.filter(r => !(String(r.store) === String(record.store) && String(r.article) === String(record.article))));
      if (selectedKey === `${record.store}-${record.article}`) setSelectedKey(null);
    } catch (err) {
      alert(`Không xoá được: ${err.message}`);
    }
  }

  const confirmed = records.filter(isConfirmedFn);
  const pending   = records.filter(r => !isConfirmedFn(r));

  const byXnFilter = filter === 'confirmed' ? confirmed : filter === 'pending' ? pending : records;
  const filteredRecords = picStatusFilter === 'all'  ? byXnFilter
    : picStatusFilter === 'none' ? byXnFilter.filter(r => !r.pic_status || r.pic_status === '')
    : byXnFilter.filter(r => r.pic_status === picStatusFilter);

  const picCounts = {
    all:  records.length,
    none: records.filter(r => !r.pic_status || r.pic_status === '').length,
    next: records.filter(r => r.pic_status === 'next').length,
    ex1:  records.filter(r => r.pic_status === 'ex1').length,
    ex2:  records.filter(r => r.pic_status === 'ex2').length,
    ex3:  records.filter(r => r.pic_status === 'ex3').length,
    ex4:  records.filter(r => r.pic_status === 'ex4').length,
  };

  const byStore = filteredRecords.reduce((acc, r) => {
    const key = r.store;
    if (!acc[key]) acc[key] = { store: r.store, store_name: r.store_name, items: [] };
    acc[key].items.push(r);
    return acc;
  }, {});

  const displayedGroups = Object.values(byStore).filter(g => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return String(g.store).toLowerCase().includes(q) || String(g.store_name).toLowerCase().includes(q);
  });

  const currentSelected = selectedKey
    ? records.find(r => `${r.store}-${r.article}` === selectedKey)
    : null;

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <p className={styles.headerLabel}>{headerLabel}</p>
            <h1 className={styles.headerPic}>{pic}</h1>
          </div>

          {!loading && !error && (
            <div className={styles.headerStats}>
              <button className={`${styles.statBox} ${filter === 'all' ? styles.statBoxActive : ''}`} onClick={() => setFilter('all')}>
                <span className={styles.statNum}>{records.length}</span>
                <span className={styles.statLabel}>Tổng SP</span>
              </button>
              <button className={`${styles.statBox} ${styles.statBoxDone} ${filter === 'confirmed' ? styles.statBoxActive : ''}`} onClick={() => setFilter('confirmed')}>
                <span className={styles.statNum}>{confirmed.length}</span>
                <span className={styles.statLabel}>Đã XN</span>
              </button>
              <button className={`${styles.statBox} ${styles.statBoxPending} ${filter === 'pending' ? styles.statBoxActive : ''}`} onClick={() => setFilter('pending')}>
                <span className={styles.statNum}>{pending.length}</span>
                <span className={styles.statLabel}>Chờ XN</span>
              </button>
            </div>
          )}

          <div className={styles.headerRight}>
            <button className={styles.refreshBtn} onClick={onRefresh} title="Làm mới">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v5h5M20 20v-5h-5" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.07 13a8 8 0 1013.55-8.36L20 2M20 22l-2.38-2.64A8 8 0 014.07 13" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {allowUpload && (
              <button className={styles.downloadBtn} onClick={() => setShowUpload(true)} title="Tải danh sách mã hàng bất thường">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21V8M7 13l5-5 5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 20h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Tải DS</span>
              </button>
            )}
            {records.length > 0 && (
              <button className={styles.downloadBtn} onClick={() => downloadExcel(pic, records)} title="Tải Excel">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v13M7 11l5 5 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 20h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Excel</span>
              </button>
            )}
            {onSwitchGr && <button className={styles.progressBtn} onClick={onSwitchGr}>Nhập kho</button>}
            {onSwitchStock && <button className={styles.progressBtn} onClick={onSwitchStock}>Tồn kho</button>}
            {onSwitchProgress && <button className={styles.progressBtn} onClick={onSwitchProgress}>Tổng quan</button>}
            <button className={styles.logoutBtn} onClick={onLogout}>Đăng xuất</button>
          </div>
        </div>

        {!loading && !error && records.length > 0 && (
          <div className={styles.headerFilters}>
            <div className={styles.searchBar}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={styles.searchIcon}>
                <circle cx="11" cy="11" r="7" stroke="#80868b" strokeWidth="2"/>
                <path d="M16.5 16.5l4 4" stroke="#80868b" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                type="text" className={styles.searchInput} placeholder="Tìm cửa hàng (mã hoặc tên)..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && <button className={styles.searchClear} onClick={() => setSearchQuery('')} title="Xóa">✕</button>}
            </div>

            <div className={styles.picFilterBar}>
              {[
                { key: 'all',  label: 'Tất cả' },
                { key: 'none', label: 'Chưa set' },
                { key: 'next', label: 'XN tiếp tuần sau' },
                { key: 'ex1',  label: 'Miễn 1 tuần' },
                { key: 'ex2',  label: 'Miễn 2 tuần' },
                { key: 'ex3',  label: 'Miễn 3 tuần' },
                { key: 'ex4',  label: 'Miễn 4 tuần' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`${styles.pfChip} ${key === 'none' ? styles.pfNone : ''} ${key === 'next' ? styles.pfNext : ''} ${key.startsWith('ex') ? styles.pfEx : ''} ${picStatusFilter === key ? styles.pfChipActive : ''}`}
                  onClick={() => setPicStatusFilter(key)}
                >
                  {label}
                  {picCounts[key] > 0 && <span className={styles.pfCount}>{picCounts[key]}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className={styles.masterDetail}>
        <div className={`${styles.listPanel} ${currentSelected ? styles.listPanelMobileHidden : ''}`}>
          {loading && <div className={styles.center}><span className={styles.spinner} /></div>}
          {error   && <p className={styles.errorMsg}>{error}</p>}

          {!loading && !error && records.length === 0 && (
            <div className={styles.center}>
              <p className={styles.emptyText}>Chưa có mã hàng bất thường nào.</p>
            </div>
          )}

          {!loading && !error && records.length > 0 && (
            <>
              {displayedGroups.length === 0 && (
                <div className={styles.center}><p className={styles.emptyText}>Không tìm thấy cửa hàng phù hợp.</p></div>
              )}
              <div className={styles.storeList}>
                {displayedGroups.map(group => (
                  <div key={group.store} className={styles.storeGroup}>
                    <div className={styles.storeHeader}>
                      <span className={styles.storeCode}>{group.store}</span>
                      <span className={styles.storeName}>{group.store_name}</span>
                      <span className={styles.storeBadge}>
                        {group.items.filter(isConfirmedFn).length}/{group.items.length} XN
                      </span>
                    </div>
                    {group.items.map(record => {
                      const key = `${record.store}-${record.article}`;
                      const isConfirmed = isConfirmedFn(record);
                      return (
                        <Row
                          key={key} record={record} isConfirmed={isConfirmed}
                          isSelected={selectedKey === key} hasUnsaved={!!localChanges[key]}
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

        <div className={`${styles.detailPane} ${currentSelected ? styles.detailPaneVisible : ''}`}>
          {currentSelected ? (
            <DetailPanel
              record={currentSelected}
              onBack={() => setSelectedKey(null)}
              onLocalChange={handleLocalChange}
              onDelete={handleDelete}
              hasUnsaved={!!localChanges[selectedKey]}
              onImageClick={setLightboxUrl}
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

      {(pendingCount > 0 || batchMsg) && (
        <div className={styles.batchBar}>
          {batchMsg && <span className={styles.batchMsg}>{batchMsg}</span>}
          {pendingCount > 0 && (
            <button className={styles.batchBtn} onClick={handleBatchSave} disabled={batchSaving}>
              {batchSaving ? <><span className={styles.spinnerSmall} /> Đang lưu...</> : <>Lưu {pendingCount} thay đổi</>}
            </button>
          )}
        </div>
      )}

      {lightboxUrl && createPortal(
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />, document.body
      )}

      {showUpload && (
        <UploadModal pic={pic} onClose={() => setShowUpload(false)} onDone={() => onRefresh?.()} />
      )}
    </div>
  );
}

function Row({ record, isConfirmed, isSelected, hasUnsaved, onClick }) {
  const diff = isConfirmed ? Number(record.counted_stock) - Number(record.current_stock || 0) : null;
  const statusCls = record.pic_status === 'next' ? styles.picStatusNext
    : ['ex1', 'ex2', 'ex3', 'ex4'].includes(record.pic_status) ? styles.picStatusEx : null;

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
          <span className={styles.articleName}>{record.article_name}</span>
        </div>
        <div className={styles.metaStrip}>
          <span className={styles.metaItem}>{record.article}</span>
          <span className={styles.metaSep}>·</span>
          <span className={styles.metaItem}>HT: <strong>{record.stock ?? '—'}</strong></span>
          {isConfirmed && (
            <>
              <span className={styles.metaSep}>·</span>
              <span className={`${styles.metaItem} ${styles.metaGreen}`}>XN: <strong>{record.counted_stock}</strong></span>
              <span className={styles.metaSep}>·</span>
              <span className={`${styles.metaItem} ${diff < 0 ? styles.metaRed : diff > 0 ? styles.metaBlue : styles.metaGray}`}>
                {diff > 0 ? '+' : ''}{diff}
              </span>
            </>
          )}
        </div>
        {record.reason && (
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#b45309' }}>⚠ {record.reason}</p>
        )}
      </div>
      <div className={styles.rowRight}>
        {hasUnsaved && <span className={styles.unsavedDot} title="Chưa lưu" />}
        {statusCls && <span className={`${styles.picStatusTag} ${statusCls}`}>{PIC_STATUS_LABELS[record.pic_status]}</span>}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={styles.chevronRight}>
          <path d="M6 4l4 4-4 4" stroke="#bdc1c6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}

function DetailPanel({ record, onBack, onLocalChange, onDelete, hasUnsaved, onImageClick }) {
  const [comment, setComment] = useState(record.pic_comment || '');
  const [status,  setStatus]  = useState(record.pic_status  || '');

  useEffect(() => {
    setComment(record.pic_comment || '');
    setStatus(record.pic_status   || '');
  }, [record.store, record.article]);

  const isConfirmed = isConfirmedFn(record);
  const diff = isConfirmed ? Number(record.counted_stock) - Number(record.current_stock || 0) : null;

  function handleStatusChange(val) { setStatus(val); onLocalChange(record.store, record.article, comment, val); }
  function handleCommentChange(val) { setComment(val); onLocalChange(record.store, record.article, val, status); }

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
          <h2 className={styles.detailArticleName}>{record.article_name}</h2>
        </div>
        <div className={styles.detailStoreRow}>
          <span className={styles.storeCode}>{record.store}</span>
          <span className={styles.detailStoreName}>{record.store_name}</span>
          {record.cht && (
            <span className={styles.contactItem}>
              <span className={styles.contactRole}>CHT</span>
              <span className={styles.contactName}>{record.cht}</span>
            </span>
          )}
          {record.qlkv && (
            <span className={styles.contactItem}>
              <span className={styles.contactRole}>QLKV</span>
              <span className={styles.contactName}>{record.qlkv}</span>
            </span>
          )}
        </div>
      </div>

      {record.reason && (
        <div className={styles.noteBox} style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <span className={styles.noteLabel} style={{ color: '#b45309' }}>⚠ Lý do bất thường</span>
          <p className={styles.noteText}>{record.reason}</p>
        </div>
      )}

      <div className={styles.chipStrip}>
        <Chip label="Tồn hệ thống" value={record.stock} />
        <Chip label="Hiện tại"     value={record.current_stock} />
        <Chip label="Kiểm kho"     value={isConfirmed ? record.counted_stock : null} green={isConfirmed} />
        <Chip label="Chênh lệch"
          value={isConfirmed ? (diff > 0 ? `+${diff}` : diff) : null}
          green={isConfirmed && diff >= 0} red={isConfirmed && diff < 0}
        />
        <Chip label="XN lúc" value={formatDateTime(record.time_stamp)} />
        <Chip label="Cách CH"
          value={record.location_check ? `${record.location_check} m` : null}
          green={!!record.location_check && Number(record.location_check) <= 50}
          red={!!record.location_check && Number(record.location_check) > 50}
        />
        {record.lat && record.long && (
          <a href={`https://www.google.com/maps?q=${record.lat},${record.long}`} target="_blank" rel="noreferrer" className={styles.mapBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Vị trí chụp
          </a>
        )}
      </div>

      <div className={styles.detailBody}>
        <div className={styles.detailTop}>
          {record.note && (
            <div className={styles.noteBox}>
              <span className={styles.noteLabel}>Ghi chú nhân viên</span>
              <p className={styles.noteText}>{record.note}</p>
            </div>
          )}

          <div className={styles.commentSection}>
            <div className={styles.picStatusGroup}>
              <label className={styles.commentLabel}>PIC thẩm định</label>
              <select className={styles.statusSelect} value={status} onChange={e => handleStatusChange(e.target.value)}>
                {PIC_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className={styles.picCommentGroup}>
              <label className={styles.commentLabel}>Comment PIC</label>
              <input
                type="text" className={styles.commentInput} placeholder="Nhập nhận xét..."
                value={comment} onChange={e => handleCommentChange(e.target.value)}
              />
              {hasUnsaved && <span className={styles.unsavedLabel}>Chưa lưu lên server</span>}
            </div>
          </div>
        </div>

        {record.image && (
          <div className={styles.imgSection}>
            {record.image.split(',').map((url, idx) => (
              <div key={idx} className={styles.imgItem}>
                <img src={imageUrl(url.trim())} alt={`Ảnh ${idx + 1}`} className={styles.confirmImg}
                  style={{ cursor: 'zoom-in' }} onClick={() => onImageClick(imageUrl(url.trim()))} />
                <a href={url.trim()} target="_blank" rel="noreferrer" className={styles.imgLink}>Mở ảnh gốc</a>
              </div>
            ))}
          </div>
        )}

        {!isConfirmed && (
          <button
            onClick={() => onDelete(record)}
            style={{ marginTop: 14, padding: '8px 14px', borderRadius: 8, border: '1px solid #fca5a5',
              background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Xoá khỏi danh sách (nhập nhầm)
          </button>
        )}
      </div>
    </div>
  );
}

function UploadModal({ pic, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setResult(null); setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
      if (raw.length === 0) throw new Error('File không có dữ liệu.');

      const rows = raw.map(r => ({
        store:        String(pick(r, ['Mã CH', 'store']) ?? '').trim(),
        article:      String(pick(r, ['Mã SP', 'article']) ?? '').trim(),
        article_name: String(pick(r, ['Tên SP', 'article_name']) ?? '').trim(),
        stock:        String(pick(r, ['Tồn hệ thống', 'stock']) ?? '').trim(),
        reason:       String(pick(r, ['Lý do', 'Lý do bất thường', 'reason']) ?? '').trim(),
      })).filter(r => r.store && r.article);

      if (rows.length === 0) throw new Error('Không có dòng hợp lệ (thiếu Mã CH hoặc Mã SP).');

      const res = await uploadAbnormalStocks(pic, rows);
      setResult(res);
      if (res.inserted > 0) onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={U.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={U.sheet}>
        <div style={U.header}>
          <h2 style={U.title}>Tải danh sách tồn bất thường</h2>
          <button style={U.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p style={U.desc}>
          File Excel (.xlsx) với các cột: <b>Mã CH</b>, <b>Mã SP</b>, Tên SP, Tồn hệ thống, Lý do.
          Danh sách sẽ được <b>cộng dồn</b> — mã hàng đã có sẵn (cùng CH + mã SP) sẽ bị bỏ qua.
        </p>
        <button type="button" style={U.templateBtn} onClick={downloadTemplate}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v13M7 11l5 5 5-5" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 20h14" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Tải file mẫu
        </button>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={busy} style={U.file} />
        {busy && <p style={U.busy}>Đang xử lý…</p>}
        {error && <p style={U.error}>{error}</p>}
        {result && (
          <div style={U.result}>
            <p>✓ Thêm mới: <b>{result.inserted}</b></p>
            <p>⏭ Bỏ qua (trùng): <b>{result.skipped}</b></p>
            {result.errors?.length > 0 && (
              <p style={{ color: '#dc2626' }}>Lỗi: {result.errors.join('; ')}</p>
            )}
          </div>
        )}
        <button style={U.doneBtn} onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}

function downloadTemplate() {
  const rows = [
    { 'Mã CH': '1234', 'Mã SP': '567890', 'Tên SP': 'Tên sản phẩm mẫu', 'Tồn hệ thống': '10', 'Lý do': 'Tồn lâu không xuất bán' },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(key => ({ wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 4 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tồn bất thường');
  XLSX.writeFile(wb, 'Mau_TonBatThuong.xlsx');
}

function pick(row, keys) {
  for (const k of keys) {
    const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
    if (found && row[found] !== '') return row[found];
  }
  return '';
}

const U = {
  overlay: { position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 10px 40px rgba(0,0,0,0.3)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: '#111' },
  closeBtn: { border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#5f6368' },
  desc: { fontSize: 13, color: '#5f6368', lineHeight: 1.5, margin: '4px 0 14px' },
  templateBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
    border: '1px solid #c8dafc', background: '#eff6ff', color: '#1a73e8', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', marginBottom: 14 },
  file: { display: 'block', fontSize: 14, marginBottom: 10 },
  busy: { fontSize: 13, color: '#1a73e8' },
  error: { fontSize: 13, color: '#dc2626' },
  result: { background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, margin: '10px 0', lineHeight: 1.7 },
  doneBtn: { marginTop: 10, width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
};

function Chip({ label, value, green, red }) {
  const cls = [styles.chipValue, green ? styles.chipGreen : '', red ? styles.chipRed : ''].join(' ');
  return (
    <div className={styles.chip}>
      <span className={styles.chipLabel}>{label}</span>
      <span className={cls}>{value ?? '—'}</span>
    </div>
  );
}

function Lightbox({ url, onClose }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh', cursor: 'default' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: -14, right: -14, width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#fff', color: '#111', fontSize: 22, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 1 }}>×</button>
        <img src={url} alt="Ảnh phóng to" style={{ maxWidth: '92vw', maxHeight: '88vh', height: 'auto', display: 'block', borderRadius: 8, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', background: '#fff' }} />
      </div>
    </div>
  );
}

function downloadExcel(pic, records) {
  const rows = records.map(r => ({
    'CH': r.store, 'Tên CH': r.store_name, 'Mã SP': r.article, 'Tên SP': r.article_name,
    'Tồn hệ thống': r.stock ?? '', 'Lý do bất thường': r.reason ?? '',
    'Tồn hiện tại': r.current_stock ?? '', 'Tồn thực tế': r.counted_stock ?? '',
    'Chênh lệch': isConfirmedFn(r) ? Number(r.counted_stock) - Number(r.current_stock || 0) : '',
    'Ghi chú NV': r.note ?? '', 'PIC thẩm định': PIC_STATUS_LABELS[r.pic_status] ?? '',
    'Comment PIC': r.pic_comment ?? '', 'Thời gian XN': r.time_stamp ?? '', 'Ảnh': r.image ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] || {}).map(key => ({ wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tồn bất thường');
  const today = new Date();
  const ds = `${String(today.getDate()).padStart(2,'0')}${String(today.getMonth()+1).padStart(2,'0')}${today.getFullYear()}`;
  XLSX.writeFile(wb, `TonBatThuong_${pic}_${ds}.xlsx`);
}

function imageUrl(url) {
  if (url.includes('cloudinary.com') || url.includes('res.cloudinary.com')) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
  return url;
}

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
