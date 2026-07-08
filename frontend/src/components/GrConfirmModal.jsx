import { useState, useEffect, useRef } from 'react';
import styles from './ConfirmModal.module.css';
import CameraCapture from './CameraCapture';
import { submitGrConfirmation } from '../api';

const STATUS_OPTIONS = [
  { value: '', label: '— Chọn tình trạng —' },
  { value: 'NCC không giao', label: 'NCC không giao' },
  { value: 'CH chưa nhập kho', label: 'CH chưa nhập kho' },
  { value: 'CH đã nhập kho', label: 'CH đã nhập kho' },
];

export default function GrConfirmModal({ record, storeCode, onClose, onSuccess }) {
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const overlayRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleFocus(e) {
    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }

  function removePhoto(index) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!status) { setError('Vui lòng chọn tình trạng.'); return; }
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

      await submitGrConfirmation({
        po_number: record.po_number,
        site: storeCode,
        confirmed_amount: status,
        note,
        lat,
        long,
        images: photos.map(p => ({ base64: p.base64, type: p.type })),
      });
      onSuccess(record.po_number, status, note);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!status && !submitting;

  return (
    <>
      <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
        <div className={styles.sheet}>

          <div className={styles.top}>
            <div className={styles.handle} />

            <div className={styles.header}>
              <div className={styles.headerInfo}>
                <p className={styles.articleCode} style={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '0.01em' }}>
                  PO {record.po_number}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#5f6368', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                  {(record.product || record.vendor_name || 'Phiếu nhập kho').split('|').map(s => s.trim()).filter(Boolean).join('\n')}
                </p>
              </div>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4l10 10M14 4L4 14" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className={styles.stockBar}>
              <div className={styles.stockItem}>
                <span className={styles.stockItemLabel}>Nhà CC</span>
                <span className={styles.stockItemValue} style={{ fontSize: '0.85rem' }}>
                  {record.vendor_name || record.vendor || '—'}
                </span>
              </div>
              {record.document_date && (
                <div className={styles.stockItem}>
                  <span className={styles.stockItemLabel}>Ngày đặt</span>
                  <span className={styles.stockItemValue}>{formatDate(record.document_date)}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.body}>
            <div className={styles.field}>
              <label className={styles.label}>
                Tình trạng <span className={styles.required}>*</span>
              </label>
              <select
                className={styles.input}
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={{ height: '44px', paddingLeft: '10px' }}
                autoFocus
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Ghi chú</label>
              <textarea
                className={styles.textarea}
                placeholder="Lý do chưa nhập kho/ngày nhập kho/ghi chú thêm..."
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
                onFocus={handleFocus}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Ảnh phiếu giao hàng nếu có
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
                    <button className={styles.addPhotoBtn} onClick={() => setShowCamera(true)} aria-label="Thêm ảnh">
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
                <button className={styles.cameraBtn} onClick={() => setShowCamera(true)}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                      stroke="#1a73e8" strokeWidth="2" fill="none" />
                    <circle cx="12" cy="13" r="4" stroke="#1a73e8" strokeWidth="2" />
                  </svg>
                  <span>Chụp ảnh xác nhận (tuỳ chọn)</span>
                </button>
              )}
            </div>
          </div>

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
        <CameraCapture
          onCapture={photo => { setPhotos(prev => [...prev, photo]); setShowCamera(false); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Thiết bị không hỗ trợ GPS')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 30000,
    });
  });
}

function formatDate(val) {
  if (!val) return '';
  const n = Number(val);
  if (!isNaN(n) && n > 40000) {
    return new Date((n - 25569) * 86400 * 1000).toLocaleDateString('vi-VN');
  }
  const d = new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleDateString('vi-VN');
}
