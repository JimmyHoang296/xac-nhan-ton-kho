import { useState, useCallback } from 'react';
import StoreSearch from './components/StoreSearch';
import StockList from './components/StockList';
import GrList from './components/GrList';
import ConfirmModal from './components/ConfirmModal';
import GrConfirmModal from './components/GrConfirmModal';
import Toast from './components/Toast';
import { fetchStocks, fetchGrByStore } from './api';

const isGrConfirmed = r => r.time_stamp !== null && r.time_stamp !== '' && r.time_stamp !== undefined;

export default function App() {
  const [view, setView]           = useState('search'); // 'search' | 'dashboard'
  const [storeCode, setStoreCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [stocks, setStocks]       = useState([]);
  const [grRecords, setGrRecords] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeStock, setActiveStock] = useState(null);
  const [activeGr, setActiveGr]   = useState(null);
  const [toast, setToast]         = useState(null);
  const [tab, setTab]             = useState('stock'); // 'stock' | 'gr'

  async function handleSearch(code) {
    setLoading(true);
    setSearchError('');
    try {
      const stockData = await fetchStocks(code);

      let grData = { records: [] };
      try { grData = await fetchGrByStore(code); } catch { /* table might not exist yet */ }

      if (!stockData.stocks.length && !grData.records.length) {
        setSearchError(`Cửa hàng "${stockData.store_name}" không có dữ liệu nào.`);
        return;
      }
      setStoreCode(code);
      setStoreName(stockData.store_name || '');
      setStocks(stockData.stocks || []);
      setGrRecords(grData.records || []);
      setTab(stockData.stocks.length > 0 ? 'stock' : 'gr');
      setView('dashboard');
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
    setToast({ message: 'Xác nhận tồn kho thành công!', type: 'success' });
  }, []);

  const handleGrSuccess = useCallback((po_number, confirmedAmount, note) => {
    setGrRecords(prev =>
      prev.map(r => r.po_number === po_number
        ? { ...r, confirmed_amount: String(confirmedAmount), confirm_note: note, time_stamp: new Date().toLocaleString('vi-VN') }
        : r
      )
    );
    setActiveGr(null);
    setToast({ message: 'Xác nhận nhập kho thành công!', type: 'success' });
  }, []);

  // Computed counts
  const stockPending = stocks.filter(s => s.counted_stock === '' || s.counted_stock === null || s.counted_stock === undefined);
  const grPending    = grRecords.filter(r => !isGrConfirmed(r));

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
              <p style={{ margin: 0, color: '#ea4335', fontSize: '0.9rem', fontWeight: 500, textAlign: 'center' }}>
                {searchError}
              </p>
            </div>
          )}
        </>
      )}

      {view === 'dashboard' && (
        <>
          {/* Sticky top bar */}
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
                <path d="M11 4L6 9l5 5" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Đổi cửa hàng
            </button>
          </div>

          {/* Store info + 2 summary cards */}
          <div style={{ background: 'white', borderBottom: '1px solid #e8eaed', padding: '0.75rem 1rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <span style={{
                background: '#e8f0fe', color: '#1a73e8', fontSize: '0.75rem',
                fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 20,
              }}>{storeCode}</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a2e' }}>{storeName}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
              <SummaryCard
                label="Tồn kho"
                icon="📦"
                pending={stockPending.length}
                total={stocks.length}
                active={tab === 'stock'}
                color="#1a73e8"
                onClick={() => setTab('stock')}
              />
              <SummaryCard
                label="Nhập kho"
                icon="📋"
                pending={grPending.length}
                total={grRecords.length}
                active={tab === 'gr'}
                color="#34a853"
                onClick={() => setTab('gr')}
              />
            </div>
          </div>

          {/* Tab content */}
          {tab === 'stock' && (
            <StockList
              storeName={storeName}
              storeCode={storeCode}
              stocks={stocks}
              onCardClick={setActiveStock}
              hideHeader
            />
          )}
          {tab === 'gr' && (
            <GrList
              records={grRecords}
              storeCode={storeCode}
              storeName={storeName}
              onCardClick={setActiveGr}
            />
          )}
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

      {activeGr && (
        <GrConfirmModal
          record={activeGr}
          storeCode={storeCode}
          onClose={() => setActiveGr(null)}
          onSuccess={handleGrSuccess}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}
    </>
  );
}

function SummaryCard({ label, icon, pending, total, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#f0f6ff' : 'white',
        border: active ? `2px solid ${color}` : '2px solid #e8eaed',
        borderRadius: 14,
        padding: '0.875rem 1rem',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: active ? color : '#5f6368', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: pending > 0 ? '#f29900' : '#34a853', lineHeight: 1 }}>{pending}</span>
        <span style={{ fontSize: '0.85rem', color: '#80868b' }}>/{total}</span>
      </div>
      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: pending > 0 ? '#f29900' : '#34a853', fontWeight: 600 }}>
        {pending > 0 ? 'chờ xác nhận' : 'đã hoàn thành'}
      </p>
    </button>
  );
}
