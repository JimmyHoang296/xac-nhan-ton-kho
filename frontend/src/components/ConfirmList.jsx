import styles from './ConfirmList.module.css';
import { StockCard } from './StockList';
import { GrCard } from './GrList';

const isStockConfirmed = s => s.counted_stock !== '' && s.counted_stock !== null && s.counted_stock !== undefined;
const isGrConfirmed = r => r.time_stamp !== null && r.time_stamp !== '' && r.time_stamp !== undefined;

export default function ConfirmList({ stocks, grRecords, onStockClick, onGrClick }) {
  const stockPending = stocks.filter(s => !isStockConfirmed(s));
  const stockConfirmed = stocks.filter(isStockConfirmed);
  const grPending = grRecords.filter(r => !isGrConfirmed(r));
  const grConfirmed = grRecords.filter(isGrConfirmed);

  const pendingCount = stockPending.length + grPending.length;
  const confirmedCount = stockConfirmed.length + grConfirmed.length;

  return (
    <div className={styles.wrapper}>
      {pendingCount === 0 ? (
        <div className={styles.empty}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="28" fill="#e6f4ea" />
            <path d="M18 28l8 8 12-14" stroke="#34a853" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className={styles.emptyTitle}>Tất cả đã xác nhận!</p>
          <p className={styles.emptySub}>Không còn mục nào cần xác nhận.</p>
        </div>
      ) : (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Cần xác nhận</p>
          <div className={styles.grid}>
            {stockPending.map(stock => (
              <StockCard key={`s-${stock.article}`} stock={stock} onClick={() => onStockClick(stock)} />
            ))}
            {grPending.map(record => (
              <GrCard key={`g-${record.po_number}`} record={record} onClick={() => onGrClick(record)} />
            ))}
          </div>
        </div>
      )}

      {confirmedCount > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Đã xác nhận</p>
          <div className={styles.grid}>
            {stockConfirmed.map(stock => (
              <StockCard key={`s-${stock.article}`} stock={stock} confirmed />
            ))}
            {grConfirmed.map(record => (
              <GrCard key={`g-${record.po_number}`} record={record} confirmed />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
