import { useState, useEffect } from 'react';
import PicLogin from './PicLogin';
import PicDashboard from './PicDashboard';

const SESSION_KEY = 'pic_session';

export default function PicApp() {
  const [pic, setPic] = useState(() => sessionStorage.getItem(SESSION_KEY) || null);

  function handleLogin(picName) {
    sessionStorage.setItem(SESSION_KEY, picName);
    setPic(picName);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setPic(null);
  }

  if (!pic) return <PicLogin onLogin={handleLogin} />;
  return <PicDashboard pic={pic} onLogout={handleLogout} />;
}
