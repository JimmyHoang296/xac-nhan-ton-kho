import { useState, useEffect } from 'react';
import styles from '../pic/PicDashboard.module.css';

const isGrConfirmed = r => r.time_stamp && r.time_stamp !== '';

export default function GrDashboard({
  userKey, grRecords = [], loading, error,
  onRefresh, onLogout, onSwitchProgress, onSwitchStock,
  headerLabel = 'Nhập kho',
}) {
  // Build store info map from grRecords themselves (cht/qlkv come from SQL join)
  const storeInfoMap = grRecords.reduce((map, r) => {
    const key = String(r.site).trim();
    if (!map[key]) map[key] = { cht: r.cht || '', sdt_cht: r.sdt_cht || '', qlkv: r.qlkv || '', sdt_qlkv: r.sdt_qlkv || '' };
    return map;
  }, {});
  const [selectedKey, setSelectedKey] = useState(null);
  const [filter, setFilter]           = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const confirmed = grRecords.filter(isGrConfirmed);
  const pending   = grRecords.filter(r => !isGrConfirmed(r));

  const filtered = filter === 'confirmed' ? confirmed
                 : filter === 'pending'   ? pending
                 : grRecords;

  const byStore = filtered.reduce((acc, r) => {
    if (!acc[r.site]) acc[r.site] = { site: r.site, store_name: r.store_name || '', records: [] };
    acc[r.site].records.push(r);
    return acc;
  }, {});

  const displayedGroups = Object.values(byStore).filter(g => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return String(g.site).toLowerCase().includes(q) || String(g.store_name).toLowerCase().includes(q);
  });

  const currentRecord = selectedKey
    ? grRecords.find(r => `${r.site}-${r.po_number}` === selectedKey)
    : null;

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <p className={styles.headerLabel}>{headerLabel}</p>
            <h1 className={styles.headerPic}>{userKey}</h1>
          </div>

          {!loading && !error && (
            <div className={styles.headerStats}>
              <button className={`${styles.statBox} ${filter === 'all' ? styles.statBoxActive : ''}`}
                onClick={() => setFilter('all')}>
                <span className={styles.statNum}>{grRecords.length}</span>
                <span className={styles.statLabel}>Tổng PO</span>
              </button>
              <button className={`${styles.statBox} ${styles.statBoxDone} ${filter === 'confirmed' ? styles.statBoxActive : ''}`}
                onClick={() => setFilter('confirmed')}>
                <span className={styles.statNum}>{confirmed.length}</span>
                <span className={styles.statLabel}>Đã XN</span>
              </button>
              <button className={`${styles.statBox} ${styles.statBoxPending} ${filter === 'pending' ? styles.statBoxActive : ''}`}
                onClick={() => setFilter('pending')}>
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
            {onSwitchStock && (
              <button className={styles.progressBtn} onClick={onSwitchStock}>Tồn kho</button>
            )}
            {onSwitchProgress && (
              <button className={styles.progressBtn} onClick={onSwitchProgress}>Tổng quan</button>
            )}
            <button className={styles.logoutBtn} onClick={onLogout}>Đăng xuất</button>
          </div>
        </div>
      </header>

      <div className={styles.masterDetail}>
        {/* ── LEFT ── */}
        <div className={`${styles.listPanel} ${selectedKey ? styles.listPanelMobileHidden : ''}`}>
          {loading && <div className={styles.center}><span className={styles.spinner} /></div>}
          {error   && <p className={styles.errorMsg}>{error}</p>}

          {!loading && !error && grRecords.length === 0 && (
            <div className={styles.center}>
              <p className={styles.emptyText}>Không có phiếu nhập kho nào.</p>
            </div>
          )}

          {!loading && !error && grRecords.length > 0 && (
            <>
              <div className={styles.searchBar}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={styles.searchIcon}>
                  <circle cx="11" cy="11" r="7" stroke="#80868b" strokeWidth="2"/>
                  <path d="M16.5 16.5l4 4" stroke="#80868b" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Tìm cửa hàng..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className={styles.searchClear} onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>

              {displayedGroups.length === 0 && (
                <div className={styles.center}>
                  <p className={styles.emptyText}>Không tìm thấy cửa hàng.</p>
                </div>
              )}

              <div className={styles.storeList}>
                {displayedGroups.map(group => {
                  const done = group.records.filter(isGrConfirmed).length;
                  const pend = group.records.length - done;
                  return (
                    <div key={group.site} className={styles.storeGroup}>
                      <div className={styles.storeHeader}>
                        <span className={styles.storeCode}>{group.site}</span>
                        <span className={styles.storeName}>{group.store_name}</span>
                        <span className={`${styles.grStatsRow} ${pend > 0 ? styles.grStatsRowPending : ''}`}
                          style={{ cursor: 'default' }}>
                          <span className={styles.grStatCol}>
                            <span className={`${styles.grStatColNum} ${pend > 0 ? styles.grStatColNumPending : styles.grStatColNumDone}`}>{pend}</span>
                            <span className={styles.grStatColLabel}>Chờ</span>
                          </span>
                          <span className={styles.grStatCol}>
                            <span className={`${styles.grStatColNum} ${styles.grStatColNumDone}`}>{done}</span>
                            <span className={styles.grStatColLabel}>Đã XN</span>
                          </span>
                        </span>
                      </div>

                      {group.records.map(r => {
                        const key  = `${r.site}-${r.po_number}`;
                        const done = isGrConfirmed(r);
                        return (
                          <button
                            key={key}
                            className={`${styles.row} ${done ? styles.rowDone : styles.rowPending} ${selectedKey === key ? styles.rowSelected : ''}`}
                            onClick={() => setSelectedKey(key)}
                          >
                            <div className={styles.rowInfo}>
                              <div className={styles.rowTopLine}>
                                <span className={`${styles.badge} ${done ? styles.badgeDone : styles.badgePending}`}>
                                  {done ? '✓ Đã XN' : 'Chờ XN'}
                                </span>
                                <span className={styles.articleName} style={{ fontWeight: 700 }}>
                                  PO {r.po_number}
                                </span>
                              </div>
                              <div className={styles.metaStrip}>
                                <span className={styles.metaItem} style={{ fontSize: '0.75rem', color: '#5f6368' }}>
                                  {(r.product || r.vendor_name || '—').split('|')[0].trim()}
                                </span>
                                {done && r.confirmed_amount && (
                                  <><span className={styles.metaSep}>·</span>
                                  <span className={`${styles.metaItem} ${styles.metaGreen}`}>{r.confirmed_amount}</span></>
                                )}
                              </div>
                            </div>
                            <div className={styles.rowRight}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={styles.chevronRight}>
                                <path d="M6 4l4 4-4 4" stroke="#bdc1c6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div className={`${styles.detailPane} ${selectedKey ? styles.detailPaneVisible : ''}`}>
          {currentRecord ? (
            <GrRecordDetail
              record={currentRecord}
              storeInfo={storeInfoMap[String(currentRecord.site).trim()]}
              onBack={() => setSelectedKey(null)}
            />
          ) : (
            <div className={styles.detailPlaceholder}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                <path d="M9 12h6M9 16h6M7 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 4h6a1 1 0 010 2H9a1 1 0 010-2z"
                  stroke="#bdc1c6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className={styles.placeholderText}>Chọn phiếu PO để xem chi tiết</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Detail panel ── */
function GrRecordDetail({ record, storeInfo, onBack }) {
  const done = isGrConfirmed(record);

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
          <span className={`${styles.badge} ${done ? styles.badgeDone : styles.badgePending}`}>
            {done ? '✓ Đã XN' : 'Chờ XN'}
          </span>
          <h2 className={styles.detailArticleName} style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            PO {record.po_number}
          </h2>
        </div>

        <div className={styles.detailStoreRow}>
          <span className={styles.storeCode}>{record.site}</span>
          <span className={styles.detailStoreName}>{record.store_name || ''}</span>
        </div>

        {storeInfo && (storeInfo.cht || storeInfo.qlkv) && (
          <div className={styles.contactStrip}>
            {storeInfo.cht && (
              <span className={styles.contactItem}>
                <span className={styles.contactRole}>CHT</span>
                <span className={styles.contactName}>{storeInfo.cht}</span>
                {storeInfo.sdt_cht && (
                  <a href={viberUrl(storeInfo.sdt_cht)} className={styles.contactPhone}>
                    💬 {normalizePhone(storeInfo.sdt_cht)}
                  </a>
                )}
              </span>
            )}
            {storeInfo.qlkv && (
              <span className={styles.contactItem}>
                <span className={styles.contactRole}>QLKV</span>
                <span className={styles.contactName}>{storeInfo.qlkv}</span>
                {storeInfo.sdt_qlkv && (
                  <a href={viberUrl(storeInfo.sdt_qlkv)} className={styles.contactPhone}>
                    💬 {normalizePhone(storeInfo.sdt_qlkv)}
                  </a>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* PO info chips */}
      <div className={styles.chipStrip}>
        <Chip label="Nhà CC"     value={record.vendor_name || record.vendor} />
        <Chip label="Ngày đặt"   value={formatDate(record.document_date)} />
        <Chip label="Giá trị PO" value={formatAmount(record.po_amount, record.currency)} />
        {done && <Chip label="Tình trạng" value={record.confirmed_amount} green />}
        {done && record.time_stamp && <Chip label="XN lúc" value={formatDateTime(record.time_stamp)} />}
      </div>

      {/* Danh sách sản phẩm */}
      {record.product && (
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f3f4' }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#80868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Sản phẩm
          </p>
          {record.product.split('|').map((s, i) => (
            <p key={i} style={{ margin: '2px 0', fontSize: '0.88rem', color: '#3c4043' }}>{s.trim()}</p>
          ))}
        </div>
      )}

      {/* Ghi chú nhân viên */}
      {record.confirm_note && (
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f3f4' }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#80868b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Ghi chú NV
          </p>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#3c4043' }}>{record.confirm_note}</p>
        </div>
      )}

      {/* Ảnh */}
      {record.image && (
        <div className={styles.imgSection}>
          {record.image.split(',').map((url, idx) => (
            <div key={idx} className={styles.imgItem}>
              <img src={url.trim()} alt={`Ảnh ${idx + 1}`} className={styles.confirmImg} />
              <a href={url.trim()} target="_blank" rel="noreferrer" className={styles.imgLink}>
                Mở ảnh {record.image.split(',').length > 1 ? idx + 1 : 'gốc'}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ label, value, green }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.4rem 0.75rem', background: '#f8f9fa', borderRadius: 8, minWidth: 72 }}>
      <span style={{ fontSize: '0.65rem', color: '#80868b', marginBottom: 2 }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: green ? '#137333' : '#3c4043' }}>{value}</span>
    </div>
  );
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return NaN;
  return Number(String(val).replace(/[^\d.-]/g, ''));
}

function formatAmount(val, currency) {
  const n = parseNum(val);
  if (isNaN(n)) return null;
  return `${n.toLocaleString('vi-VN')} ${currency || 'VND'}`;
}

function formatDate(val) {
  if (!val) return null;
  const n = Number(val);
  if (!isNaN(n) && n > 40000) return new Date((n - 25569) * 86400 * 1000).toLocaleDateString('vi-VN');
  const d = new Date(val);
  return isNaN(d) ? val : d.toLocaleDateString('vi-VN');
}

function formatDateTime(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
