import { useState, useEffect, useCallback } from 'react';
import { fetchQlkvStocks } from '../api';
import QlkvLogin from './QlkvLogin';
import QlkvDashboard from './QlkvDashboard';
import QlkvProgressView from './QlkvProgressView';

const SESSION_KEY  = 'qlkv_session';
const SESSION_NAME = 'qlkv_name';
const SESSION_ROLE = 'qlkv_role';
const VIEW_KEY     = 'qlkv_view';

export default function QlkvApp() {
  const [username, setUsername] = useState(() => sessionStorage.getItem(SESSION_KEY) || null);
  const [name,     setName]    = useState(() => sessionStorage.getItem(SESSION_NAME) || '');
  const [role,     setRole]    = useState(() => sessionStorage.getItem(SESSION_ROLE) || 'qlkv');
  const [view,     setView]    = useState(() => sessionStorage.getItem(VIEW_KEY) || 'progress');
  const [stocks,   setStocks]  = useState([]);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');

  const load = useCallback(async () => {
    if (!username) return;
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
  }

  function switchView(v) {
    sessionStorage.setItem(VIEW_KEY, v);
    setView(v);
  }

  if (!username) return <QlkvLogin onLogin={handleLogin} />;

  const shared = { username, name, role, stocks, loading, error, onRefresh: load, onLogout: handleLogout };

  if (view === 'detail')
    return <QlkvDashboard {...shared} onSwitchProgress={() => switchView('progress')} />;

  return <QlkvProgressView {...shared} onViewDetail={() => switchView('detail')} />;
}
