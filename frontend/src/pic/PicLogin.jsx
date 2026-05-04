import { useState } from 'react';
import { picLogin } from '../api';
import styles from './PicLogin.module.css';

export default function PicLogin({ onLogin }) {
  const [pic, setPic] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pic.trim() || !password.trim()) { setError('Vui lòng nhập đầy đủ thông tin.'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await picLogin(pic.trim(), password.trim());
      onLogin(data.pic);
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
            <rect width="36" height="36" rx="10" fill="#1a73e8" />
            <circle cx="18" cy="14" r="5" stroke="white" strokeWidth="2" />
            <path d="M8 29c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className={styles.title}>PIC Dashboard</h1>
        <p className={styles.subtitle}>Đăng nhập để kiểm tra xác nhận tồn kho</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Tên PIC</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Nhập tên PIC..."
              value={pic}
              onChange={e => setPic(e.target.value)}
              autoComplete="username"
              autoCapitalize="off"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Mật khẩu</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
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
