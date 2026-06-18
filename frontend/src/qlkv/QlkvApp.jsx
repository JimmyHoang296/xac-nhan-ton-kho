import { useState } from 'react';
import QlkvLogin from './QlkvLogin';
import QlkvDashboard from './QlkvDashboard';
import QlkvProgressView from './QlkvProgressView';

const SESSION_KEY  = 'qlkv_session';
const SESSION_NAME = 'qlkv_name';
const VIEW_KEY     = 'qlkv_view';

export default function QlkvApp() {
  const [username, setUsername] = useState(() => sessionStorage.getItem(SESSION_KEY) || null);
  const [name,     setName]    = useState(() => sessionStorage.getItem(SESSION_NAME) || '');
  const [view,     setView]    = useState(() => sessionStorage.getItem(VIEW_KEY) || 'progress');

  function handleLogin(u, n) {
    sessionStorage.setItem(SESSION_KEY, u);
    sessionStorage.setItem(SESSION_NAME, n);
    setUsername(u);
    setName(n);
    setView('progress');
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_NAME);
    sessionStorage.removeItem(VIEW_KEY);
    setUsername(null);
    setName('');
  }

  function switchView(v) {
    sessionStorage.setItem(VIEW_KEY, v);
    setView(v);
  }

  if (!username) return <QlkvLogin onLogin={handleLogin} />;

  if (view === 'detail')
    return <QlkvDashboard username={username} name={name} onLogout={handleLogout}
      onSwitchProgress={() => switchView('progress')} />;

  return <QlkvProgressView username={username} name={name} onLogout={handleLogout}
    onViewDetail={() => switchView('detail')} />;
}
