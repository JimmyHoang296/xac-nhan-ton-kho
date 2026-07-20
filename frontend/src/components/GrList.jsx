import styles from './GrList.module.css';

export function GrCard({ record, confirmed, onClick }) {
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
