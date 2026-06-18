import { useState } from 'react';
import QlkvLogin from './QlkvLogin';
import QlkvDashboard from './QlkvDashboard';

const SESSION_KEY = 'qlkv_session';
const SESSION_NAME = 'qlkv_name';

export default function QlkvApp() {
  const [username, setUsername] = useState(() => sessionStorage.getItem(SESSION_KEY) || null);
  const [name, setName] = useState(() => sessionStorage.getItem(SESSION_NAME) || '');

  function handleLogin(u, n) {
    sessionStorage.setItem(SESSION_KEY, u);
    sessionStorage.setItem(SESSION_NAME, n);
    setUsername(u);
    setName(n);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_NAME);
    setUsername(null);
    setName('');
  }

  if (!username) return <QlkvLogin onLogin={handleLogin} />;
  return <QlkvDashboard username={username} name={name} onLogout={handleLogout} />;
}
