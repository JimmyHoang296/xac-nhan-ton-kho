import { useEffect, useState, useCallback } from 'react';
import { fetchProgress } from '../api';
import styles from './ProgressDashboard.module.css';

export default function ProgressDashboard({ pic, onLogout }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [expKstt,  setExpKstt]  = useState({});
  const [sort,     setSort]     = useState({ col: null, dir: 'asc' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchProgress(pic);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pic]);

  useEffect(() => { load(); }, [load]);

  const groups = data ? buildGroups(data) : [];

  // Expand all PIC by default on first load
  useEffect(() => {
    if (groups.length > 0 && Object.keys(expKstt).length === 0) {
      const init = {};
      groups.forEach(g => { init[g.pic] = true; });
      setExpKstt(init);
    }
  }, [groups.length]);

  const grandTotal = groups.reduce((acc, g) => {
    acc.stores     += g.stores;
    acc.storesDone += g.storesDone;
    acc.articles   += g.articles;
    acc.artDone    += g.artDone;
    return acc;
  }, { stores: 0, storesDone: 0, articles: 0, artDone: 0 });

  function togglePic(pic) {
    setExpKstt(prev => ({ ...prev, [pic]: !prev[pic] }));
  }

  function handleSort(col) {
    setSort(prev => ({
      col,
      dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  }

  const sortedGroups = sortGroups(groups, sort);

  const allExpanded = groups.length > 0 && groups.every(g => expKstt[g.pic]);

  function toggleAll() {
    const next = !allExpanded;
    const updated = {};
    groups.forEach(g => { updated[g.pic] = next; });
    setExpKstt(updated);
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <p className={styles.headerLabel}>Tiến độ xác nhận tồn kho</p>
            <h1 className={styles.headerTitle}>Dashboard</h1>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.refreshBtn} onClick={load} title="Làm mới">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v5h5M20 20v-5h-5" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.07 13a8 8 0 1013.55-8.36L20 2M20 22l-2.38-2.64A8 8 0 014.07 13" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className={styles.logoutBtn} onClick={onLogout}>Đăng xuất</button>
          </div>
        </div>

        {!loading && !error && data && (
          <div className={styles.summaryBar}>
            <SummaryCard label="Tổng CH"  value={grandTotal.stores} />
            <SummaryCard label="CH xong"  value={grandTotal.storesDone} color="green"
              sub={pct(grandTotal.storesDone, grandTotal.stores)} />
            <SummaryCard label="Tổng mã"  value={grandTotal.articles} />
            <SummaryCard label="Mã đã XN" value={grandTotal.artDone}  color="green"
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
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thName}>
                    <div className={styles.thNameInner}>
                      <span>PIC / QLKV</span>
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
                {sortedGroups.map(picGroup => (
                  <>
                    {/* ── PIC row ── */}
                    <tr key={picGroup.pic} className={styles.ksttRow}
                        onClick={() => togglePic(picGroup.pic)}>
                      <td className={styles.ksttCell}>
                        <span className={styles.chevron}>{expKstt[picGroup.pic] ? '▾' : '▸'}</span>
                        {picGroup.pic || '— Chưa phân công —'}
                      </td>
                      <td className={styles.numCell}>{picGroup.stores}</td>
                      <td className={styles.numCell}>
                        <span className={isDone(picGroup.storesDone, picGroup.stores) ? styles.numDone : ''}>
                          {picGroup.storesDone}
                        </span>
                      </td>
                      <td className={styles.numCell}>{picGroup.articles}</td>
                      <td className={styles.numCell}>
                        <span className={isDone(picGroup.artDone, picGroup.articles) ? styles.numDone : ''}>
                          {picGroup.artDone}
                        </span>
                      </td>
                      <td className={styles.pctCell}>
                        <ProgressBar value={picGroup.artDone} total={picGroup.articles} />
                      </td>
                    </tr>

                    {/* ── QLKV rows ── */}
                    {expKstt[picGroup.pic] && picGroup.qlkvList.map(q => (
                      <tr key={picGroup.pic + '|' + q.qlkv} className={styles.qlkvRow}>
                        <td className={styles.qlkvCell}>{q.qlkv || '— Chưa phân công —'}</td>
                        <td className={styles.numCell}>{q.stores}</td>
                        <td className={styles.numCell}>
                          <span className={isDone(q.storesDone, q.stores) ? styles.numDone : ''}>
                            {q.storesDone}
                          </span>
                        </td>
                        <td className={styles.numCell}>{q.articles}</td>
                        <td className={styles.numCell}>
                          <span className={isDone(q.artDone, q.articles) ? styles.numDone : ''}>
                            {q.artDone}
                          </span>
                        </td>
                        <td className={styles.pctCell}>
                          <ProgressBar value={q.artDone} total={q.articles} />
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
  const pctVal = Math.round(value / total * 100);
  const cls = pctVal === 100 ? styles.barFull : pctVal >= 50 ? styles.barMid : styles.barLow;
  return (
    <div className={styles.barWrap}>
      <div className={styles.barBg}>
        <div className={`${styles.barFill} ${cls}`} style={{ width: `${pctVal}%` }} />
      </div>
      <span className={styles.pctText}>{pctVal}%</span>
    </div>
  );
}

function SortTh({ col, sort, onSort, cls, children }) {
  const active = sort.col === col;
  return (
    <th className={`${cls} ${styles.thSortable} ${active ? styles.thActive : ''}`}
        onClick={() => onSort(col)}>
      {children}
      <span className={styles.sortArrow}>
        {active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
      </span>
    </th>
  );
}

function sortGroups(groups, { col, dir }) {
  if (!col) return groups;
  const sign = dir === 'asc' ? 1 : -1;
  return [...groups].sort((a, b) => {
    let va, vb;
    if (col === 'name')       { va = a.pic;        vb = b.pic; }
    else if (col === 'pct')   { va = a.articles ? a.artDone / a.articles : 0; vb = b.articles ? b.artDone / b.articles : 0; }
    else                      { va = a[col] ?? 0;  vb = b[col] ?? 0; }
    if (typeof va === 'string') return sign * va.localeCompare(vb, 'vi');
    return sign * (va - vb);
  });
}

function isDone(a, b) { return b > 0 && a === b; }
function pct(a, b)    { return b ? `${Math.round(a / b * 100)}%` : ''; }

function buildGroups({ stocks, storeMap }) {
  // Per-store: total articles + done + pic
  const storeArt = {};
  stocks.forEach(s => {
    if (!storeArt[s.store]) storeArt[s.store] = { total: 0, done: 0, pics: new Set() };
    storeArt[s.store].total++;
    if (s.counted_stock !== null && s.counted_stock !== '') storeArt[s.store].done++;
    if (s.pic) storeArt[s.store].pics.add(s.pic);
  });

  // Aggregate PIC → QLKV
  const picMap = {};
  Object.entries(storeArt).forEach(([storeCode, { total, done, pics }]) => {
    const info = storeMap[storeCode] || {};
    const qlkv = info.qlkv || 'Chưa phân công';
    const pic  = pics.size > 0 ? [...pics][0] : '';

    if (!picMap[pic]) picMap[pic] = {};
    if (!picMap[pic][qlkv]) picMap[pic][qlkv] = { stores: 0, storesDone: 0, articles: 0, artDone: 0 };

    const cell = picMap[pic][qlkv];
    cell.stores++;
    if (done === total) cell.storesDone++;
    cell.articles += total;
    cell.artDone  += done;
  });

  return Object.entries(picMap)
    .sort(([a], [b]) => a.localeCompare(b, 'vi'))
    .map(([pic, qlkvMap]) => {
      const qlkvList = Object.entries(qlkvMap)
        .sort(([a], [b]) => a.localeCompare(b, 'vi'))
        .map(([qlkv, stats]) => ({ qlkv, ...stats }));

      const tot = qlkvList.reduce((acc, q) => {
        acc.stores     += q.stores;
        acc.storesDone += q.storesDone;
        acc.articles   += q.articles;
        acc.artDone    += q.artDone;
        return acc;
      }, { stores: 0, storesDone: 0, articles: 0, artDone: 0 });

      return { pic, qlkvList, ...tot };
    });
}
