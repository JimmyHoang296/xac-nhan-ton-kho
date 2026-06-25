import { useState } from 'react';
import styles from '../pic/ProgressDashboard.module.css';

const ROLE_LABELS = { qlkv: 'QLKV', gdv: 'GDV', gdm: 'GDM', gdc: 'GDC' };

export default function QlkvProgressView({ username, name, role, stocks, loading, error, onRefresh, onLogout, onViewDetail }) {
  const isManager = role === 'gdv' || role === 'gdm' || role === 'gdc';
  const [sort, setSort] = useState({ col: null, dir: 'asc' });

  const rows = buildStoreRows(stocks);
  const hierarchy = isManager ? buildProgressHierarchy(stocks, role) : null;

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
            <p className={styles.headerLabel}>{ROLE_LABELS[role] || 'QLKV'} — Tổng quan tiến độ</p>
            <h1 className={styles.headerTitle}>{name || username}</h1>
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
            {isManager && hierarchy && <SummaryCard label={role === 'gdv' ? 'QLKV' : role === 'gdm' ? 'GDV' : 'GDM'} value={hierarchy.length} />}
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

        {!loading && !error && rows.length > 0 && !isManager && (
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
                  <tr key={r.store} className={styles.qlkvRow}>
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

        {!loading && !error && rows.length > 0 && isManager && hierarchy && (
          <div className={`${styles.tableWrap} ${styles.tableWrapWide}`}>
            {hierarchy.map(node => (
              <HierarchyProgressNode key={node.name} node={node} sort={sort} onSort={handleSort} depth={0} />
            ))}
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

/* ─── Hierarchy for progress view ─── */
function buildProgressHierarchy(stocks, role) {
  // gdv: QLKV → stores
  // gdm: GDV → QLKV → stores
  // gdc: GDM → GDV → QLKV → stores
  var levels;
  if (role === 'gdv') levels = ['qlkv'];
  else if (role === 'gdm') levels = ['gdv', 'qlkv'];
  else if (role === 'gdc') levels = ['gdm', 'gdv', 'qlkv'];
  else return [];

  const LEVEL_LABELS = { qlkv: 'QLKV', gdv: 'GDV', gdm: 'GDM', gdc: 'GDC' };

  function buildLevel(items, levelIdx) {
    if (levelIdx >= levels.length) {
      // leaf: build store rows
      const map = {};
      items.forEach(s => {
        const key = String(s.store);
        if (!map[key]) map[key] = { store: key, store_name: s.store_name || '', articles: 0, artDone: 0 };
        map[key].articles++;
        if (s.counted_stock !== null && s.counted_stock !== '') map[key].artDone++;
      });
      return Object.values(map).sort((a, b) => String(a.store).localeCompare(String(b.store)));
    }
    const field = levels[levelIdx];
    const grouped = {};
    items.forEach(s => {
      const key = s[field] || 'Chưa phân công';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b, 'vi'))
      .map(([name, groupItems]) => {
        const articles = groupItems.length;
        const artDone = groupItems.filter(s => s.counted_stock !== null && s.counted_stock !== '').length;
        return {
          name,
          roleLabel: LEVEL_LABELS[field] || field.toUpperCase(),
          articles,
          artDone,
          children: buildLevel(groupItems, levelIdx + 1),
          isLeaf: levelIdx === levels.length - 1,
        };
      });
  }

  return buildLevel(stocks, 0);
}

function HierarchyProgressNode({ node, sort, onSort, depth }) {
  const [open, setOpen] = useState(true);
  const pct = node.articles > 0 ? Math.round(node.artDone / node.articles * 100) : 0;

  return (
    <div style={{ marginBottom: depth === 0 ? '1rem' : '0.5rem' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className={styles.qlkvGroupHeader}
        style={{ paddingLeft: `${14 + depth * 16}px` }}
      >
        <span className={styles.qlkvGroupArrow}>{open ? '▼' : '▶'}</span>
        <span className={styles.qlkvGroupRole}>{node.roleLabel}</span>
        <span className={styles.qlkvGroupName}>{node.name}</span>
        <span className={styles.qlkvGroupStats}>
          {node.artDone}/{node.articles} mã · {pct}%
        </span>
        <ProgressBar value={node.artDone} total={node.articles} />
      </button>
      {open && (
        node.isLeaf ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <SortTh col="store"    sort={sort} onSort={onSort} cls={styles.thName}>Cửa hàng</SortTh>
                <SortTh col="articles" sort={sort} onSort={onSort} cls={styles.thNum}>Số mã</SortTh>
                <SortTh col="artDone"  sort={sort} onSort={onSort} cls={styles.thNum}>Mã đã XN</SortTh>
                <SortTh col="pct"      sort={sort} onSort={onSort} cls={styles.thPct}>Tiến độ</SortTh>
              </tr>
            </thead>
            <tbody>
              {sortStoreRows(node.children, sort).map(r => (
                <tr key={r.store} className={styles.qlkvRow}>
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
        ) : (
          node.children.map(child => (
            <HierarchyProgressNode key={child.name} node={child} sort={sort} onSort={onSort} depth={depth + 1} />
          ))
        )
      )}
    </div>
  );
}

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
