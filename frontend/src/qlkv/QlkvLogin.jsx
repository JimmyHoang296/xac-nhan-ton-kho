import { useState } from 'react';
import { qlkvLogin } from '../api';
import styles from '../pic/PicLogin.module.css';

export default function QlkvLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim()) { setError('Vui lòng nhập username.'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await qlkvLogin(username.trim());
      onLogin(data.username, data.name, data.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#34a853" />
            <circle cx="18" cy="14" r="5" stroke="white" strokeWidth="2" />
            <path d="M8 29c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className={styles.title}>Quản lý tồn kho</h1>
        <p className={styles.subtitle}>Nhập username để đăng nhập</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Username</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Nhập username..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              autoFocus
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? <span className={styles.spinner} /> : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}
