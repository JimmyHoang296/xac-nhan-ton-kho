import { useState, useCallback } from 'react';
import StoreSearch from './components/StoreSearch';
import StockList from './components/StockList';
import ConfirmModal from './components/ConfirmModal';
import Toast from './components/Toast';
import { fetchStocks } from './api';

export default function App() {
  const [view, setView] = useState('search'); // 'search' | 'list'
  const [storeCode, setStoreCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeStock, setActiveStock] = useState(null);
  const [toast, setToast] = useState(null);

  async function handleSearch(code) {
    setLoading(true);
    setSearchError('');
    try {
      const data = await fetchStocks(code);
      if (!data.stocks.length) {
        setSearchError(`Cửa hàng "${data.store_name}" không có sản phẩm nào.`);
        return;
      }
      setStoreCode(code);
      setStoreName(data.store_name);
      setStocks(data.stocks);
      setView('list');
    } catch (err) {
      setSearchError(
        err.message === 'Store not found'
          ? `Không tìm thấy cửa hàng với mã "${code}".`
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  const handleConfirmSuccess = useCallback((article, countedStock, note) => {
    setStocks(prev =>
      prev.map(s => s.article === article ? { ...s, counted_stock: countedStock, note } : s)
    );
    setActiveStock(null);
    setToast({ message: 'Xác nhận thành công!', type: 'success' });
  }, []);

  return (
    <>
      {view === 'search' && (
        <>
          <StoreSearch onSearch={handleSearch} loading={loading} />
          {searchError && (
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: 'white', padding: '1rem 1.25rem',
              borderTop: '1px solid #e8eaed',
              boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
            }}>
              <p style={{
                margin: 0, color: '#ea4335',
                fontSize: '0.9rem', fontWeight: 500, textAlign: 'center',
              }}>
                {searchError}
              </p>
            </div>
          )}
        </>
      )}

      {view === 'list' && (
        <>
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: 'white', borderBottom: '1px solid #e8eaed',
          }}>
            <button
              onClick={() => { setView('search'); setSearchError(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.75rem 1rem', background: 'none', border: 'none',
                color: '#1a73e8', font: '600 0.9rem/1 inherit', cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4L6 9l5 5" stroke="#1a73e8" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Đổi cửa hàng
            </button>
          </div>
          <StockList
            storeName={storeName}
            storeCode={storeCode}
            stocks={stocks}
            onCardClick={setActiveStock}
          />
        </>
      )}

      {activeStock && (
        <ConfirmModal
          stock={activeStock}
          storeCode={storeCode}
          onClose={() => setActiveStock(null)}
          onSuccess={handleConfirmSuccess}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
}
