import { useState, useEffect, useCallback } from 'react';
import { fetchQlkvStocks, fetchQlkvGr } from '../api';
import QlkvLogin from './QlkvLogin';
import QlkvDashboard from './QlkvDashboard';
import QlkvProgressView from './QlkvProgressView';
import GrDashboard from '../components/GrDashboard';

const SESSION_KEY  = 'qlkv_session';
const SESSION_NAME = 'qlkv_name';
const SESSION_ROLE = 'qlkv_role';
const VIEW_KEY     = 'qlkv_view';

export default function QlkvApp() {
  const [username,  setUsername]  = useState(() => sessionStorage.getItem(SESSION_KEY) || null);
  const [name,      setName]     = useState(() => sessionStorage.getItem(SESSION_NAME) || '');
  const [role,      setRole]     = useState(() => sessionStorage.getItem(SESSION_ROLE) || 'qlkv');
  const [view,      setView]     = useState(() => sessionStorage.getItem(VIEW_KEY) || 'progress');
  const [stocks,    setStocks]   = useState([]);
  const [grRecords, setGrRecords]= useState([]);
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState('');

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError('');
    try {
      const [stockData, grData] = await Promise.all([
        fetchQlkvStocks(username),
        fetchQlkvGr(username).catch(() => ({ records: [] })),
      ]);
      setStocks(stockData.stocks);
      setGrRecords(grData.records || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { load(); }, [load]);

  function handleLogin(u, n, r) {
    sessionStorage.setItem(SESSION_KEY, u);
    sessionStorage.setItem(SESSION_NAME, n);
    sessionStorage.setItem(SESSION_ROLE, r || 'qlkv');
    setUsername(u);
    setName(n);
    setRole(r || 'qlkv');
    setView('progress');
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_NAME);
    sessionStorage.removeItem(SESSION_ROLE);
    sessionStorage.removeItem(VIEW_KEY);
    setUsername(null);
    setName('');
    setRole('qlkv');
    setStocks([]);
    setGrRecords([]);
  }

  function switchView(v) {
    sessionStorage.setItem(VIEW_KEY, v);
    setView(v);
  }

  if (!username) return <QlkvLogin onLogin={handleLogin} />;

  const shared = { username, name, role, stocks, grRecords, loading, error, onRefresh: load, onLogout: handleLogout };

  if (view === 'detail')
    return <QlkvDashboard {...shared} onSwitchProgress={() => switchView('progress')} onSwitchGr={() => switchView('gr')} />;

  if (view === 'gr')
    return (
      <GrDashboard
        userKey={username}
        grRecords={grRecords}
        loading={loading}
        error={error}
        onRefresh={load}
        onLogout={handleLogout}
        onSwitchProgress={() => switchView('progress')}
        onSwitchStock={() => switchView('detail')}
        headerLabel={`Nhập kho — ${name || username}`}
      />
    );

  return <QlkvProgressView {...shared} onViewDetail={() => switchView('detail')} onViewGr={() => switchView('gr')} />;
}
