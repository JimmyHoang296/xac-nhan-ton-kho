import { useEffect, useState, useCallback } from 'react';
import { fetchQlkvStocks } from '../api';
import styles from '../pic/ProgressDashboard.module.css';

export default function QlkvProgressView({ username, name, onLogout, onViewDetail }) {
  const [stocks,  setStocks]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [sort,    setSort]    = useState({ col: null, dir: 'asc' });

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

  const rows = buildStoreRows(stocks);

  const grandTotal = rows.reduce((acc, r) => {
    acc.articles += r.articles;
    acc.artDone  += r.artDone;
    return acc;
  }, { articles: 0, artDone: 0 });
  const storesDone = rows.filter(r => r.artDone === r.articles).length;

  function handleSort(col) {
    setSort(prev => ({
      col,
      dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  }

  const sortedRows = sortStoreRows(rows, sort);

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <p className={styles.headerLabel}>Tổng quan tiến độ</p>
            <h1 className={styles.headerTitle}>{name || username}</h1>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.refreshBtn} onClick={load} title="Làm mới">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v5h5M20 20v-5h-5" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.07 13a8 8 0 1013.55-8.36L20 2M20 22l-2.38-2.64A8 8 0 014.07 13" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className={styles.detailBtn} onClick={onViewDetail}>Chi tiết</button>
            <button className={styles.logoutBtn} onClick={onLogout}>Đăng xuất</button>
          </div>
        </div>

        {!loading && !error && stocks.length > 0 && (
          <div className={styles.summaryBar}>
            <SummaryCard label="Tổng CH"  value={rows.length} />
            <SummaryCard label="CH xong"  value={storesDone} color="green"
              sub={fmtPct(storesDone, rows.length)} />
            <SummaryCard label="Tổng mã"  value={grandTotal.articles} />
            <SummaryCard label="Mã đã XN" value={grandTotal.artDone} color="green"
              sub={fmtPct(grandTotal.artDone, grandTotal.articles)} />
          </div>
        )}
      </header>

      <div className={styles.body}>
        {loading && <div className={styles.center}><span className={styles.spinner} /></div>}
        {error   && <p className={styles.errorMsg}>{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className={styles.emptyText}>Không có dữ liệu.</p>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className={`${styles.tableWrap} ${styles.tableWrapWide}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <SortTh col="store"    sort={sort} onSort={handleSort} cls={styles.thName}>Cửa hàng</SortTh>
                  <SortTh col="articles" sort={sort} onSort={handleSort} cls={styles.thNum}>Số mã</SortTh>
                  <SortTh col="artDone"  sort={sort} onSort={handleSort} cls={styles.thNum}>Mã đã XN</SortTh>
                  <SortTh col="pct"      sort={sort} onSort={handleSort} cls={styles.thPct}>Tiến độ</SortTh>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(r => (
                  <tr key={r.store} className={r.artDone === r.articles ? styles.qlkvRow : styles.qlkvRow}>
                    <td className={styles.storeCellInner}>
                      <span className={styles.storeCodeInner}>{r.store}</span>
                      <span className={styles.storeNameInner}>{r.store_name}</span>
                    </td>
                    <td className={styles.numCell}>{r.articles}</td>
                    <td className={styles.numCell}>
                      <span className={r.artDone === r.articles && r.articles > 0 ? styles.numDone : ''}>{r.artDone}</span>
                    </td>
                    <td className={styles.pctCell}>
                      <ProgressBar value={r.artDone} total={r.articles} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, sub }) {
  return (
    <div className={styles.summaryCard}>
      <span className={`${styles.summaryNum} ${color === 'green' ? styles.summaryNumGreen : ''}`}>{value}</span>
      <span className={styles.summaryLabel}>{label}</span>
      {sub && <span className={styles.summarySub}>{sub}</span>}
    </div>
  );
}

function ProgressBar({ value, total }) {
  if (!total) return <span className={styles.pctText}>—</span>;
  const v = Math.round(value / total * 100);
  const cls = v === 100 ? styles.barFull : v >= 50 ? styles.barMid : styles.barLow;
  return (
    <div className={styles.barWrap}>
      <div className={styles.barBg}>
        <div className={`${styles.barFill} ${cls}`} style={{ width: `${v}%` }} />
      </div>
      <span className={styles.pctText}>{v}%</span>
    </div>
  );
}

function SortTh({ col, sort, onSort, cls, children }) {
  const active = sort.col === col;
  return (
    <th className={`${cls} ${styles.thSortable} ${active ? styles.thActive : ''}`}
        onClick={() => onSort(col)}>
      {children}
      <span className={styles.sortArrow}>{active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}</span>
    </th>
  );
}

function sortStoreRows(rows, { col, dir }) {
  if (!col) return rows;
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let va, vb;
    if (col === 'store') { va = `${a.store} ${a.store_name}`; vb = `${b.store} ${b.store_name}`; }
    else if (col === 'pct') { va = a.articles ? a.artDone / a.articles : 0; vb = b.articles ? b.artDone / b.articles : 0; }
    else { va = a[col] ?? 0; vb = b[col] ?? 0; }
    if (typeof va === 'string') return sign * va.localeCompare(vb, 'vi');
    return sign * (va - vb);
  });
}

function fmtPct(a, b) { return b ? `${Math.round(a / b * 100)}%` : ''; }

function buildStoreRows(stocks) {
  const map = {};
  stocks.forEach(s => {
    const key = String(s.store);
    if (!map[key]) map[key] = { store: key, store_name: s.store_name || '', articles: 0, artDone: 0 };
    map[key].articles++;
    if (s.counted_stock !== null && s.counted_stock !== '') map[key].artDone++;
  });
  return Object.values(map).sort((a, b) => String(a.store).localeCompare(String(b.store)));
}
