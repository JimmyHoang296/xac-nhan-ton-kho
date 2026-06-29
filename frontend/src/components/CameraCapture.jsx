import { useEffect, useRef, useState } from 'react';
import styles from './CameraCapture.module.css';

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('Không thể truy cập camera. Vui lòng cấp quyền camera và thử lại.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  function handleVideoReady() {
    // Dùng videoWidth > 0 để đảm bảo frame đã render, tránh canvas trống trên iOS Safari
    if (videoRef.current?.videoWidth > 0) {
      setReady(true);
    }
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

    // Thu nhỏ ảnh để giảm dung lượng upload (tiết kiệm Cloudinary + 3G nhân viên).
    // Giới hạn cạnh dài tối đa 1280px, giữ tỉ lệ; chất lượng JPEG 0.7.
    const MAX_EDGE = 1280;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    stopCamera();
    onCapture({
      base64: dataUrl.split(',')[1],
      type: 'image/jpeg',
      preview: dataUrl,
    });
  }

  return (
    <div className={styles.overlay}>
      {error ? (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.closeBtn} onClick={onClose}>Đóng</button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className={styles.video}
            autoPlay
            playsInline
            muted
            onCanPlay={handleVideoReady}
            onPlaying={handleVideoReady}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div className={styles.controls}>
            <button className={styles.cancelBtn} onClick={() => { stopCamera(); onClose(); }}>
              Huỷ
            </button>
            <button
              className={`${styles.shutter} ${ready ? styles.shutterReady : ''}`}
              onClick={capture}
              disabled={!ready}
            >
              <span className={styles.shutterInner} />
            </button>
            <div style={{ width: 64 }} />
          </div>
        </>
      )}
    </div>
  );
}
