import { useState, useEffect, useCallback } from 'react';
import { fetchPicStocks, fetchPicGr } from '../api';
import { supabase } from '../supabaseClient';
import PicLogin from './PicLogin';
import PicDashboard from './PicDashboard';
import ProgressDashboard from './ProgressDashboard';
import PicProgressView from './PicProgressView';
import GrDashboard from '../components/GrDashboard';
import AdminPanel from '../admin/AdminPanel';

const SESSION_KEY = 'pic_session';
const VIEW_KEY    = 'pic_view';
const ADMIN_ACCOUNTS = ['dunghd', 'hienbm'];

export default function PicApp() {
  const [pic,        setPic]        = useState(() => sessionStorage.getItem(SESSION_KEY) || null);
  const [view,       setView]       = useState(() => sessionStorage.getItem(VIEW_KEY) || 'progress');
  const [stocks,     setStocks]     = useState([]);
  const [grRecords,  setGrRecords]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [adminPwd,   setAdminPwd]   = useState('');
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminErr,   setAdminErr]   = useState('');
  const [adminBusy,  setAdminBusy]  = useState(false);
  const [drillPic,   setDrillPic]   = useState(null);

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

  const loadDrillPic = useCallback(async (picName) => {
    setLoading(true);
    setError('');
    try {
      const [stockData, grData] = await Promise.all([
        fetchPicStocks(picName),
        fetchPicGr(picName).catch(() => ({ records: [] })),
      ]);
      setStocks(stockData.stocks || []);
      setGrRecords(grData.records || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleOpenPic(picName) {
    setDrillPic(picName);
    setStocks([]);
    setGrRecords([]);
    switchView('drill-detail');
    loadDrillPic(picName);
  }

  function handleBackToProgress() {
    switchView('progress');
    setDrillPic(null);
    setStocks([]);
    setGrRecords([]);
  }

  if (!pic) return <PicLogin onLogin={handleLogin} />;

  if (ADMIN_ACCOUNTS.includes(pic.toLowerCase())) {
    // Drill-down: xem chi tiết PIC được double-click từ ProgressDashboard
    if ((view === 'drill-detail' || view === 'drill-gr') && drillPic) {
      const drillShared = {
        pic: drillPic, stocks, setStocks, grRecords,
        loading, error,
        onRefresh: () => loadDrillPic(drillPic),
        onLogout: handleLogout,
      };
      if (view === 'drill-gr') {
        return (
          <GrDashboard
            userKey={drillPic}
            grRecords={grRecords}
            loading={loading}
            error={error}
            onRefresh={() => loadDrillPic(drillPic)}
            onLogout={handleLogout}
            onSwitchProgress={handleBackToProgress}
            onSwitchStock={() => switchView('drill-detail')}
            headerLabel={`Nhập kho — ${drillPic}`}
          />
        );
      }
      return (
        <PicDashboard
          {...drillShared}
          onSwitchProgress={handleBackToProgress}
          onSwitchGr={() => switchView('drill-gr')}
        />
      );
    }

    // Admin view — yêu cầu nhập mật khẩu admin lần đầu
    if (view === 'admin') {
      if (adminAuthed) {
        return (
          <AdminPanel
            password={adminPwd}
            onLogout={() => { setView('progress'); setAdminAuthed(false); setAdminPwd(''); }}
          />
        );
      }
      return (
        <div style={AS.wrap}>
          <form style={AS.card} onSubmit={async e => {
            e.preventDefault();
            if (!adminPwd) { setAdminErr('Vui lòng nhập mật khẩu.'); return; }
            setAdminBusy(true); setAdminErr('');
            try {
              const { data, error: rpcErr } = await supabase.rpc('admin_check', { p_password: adminPwd });
              if (rpcErr) throw new Error(rpcErr.message);
              if (data !== true) throw new Error('Sai mật khẩu admin');
              setAdminAuthed(true);
            } catch (err) {
              setAdminErr(err.message);
            } finally {
              setAdminBusy(false);
            }
          }}>
            <h1 style={AS.title}>Admin — Quản trị dữ liệu</h1>
            <input
              type="password"
              placeholder="Mật khẩu admin"
              value={adminPwd}
              onChange={e => setAdminPwd(e.target.value)}
              style={AS.input}
              autoFocus
            />
            {adminErr && <p style={AS.err}>{adminErr}</p>}
            <button type="submit" disabled={adminBusy} style={AS.btn}>
              {adminBusy ? 'Đang kiểm tra…' : 'Xác nhận'}
            </button>
            <button type="button" style={AS.back} onClick={() => { setView('progress'); setAdminErr(''); setAdminPwd(''); }}>
              Quay lại
            </button>
          </form>
        </div>
      );
    }
    return (
      <ProgressDashboard
        pic={pic}
        onLogout={handleLogout}
        onSwitchAdmin={() => switchView('admin')}
        onOpenPic={handleOpenPic}
      />
    );
  }

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

const AS = {
  wrap:  { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
           padding: 16, background: '#f4f5f7', fontFamily: 'system-ui, sans-serif' },
  card:  { width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 24,
           boxShadow: '0 4px 24px rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', gap: 12 },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: '#111' },
  input: { padding: '12px 14px', borderRadius: 10, border: '1px solid #ddd', fontSize: 16 },
  btn:   { padding: '12px 14px', borderRadius: 10, border: 'none', background: '#2563eb',
           color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  back:  { padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff',
           fontSize: 15, color: '#555', cursor: 'pointer' },
  err:   { color: '#dc2626', fontSize: 14, margin: 0 },
};

