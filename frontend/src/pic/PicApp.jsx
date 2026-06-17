import { useState } from 'react';
import PicLogin from './PicLogin';
import PicDashboard from './PicDashboard';
import ProgressDashboard from './ProgressDashboard';
import PicProgressView from './PicProgressView';

const SESSION_KEY = 'pic_session';
const VIEW_KEY    = 'pic_view';
const ADMIN_ACCOUNTS = ['dunghd', 'hienbm'];

export default function PicApp() {
  const [pic,  setPic]  = useState(() => sessionStorage.getItem(SESSION_KEY) || null);
  const [view, setView] = useState(() => sessionStorage.getItem(VIEW_KEY) || 'progress');

  function handleLogin(picName) {
    sessionStorage.setItem(SESSION_KEY, picName);
    setPic(picName);
    setView('progress');
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(VIEW_KEY);
    setPic(null);
  }

  function switchView(v) {
    sessionStorage.setItem(VIEW_KEY, v);
    setView(v);
  }

  if (!pic) return <PicLogin onLogin={handleLogin} />;

  if (ADMIN_ACCOUNTS.includes(pic.toLowerCase()))
    return <ProgressDashboard pic={pic} onLogout={handleLogout} />;

  if (view === 'detail')
    return <PicDashboard pic={pic} onLogout={handleLogout} onSwitchProgress={() => switchView('progress')} />;

  return <PicProgressView pic={pic} onLogout={handleLogout} onViewDetail={() => switchView('detail')} />;
}
