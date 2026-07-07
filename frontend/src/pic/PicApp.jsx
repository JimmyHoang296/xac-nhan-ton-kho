import { useState, useEffect, useCallback } from 'react';
import { fetchPicStocks, fetchPicGr } from '../api';
import PicLogin from './PicLogin';
import PicDashboard from './PicDashboard';
import ProgressDashboard from './ProgressDashboard';
import PicProgressView from './PicProgressView';
import GrDashboard from '../components/GrDashboard';

const SESSION_KEY = 'pic_session';
const VIEW_KEY    = 'pic_view';
const ADMIN_ACCOUNTS = ['dunghd', 'hienbm'];

export default function PicApp() {
  const [pic,       setPic]       = useState(() => sessionStorage.getItem(SESSION_KEY) || null);
  const [view,      setView]      = useState(() => sessionStorage.getItem(VIEW_KEY) || 'progress');
  const [stocks,    setStocks]    = useState([]);
  const [grRecords, setGrRecords] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const load = useCallback(async () => {
    if (!pic || ADMIN_ACCOUNTS.includes(pic.toLowerCase())) return;
    setLoading(true);
    setError('');
    try {
      const [stockData, grData] = await Promise.all([
        fetchPicStocks(pic),
        fetchPicGr(pic).catch(() => ({ records: [] })),
      ]);
      setStocks(stockData.stocks);
      setGrRecords(grData.records || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pic]);

  useEffect(() => { load(); }, [load]);

  function handleLogin(picName) {
    sessionStorage.setItem(SESSION_KEY, picName);
    setPic(picName);
    setView('progress');
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(VIEW_KEY);
    setPic(null);
    setStocks([]);
    setGrRecords([]);
  }

  function switchView(v) {
    sessionStorage.setItem(VIEW_KEY, v);
    setView(v);
  }

  if (!pic) return <PicLogin onLogin={handleLogin} />;

  if (ADMIN_ACCOUNTS.includes(pic.toLowerCase()))
    return <ProgressDashboard pic={pic} onLogout={handleLogout} />;

  const shared = { pic, stocks, setStocks, grRecords, loading, error, onRefresh: load, onLogout: handleLogout };

  if (view === 'detail')
    return <PicDashboard {...shared} onSwitchProgress={() => switchView('progress')} onSwitchGr={() => switchView('gr')} />;

  if (view === 'gr')
    return (
      <GrDashboard
        userKey={pic}
        grRecords={grRecords}
        loading={loading}
        error={error}
        onRefresh={load}
        onLogout={handleLogout}
        onSwitchProgress={() => switchView('progress')}
        onSwitchStock={() => switchView('detail')}
        headerLabel="Xác nhận Nhập kho — PIC"
      />
    );

  return <PicProgressView {...shared} onViewDetail={() => switchView('detail')} onViewGr={() => switchView('gr')} />;
}

