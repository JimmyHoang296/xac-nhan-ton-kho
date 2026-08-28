import styles from './StockList.module.css';

export function AbnormalCard({ record, confirmed, onClick }) {
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
      <p className={styles.articleName}>{record.article_name}</p>
      <p className={styles.articleCode}>{record.article}</p>
      <div className={styles.stockRow}>
        <div className={styles.stockBox}>
          <span className={styles.stockLabel}>Tồn hệ thống</span>
          <span className={styles.stockValue}>{record.stock ?? '—'}</span>
        </div>
        {confirmed && (
          <div className={styles.stockBox}>
            <span className={styles.stockLabel}>Kiểm kho</span>
            <span className={`${styles.stockValue} ${styles.stockConfirmed}`}>{record.counted_stock}</span>
          </div>
        )}
      </div>
      {record.reason && (
        <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#b45309', lineHeight: 1.4 }}>
          ⚠ {record.reason}
        </p>
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
