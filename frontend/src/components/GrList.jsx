import styles from './GrList.module.css';

const isConfirmed = r => r.time_stamp !== null && r.time_stamp !== '' && r.time_stamp !== undefined;

export default function GrList({ records, storeCode, storeName, onCardClick }) {
  const pending = records.filter(r => !isConfirmed(r));
  const confirmed = records.filter(isConfirmed);

  if (records.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <div className={styles.storeTag}>{storeCode}</div>
          <h2 className={styles.storeName}>{storeName}</h2>
          <div className={styles.stats}>
            <span className={styles.statDone}>Không có phiếu nhập kho nào</span>
          </div>
        </div>
        <div className={styles.empty}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="28" fill="#e8f0fe" />
            <path d="M18 28h20M28 18v20" stroke="#1a73e8" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p className={styles.emptyTitle}>Không có phiếu nhập kho</p>
          <p className={styles.emptySub}>Cửa hàng này không có phiếu giao hàng cần xác nhận.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>


      {pending.length === 0 ? (
        <div className={styles.empty}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="28" fill="#e6f4ea" />
            <path d="M18 28l8 8 12-14" stroke="#34a853" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className={styles.emptyTitle}>Tất cả phiếu đã xác nhận!</p>
          <p className={styles.emptySub}>Không còn phiếu nhập kho nào chờ xác nhận.</p>
        </div>
      ) : (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Cần xác nhận</p>
          <div className={styles.grid}>
            {pending.map(r => (
              <GrCard key={r.po_number} record={r} onClick={() => onCardClick(r)} />
            ))}
          </div>
        </div>
      )}

      {confirmed.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Đã xác nhận</p>
          <div className={styles.grid}>
            {confirmed.map(r => (
              <GrCard key={r.po_number} record={r} confirmed />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GrCard({ record, confirmed, onClick }) {
  const confirmedStatus = record.confirmed_amount && record.confirmed_amount !== '' ? record.confirmed_amount : null;

  return (
    <button
      className={`${styles.card} ${confirmed ? styles.cardDone : styles.cardPending}`}
      onClick={onClick}
      disabled={confirmed}
    >
      <div className={styles.cardBadge}>
        {confirmed
          ? <span className={styles.badgeDone}>✓ Đã xác nhận</span>
          : <span className={styles.badgePending}>Chờ xác nhận</span>}
      </div>

      <p className={styles.poNumber} style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1a1a1a', margin: '6px 0 2px' }}>
        PO {record.po_number}
      </p>
      <p style={{ margin: '0 0 6px', fontSize: '0.78rem', color: '#5f6368', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
        {(record.product || '(Không có tên sản phẩm)').split('|').map(s => s.trim()).filter(Boolean).join('\n')}
      </p>

      <div className={styles.infoRow}>
        <div className={styles.infoBox}>
          <span className={styles.infoLabel}>Nhà cung cấp</span>
          <span className={styles.infoValue}>{record.vendor_name || record.vendor || '—'}</span>
        </div>
        {record.document_date && (
          <div className={styles.infoBox}>
            <span className={styles.infoLabel}>Ngày đặt</span>
            <span className={styles.infoValue}>{formatDate(record.document_date)}</span>
          </div>
        )}
      </div>

      {confirmed && confirmedStatus && (
        <div className={styles.confirmedRow}>
          <span className={styles.confirmedLabel}>Tình trạng:</span>
          <span className={styles.confirmedValue}>{confirmedStatus}</span>
        </div>
      )}
      {!confirmed && (
        <div className={styles.cardArrow}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  );
}

function formatDate(val) {
  if (!val) return '';
  const n = Number(val);
  if (!isNaN(n) && n > 40000) {
    // Excel serial date
    const d = new Date((n - 25569) * 86400 * 1000);
    return d.toLocaleDateString('vi-VN');
  }
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString('vi-VN');
}
