import styles from './StockList.module.css';

export default function StockList({ storeName, storeCode, stocks, onCardClick }) {
  const pending = stocks.filter(s => s.counted_stock === '' || s.counted_stock === null || s.counted_stock === undefined);
  const confirmed = stocks.filter(s => s.counted_stock !== '' && s.counted_stock !== null && s.counted_stock !== undefined);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.storeTag}>{storeCode}</div>
        <h2 className={styles.storeName}>{storeName}</h2>
        <p className={styles.instruction}>Hướng dẫn: Chọn vào sản phẩm trong danh sách, nhập số tồn và hình ảnh chứa phần lớn sản phẩm cần xác minh</p>
        <div className={styles.stats}>
          <span className={styles.statPending}>{pending.length} chờ xác nhận</span>
          <span className={styles.dot}>·</span>
          <span className={styles.statDone}>{confirmed.length} đã xác nhận</span>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className={styles.empty}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="28" fill="#e6f4ea" />
            <path d="M18 28l8 8 12-14" stroke="#34a853" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className={styles.emptyTitle}>Tất cả đã xác nhận!</p>
          <p className={styles.emptySub}>Không còn sản phẩm nào cần xác nhận.</p>
        </div>
      ) : (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Cần xác nhận</p>
          <div className={styles.grid}>
            {pending.map(stock => (
              <StockCard key={stock.article} stock={stock} onClick={() => onCardClick(stock)} />
            ))}
          </div>
        </div>
      )}

      {confirmed.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Đã xác nhận</p>
          <div className={styles.grid}>
            {confirmed.map(stock => (
              <StockCard key={stock.article} stock={stock} confirmed />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StockCard({ stock, confirmed, onClick }) {
  const thung = stock.thung ? Number(stock.thung) : 0;

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
      <p className={styles.articleName}>{stock.article_name}</p>
      <p className={styles.articleCode}>{stock.article}</p>
      <div className={styles.stockRow}>
        <div className={styles.stockBox}>
          <span className={styles.stockLabel}>Tồn ngày {formatDate(stock.stock_day)}</span>
          <span className={styles.stockValue}>{stock.stock ?? '—'}</span>
        </div>
        {confirmed && (
          <div className={styles.stockBox}>
            <span className={styles.stockLabel}>Kiểm kho</span>
            <span className={`${styles.stockValue} ${styles.stockConfirmed}`}>{stock.counted_stock}</span>
          </div>
        )}
      </div>
      {confirmed && thung > 0 && stock.counted_stock != null && stock.counted_stock !== '' && (
        <div className={styles.thungInfo}>
          <span className={styles.thungLabel}>{thung} SP/thùng →</span>
          <span className={styles.thungValue}>{formatThung(Number(stock.counted_stock), thung)}</span>
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

function formatThung(qty, thung) {
  if (!thung || thung <= 0) return '';
  const boxes = Math.floor(qty / thung);
  const remainder = qty % thung;
  if (remainder === 0) return `${boxes} thùng`;
  return `${boxes} thùng + ${remainder} lẻ`;
}
function formatDate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}