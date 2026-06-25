import { useEffect, useState } from 'react';
import styles from './ProgressDashboard.module.css';

export default function PicProgressView({ pic, stocks, loading, error, onRefresh, onLogout, onViewDetail }) {
  const [expanded, setExpanded] = useState({});
  const [sort,     setSort]     = useState({ col: null, dir: 'asc' });

  const groups = buildQlkvGroups(stocks);

  useEffect(() => {
    if (groups.length > 0 && Object.keys(expanded).length === 0) {
      const init = {};
      groups.forEach(g => { init[g.qlkv] = true; });
      setExpanded(init);
    }
  }, [groups.length]);

  const grandTotal = groups.reduce((acc, g) => {
    acc.stores     += g.stores;
    acc.storesDone += g.storesDone;
    acc.articles   += g.articles;
    acc.artDone    += g.artDone;
    return acc;
  }, { stores: 0, storesDone: 0, articles: 0, artDone: 0 });

  function toggleQlkv(qlkv) {
    setExpanded(prev => ({ ...prev, [qlkv]: !prev[qlkv] }));
  }

  function handleSort(col) {
    setSort(prev => ({
      col,
      dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  }

  const sortedGroups = sortGroups(groups, sort);

  const allExpanded = groups.length > 0 && groups.every(g => expanded[g.qlkv]);

  function toggleAll() {
    const next = !allExpanded;
    const updated = {};
    groups.forEach(g => { updated[g.qlkv] = next; });
    setExpanded(updated);
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <p className={styles.headerLabel}>Tổng quan tiến độ</p>
            <h1 className={styles.headerTitle}>{pic}</h1>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.refreshBtn} onClick={onRefresh} title="Làm mới">
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
            <SummaryCard label="Tổng CH"  value={grandTotal.stores} />
            <SummaryCard label="CH xong"  value={grandTotal.storesDone} color="green"
              sub={pct(grandTotal.storesDone, grandTotal.stores)} />
            <SummaryCard label="Tổng mã"  value={grandTotal.articles} />
            <SummaryCard label="Mã đã XN" value={grandTotal.artDone} color="green"
              sub={pct(grandTotal.artDone, grandTotal.articles)} />
          </div>
        )}
      </header>

      <div className={styles.body}>
        {loading && <div className={styles.center}><span className={styles.spinner} /></div>}
        {error   && <p className={styles.errorMsg}>{error}</p>}
        {!loading && !error && groups.length === 0 && (
          <p className={styles.emptyText}>Không có dữ liệu.</p>
        )}

        {!loading && !error && groups.length > 0 && (
          <div className={`${styles.tableWrap} ${styles.tableWrapWide}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thName}>
                    <div className={styles.thNameInner}>
                      <span>QLKV / Cửa hàng</span>
                      <button className={styles.toggleAllBtn} onClick={toggleAll}
                        title={allExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}>
                        {allExpanded ? '⊟ Thu gọn' : '⊞ Mở rộng'}
                      </button>
                    </div>
                  </th>
                  <SortTh col="stores"     sort={sort} onSort={handleSort} cls={styles.thNum}>Số CH</SortTh>
                  <SortTh col="storesDone" sort={sort} onSort={handleSort} cls={styles.thNum}>CH xong</SortTh>
                  <SortTh col="articles"   sort={sort} onSort={handleSort} cls={styles.thNum}>Số mã</SortTh>
                  <SortTh col="artDone"    sort={sort} onSort={handleSort} cls={styles.thNum}>Mã đã XN</SortTh>
                  <SortTh col="pct"        sort={sort} onSort={handleSort} cls={styles.thPct}>Tiến độ</SortTh>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.map(g => (
                  <>
                    {/* QLKV row */}
                    <tr key={g.qlkv} className={styles.ksttRow}
                        onClick={() => toggleQlkv(g.qlkv)}>
                      <td className={styles.ksttCell}>
                        <span className={styles.chevron}>{expanded[g.qlkv] ? '▾' : '▸'}</span>
                        {g.qlkv}
                      </td>
                      <td className={styles.numCell}>{g.stores}</td>
                      <td className={styles.numCell}>
                        <span className={isDone(g.storesDone, g.stores) ? styles.numDone : ''}>{g.storesDone}</span>
                      </td>
                      <td className={styles.numCell}>{g.articles}</td>
                      <td className={styles.numCell}>
                        <span className={isDone(g.artDone, g.articles) ? styles.numDone : ''}>{g.artDone}</span>
                      </td>
                      <td className={styles.pctCell}>
                        <ProgressBar value={g.artDone} total={g.articles} />
                      </td>
                    </tr>

                    {/* Store rows */}
                    {expanded[g.qlkv] && g.storeList.map(s => (
                      <tr key={g.qlkv + '|' + s.store} className={styles.qlkvRow}>
                        <td className={styles.storeCellInner}>
                          <span className={styles.storeCodeInner}>{s.store}</span>
                          <span className={styles.storeNameInner}>{s.store_name}</span>
                        </td>
                        <td className={styles.numCell}>—</td>
                        <td className={styles.numCell}>—</td>
                        <td className={styles.numCell}>{s.articles}</td>
                        <td className={styles.numCell}>
                          <span className={isDone(s.artDone, s.articles) ? styles.numDone : ''}>{s.artDone}</span>
                        </td>
                        <td className={styles.pctCell}>
                          <ProgressBar value={s.artDone} total={s.articles} />
                        </td>
                      </tr>
                    ))}
                  </>
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

function sortGroups(groups, { col, dir }) {
  if (!col) return groups;
  const sign = dir === 'asc' ? 1 : -1;
  return [...groups].sort((a, b) => {
    let va, vb;
    if (col === 'name')     { va = a.qlkv;       vb = b.qlkv; }
    else if (col === 'pct') { va = a.articles ? a.artDone / a.articles : 0; vb = b.articles ? b.artDone / b.articles : 0; }
    else                    { va = a[col] ?? 0;  vb = b[col] ?? 0; }
    if (typeof va === 'string') return sign * va.localeCompare(vb, 'vi');
    return sign * (va - vb);
  });
}

function isDone(a, b) { return b > 0 && a === b; }
function pct(a, b)    { return b ? `${Math.round(a / b * 100)}%` : ''; }

function buildQlkvGroups(stocks) {
  const storeArt = {};
  stocks.forEach(s => {
    const key = String(s.store);
    if (!storeArt[key]) storeArt[key] = { store_name: s.store_name || '', qlkv: s.qlkv || 'Chưa phân công', total: 0, done: 0 };
    storeArt[key].total++;
    if (s.counted_stock !== null && s.counted_stock !== '') storeArt[key].done++;
  });

  const qlkvMap = {};
  Object.entries(storeArt).forEach(([storeCode, { store_name, qlkv, total, done }]) => {
    if (!qlkvMap[qlkv]) qlkvMap[qlkv] = { stores: 0, storesDone: 0, articles: 0, artDone: 0, storeList: [] };
    const cell = qlkvMap[qlkv];
    cell.stores++;
    if (done === total) cell.storesDone++;
    cell.articles += total;
    cell.artDone  += done;
    cell.storeList.push({ store: storeCode, store_name, articles: total, artDone: done });
  });

  return Object.entries(qlkvMap)
    .sort(([a], [b]) => a.localeCompare(b, 'vi'))
    .map(([qlkv, stats]) => ({
      qlkv,
      ...stats,
      storeList: stats.storeList.sort((a, b) => String(a.store).localeCompare(String(b.store))),
    }));
}
