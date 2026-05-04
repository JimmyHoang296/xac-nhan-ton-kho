import { useState } from 'react';
import styles from './StoreSearch.module.css';

export default function StoreSearch({ onSearch, loading }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function handleChange(e) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length <= 4) setCode(val);
    if (error) setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (code.length !== 4) {
      setError('Mã cửa hàng phải đúng 4 ký tự');
      return;
    }
    onSearch(code);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.logo}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="10" fill="#1a73e8" />
          <path d="M10 28V16l10-6 10 6v12l-10 6-10-6z" stroke="white" strokeWidth="2" fill="none" />
          <path d="M20 22v6M16 19l4-3 4 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className={styles.title}>Xác Nhận Tồn Kho</h1>
      <p className={styles.subtitle}>Nhập mã cửa hàng để bắt đầu xác nhận tồn kho</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <input
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            type="text"
            inputMode="text"
            placeholder="VD: 2011"
            value={code}
            onChange={handleChange}
            maxLength={4}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          {error && <p className={styles.errorMsg}>{error}</p>}
        </div>
        <button className={styles.btn} type="submit" disabled={loading || code.length === 0}>
          {loading
            ? <span className={styles.spinner} />
            : 'Kiểm Tra'}
        </button>
      </form>
    </div>
  );
}
