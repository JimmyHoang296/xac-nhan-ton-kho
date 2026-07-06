import React, { useEffect, useState, useCallback } from 'react';
import { fetchProgress, fetchAllGr } from '../api';
import styles from './ProgressDashboard.module.css';

export default function ProgressDashboard({ pic, onLogout }) {
  const [data,       setData]       = useState(null);
  const [grRecords,  setGrRecords]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [expKstt,    setExpKstt]    = useState({});
  const [sort,       setSort]       = useState({ col: null, dir: 'asc' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, grRes] = await Promise.all([
        fetchProgress(pic),
        fetchAllGr().catch(() => ({ records: [] })),
      ]);
      setData(res);
      setGrRecords(grRes.records || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pic]);

  useEffect(() => { load(); }, [load]);

  const groups = data ? buildGroups(data, grRecords) : [];

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
    acc.reviewed   += g.reviewed;
    acc.grTotal    += g.grTotal;
    acc.grDone     += g.grDone;
    return acc;
  }, { stores: 0, storesDone: 0, articles: 0, artDone: 0, reviewed: 0, grTotal: 0, grDone: 0 });

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
            <SummaryCard label="Đã thẩm định" value={grandTotal.reviewed} color="blue"
              sub={pct(grandTotal.reviewed, grandTotal.artDone)} />
            <SummaryCard label="Tổng PO"  value={grandTotal.grTotal} />
            <SummaryCard label="PO đã XN" value={grandTotal.grDone} color="green"
              sub={pct(grandTotal.grDone, grandTotal.grTotal)} />
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
                  <SortTh col="pct"        sort={sort} onSort={handleSort} cls={styles.thPct}>Tỷ lệ XN</SortTh>
                  <SortTh col="reviewed"   sort={sort} onSort={handleSort} cls={styles.thNum}>Đã TĐ</SortTh>
                  <SortTh col="reviewPct"  sort={sort} onSort={handleSort} cls={styles.thPct}>Tỷ lệ TĐ</SortTh>
                  <SortTh col="grPending"  sort={sort} onSort={handleSort} cls={styles.thNum}>PO chờ</SortTh>
                  <SortTh col="grDone"     sort={sort} onSort={handleSort} cls={styles.thNum}>PO đã XN</SortTh>
                  <SortTh col="grPct"      sort={sort} onSort={handleSort} cls={styles.thPct}>Tỷ lệ PO</SortTh>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.map(picGroup => (
                  <React.Fragment key={picGroup.pic || '__none__'}>
                    {/* ── PIC row ── */}
                    <tr className={styles.ksttRow}
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
                        <ProgressBar value={picGroup.artDone} total={picGroup.articles} color="blue" />
                      </td>
                      <td className={styles.numCell}>{picGroup.reviewed}</td>
                      <td className={styles.pctCell}>
                        <ProgressBar value={picGroup.reviewed} total={picGroup.artDone} color="blue" />
                      </td>
                      <td className={styles.numCell}>
                        <span className={picGroup.grTotal - picGroup.grDone > 0 ? styles.numPending : ''}>
                          {picGroup.grTotal - picGroup.grDone}
                        </span>
                      </td>
                      <td className={styles.numCell}>
                        <span className={isDone(picGroup.grDone, picGroup.grTotal) ? styles.numDone : ''}>
                          {picGroup.grDone}
                        </span>
                      </td>
                      <td className={styles.pctCell}>
                        <ProgressBar value={picGroup.grDone} total={picGroup.grTotal} color="blue" />
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
                          <ProgressBar value={q.artDone} total={q.articles} color="blue" />
                        </td>
                        <td className={styles.numCell}>{q.reviewed}</td>
                        <td className={styles.pctCell}>
                          <ProgressBar value={q.reviewed} total={q.artDone} color="blue" />
                        </td>
                        <td className={styles.numCell}>
                          <span className={q.grTotal - q.grDone > 0 ? styles.numPending : ''}>
                            {q.grTotal - q.grDone}
                          </span>
                        </td>
                        <td className={styles.numCell}>
                          <span className={isDone(q.grDone, q.grTotal) ? styles.numDone : ''}>
                            {q.grDone}
                          </span>
                        </td>
                        <td className={styles.pctCell}>
                          <ProgressBar value={q.grDone} total={q.grTotal} color="blue" />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
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
      <span className={`${styles.summaryNum} ${color === 'green' ? styles.summaryNumGreen : color === 'blue' ? styles.summaryNumBlue : color === 'orange' ? styles.summaryNumOrange : ''}`}>{value}</span>
      <span className={styles.summaryLabel}>{label}</span>
      {sub && <span className={styles.summarySub}>{sub}</span>}
    </div>
  );
}

function ProgressBar({ value, total, color }) {
  if (!total) return <span className={styles.pctText}>—</span>;
  const pctVal = Math.round(value / total * 100);
  const cls = color === 'blue' ? styles.barBlue : pctVal === 100 ? styles.barFull : pctVal >= 50 ? styles.barMid : styles.barLow;
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
    if (col === 'name')           { va = a.pic;        vb = b.pic; }
    else if (col === 'pct')       { va = a.articles ? a.artDone / a.articles : 0; vb = b.articles ? b.artDone / b.articles : 0; }
    else if (col === 'reviewPct') { va = a.artDone ? a.reviewed / a.artDone : 0; vb = b.artDone ? b.reviewed / b.artDone : 0; }
    else if (col === 'grPending') { va = a.grTotal - a.grDone; vb = b.grTotal - b.grDone; }
    else if (col === 'grPct')     { va = a.grTotal ? a.grDone / a.grTotal : 0; vb = b.grTotal ? b.grDone / b.grTotal : 0; }
    else                          { va = a[col] ?? 0;  vb = b[col] ?? 0; }
    if (typeof va === 'string') return sign * va.localeCompare(vb, 'vi');
    return sign * (va - vb);
  });
}

function isDone(a, b) { return b > 0 && a === b; }
function pct(a, b)    { return b ? `${Math.round(a / b * 100)}%` : ''; }

function buildGroups({ stocks, storeMap }, grRecords) {
  // Per-store: total articles + done + pic
  const storeArt = {};
  stocks.forEach(s => {
    if (!storeArt[s.store]) storeArt[s.store] = { total: 0, done: 0, reviewed: 0, pics: new Set() };
    storeArt[s.store].total++;
    if (s.counted_stock !== null && s.counted_stock !== '') storeArt[s.store].done++;
    if (s.pic_status && s.pic_status !== '') storeArt[s.store].reviewed++;
    if (s.pic) storeArt[s.store].pics.add(s.pic);
  });

  // GR per store
  const grBySite = {};
  (grRecords || []).forEach(r => {
    const key = String(r.site);
    if (!grBySite[key]) grBySite[key] = { total: 0, done: 0 };
    grBySite[key].total++;
    if (r.time_stamp && r.time_stamp !== '') grBySite[key].done++;
  });

  // Aggregate PIC → QLKV
  const picMap = {};
  Object.entries(storeArt).forEach(([storeCode, { total, done, reviewed, pics }]) => {
    const info = storeMap[storeCode] || {};
    const qlkv = info.qlkv || 'Chưa phân công';
    const pic  = pics.size > 0 ? [...pics][0] : '';
    const gr   = grBySite[storeCode] || { total: 0, done: 0 };

    if (!picMap[pic]) picMap[pic] = {};
    if (!picMap[pic][qlkv]) picMap[pic][qlkv] = { stores: 0, storesDone: 0, articles: 0, artDone: 0, reviewed: 0, grTotal: 0, grDone: 0 };

    const cell = picMap[pic][qlkv];
    cell.stores++;
    if (done === total) cell.storesDone++;
    cell.articles += total;
    cell.artDone  += done;
    cell.reviewed += reviewed;
    cell.grTotal  += gr.total;
    cell.grDone   += gr.done;
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
        acc.reviewed   += q.reviewed;
        acc.grTotal    += q.grTotal;
        acc.grDone     += q.grDone;
        return acc;
      }, { stores: 0, storesDone: 0, articles: 0, artDone: 0, reviewed: 0, grTotal: 0, grDone: 0 });

      return { pic, qlkvList, ...tot };
    });
}
