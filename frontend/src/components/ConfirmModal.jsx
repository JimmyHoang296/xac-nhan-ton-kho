import { useState, useEffect, useRef } from 'react';
import styles from './ConfirmModal.module.css';
import CameraCapture from './CameraCapture';
import { submitConfirmation } from '../api';

export default function ConfirmModal({ stock, storeCode, onClose, onSuccess }) {
  const [currentStock, setCurrentStock] = useState('');
  const [countedStock, setCountedStock] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const overlayRef = useRef(null);

  const thung = stock.thung ? Number(stock.thung) : 0;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleFocus(e) {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }

  function handleOpenCamera() {
    setShowCamera(true);
  }

  function handleCapture(capturedPhoto) {
    setPhotos(prev => [...prev, capturedPhoto]);
    setShowCamera(false);
  }

  function removePhoto(index) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (currentStock === '') { setError('Vui lòng nhập tồn hiện tại.'); return; }
    if (countedStock === '') { setError('Vui lòng nhập tồn kiểm kho.'); return; }
    if (photos.length === 0) { setError('Vui lòng chụp ít nhất 1 ảnh xác nhận.'); return; }
    setError('');
    setSubmitting(true);
    try {
      let lat, long;
      try {
        const pos = await getPosition();
        lat = pos.coords.latitude;
        long = pos.coords.longitude;
      } catch {
        setError('Vui lòng bật và cho phép chia sẻ vị trí để gửi xác nhận.');
        setSubmitting(false);
        return;
      }

      await submitConfirmation({
        store: storeCode,
        article: stock.article,
        stock_day: stock.stock_day,
        pic: stock.pic,
        current_stock: currentStock === '' ? '' : Number(currentStock),
        counted_stock: Number(countedStock),
        note,
        lat,
        long,
        image: photos[0].base64,
        imageType: photos[0].type,
        images: photos.map(p => ({ base64: p.base64, type: p.type })),
      });
      onSuccess(stock.article, Number(countedStock), note);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = currentStock !== '' && countedStock !== '' && photos.length > 0 && !submitting;

  return (
    <>
      <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
        <div className={styles.sheet}>

          {/* ── Phần cố định trên cùng ── */}
          <div className={styles.top}>
            <div className={styles.handle} />

            <div className={styles.header}>
              <div className={styles.headerInfo}>
                <p className={styles.articleCode}>{stock.article}</p>
                <p className={styles.articleName}>{stock.article_name}</p>
              </div>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4l10 10M14 4L4 14" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className={styles.stockBar}>
              <div className={styles.stockItem}>
                <span className={styles.stockItemLabel}>Tồn HT</span>
                <span className={styles.stockItemValue}>{stock.stock ?? '—'}</span>
              </div>
              {stock.stock_day && (
                <div className={styles.stockItem}>
                  <span className={styles.stockItemLabel}>Ngày lấy</span>
                  <span className={styles.stockItemValue}>{formatDate(stock.stock_day)}</span>
                </div>
              )}
              {thung > 0 && (
                <div className={styles.stockItem}>
                  <span className={styles.stockItemLabel}>SP/Thùng</span>
                  <span className={styles.stockItemValue}>{thung}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Body cuộn ── */}
          <div className={styles.body}>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Tồn hiện tại <span className={styles.required}>*</span></label>
                <input
                  className={styles.input}
                  type="number"
                  inputMode="decimal"
                  placeholder=""
                  value={currentStock}
                  min={0}
                  onChange={e => setCurrentStock(e.target.value)}
                  onFocus={handleFocus}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  Tồn thực tế <span className={styles.required}>*</span>
                </label>
                <input
                  className={`${styles.input} ${styles.inputPrimary}`}
                  type="number"
                  inputMode="decimal"
                  placeholder=""
                  value={countedStock}
                  min={0}
                  onChange={e => setCountedStock(e.target.value)}
                  onFocus={handleFocus}
                  autoFocus
                />
              </div>
            </div>

            {thung > 0 && countedStock !== '' && (
              <div className={styles.thungCalc}>
                <span className={styles.thungIcon}>📦</span>
                <span className={styles.thungText}>
                  {thung} SP/thùng → <strong>{formatThung(Number(countedStock), thung)}</strong>
                </span>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Ghi chú</label>
              <textarea
                className={styles.textarea}
                placeholder="Nguyên nhân lệch tồn hoặc nguyên nhân tồn lâu chưa xuất bán"
                rows={4}
                value={note}
                onChange={e => setNote(e.target.value)}
                onFocus={handleFocus}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Ảnh xác nhận (vị trí chứa phần lớn sản phẩm) <span className={styles.required}>*</span>
                <span className={styles.photoCounter}> {photos.length}/5</span>
              </label>

              {photos.length > 0 && (
                <div className={styles.photoGrid}>
                  {photos.map((p, i) => (
                    <div key={i} className={styles.photoThumb}>
                      <img src={p.preview} alt={`Ảnh ${i + 1}`} className={styles.thumbImg} />
                      <button className={styles.removeBtn} onClick={() => removePhoto(i)} aria-label="Xoá ảnh">×</button>
                    </div>
                  ))}
                  {photos.length < 5 && (
                    <button className={styles.addPhotoBtn} onClick={handleOpenCamera} aria-label="Thêm ảnh">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                          stroke="#1a73e8" strokeWidth="2" />
                        <circle cx="12" cy="13" r="4" stroke="#1a73e8" strokeWidth="2" />
                      </svg>
                      <span className={styles.addPhotoText}>Thêm</span>
                    </button>
                  )}
                </div>
              )}

              {photos.length === 0 && (
                <button className={styles.cameraBtn} onClick={handleOpenCamera}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                      stroke="#1a73e8" strokeWidth="2" fill="none" />
                    <circle cx="12" cy="13" r="4" stroke="#1a73e8" strokeWidth="2" />
                  </svg>
                  <span>Chụp ảnh xác nhận</span>
                </button>
              )}
            </div>

          </div>

          {/* ── Footer cố định ── */}
          <div className={styles.footer}>
            {error && (
              <p className={styles.errorInline}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="8" cy="8" r="7" stroke="#ea4335" strokeWidth="1.5" />
                  <path d="M8 5v3M8 11v.5" stroke="#ea4335" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {error}
              </p>
            )}
            <button className={styles.submitBtn} onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? <span className={styles.spinner} /> : 'Gửi Xác Nhận'}
            </button>
          </div>

        </div>
      </div>

      {showCamera && (
        <CameraCapture onCapture={handleCapture} onClose={() => setShowCamera(false)} />
      )}
    </>
  );
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Thiết bị không hỗ trợ GPS'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });
  });
}

function formatDate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatThung(qty, thung) {
  if (!thung || thung <= 0) return '';
  const boxes = Math.floor(qty / thung);
  const remainder = qty % thung;
  if (remainder === 0) return `${boxes} thùng`;
  return `${boxes} thùng + ${remainder} lẻ`;
}
