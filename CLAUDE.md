# Stock Confirmation — Xác Nhận Tồn Kho

Hệ thống mobile-first để nhân viên cửa hàng xác nhận tồn kho thực tế.

## Cấu trúc project

```
stock-confirmation/
├── backend/          Google Apps Script (clasp)
│   ├── Code.js
│   └── appsscript.json
├── frontend/         React + Vite
│   └── src/
│       ├── api.js
│       ├── App.jsx
│       └── components/
│           ├── StoreSearch      Nhập mã CH 4 ký tự
│           ├── StockList        Danh sách sản phẩm (card)
│           ├── ConfirmModal     Bottom sheet xác nhận
│           ├── CameraCapture    Camera live (getUserMedia)
│           └── Toast            Thông báo thành công
├── test.mjs          Script test API (node test.mjs)
└── CLAUDE.md
```

## Backend — Google Apps Script

**Script ID:** `1955FquvEY5qk1R9H2NiqcFuxlCjr5dCFNwun7Xnd3TGhpBbtJVcqEv_t`

**Spreadsheet:** `https://docs.google.com/spreadsheets/d/1VSKEIWrD0jJU4A9cSlBfaslN6Jw46EQWnQWqc-vP1GU`

**Drive folder ảnh:** `https://drive.google.com/drive/folders/1Ul1blN2-td81r5s9tWpow53rmETpXLbD`

### Sheet `stocks` — cột dữ liệu

| Cột | Nguồn |
|-----|-------|
| store, store_name, article, article_name, stock_day, stock, pic | Admin nhập |
| current_stock, counted_stock, note, lat, long | User nhập |
| stock_check | Tính: `counted_stock - current_stock` |
| time_stamp | Tự động khi submit |
| location_check | Khoảng cách (mét) giữa user và CH (Haversine) |
| image | URL file ảnh trên Drive |

### Sheet `stores` — cột dữ liệu

`store`, `store_name`, `lat`, `long`

### Cấu trúc thư mục Drive ảnh

```
Drive root/
  └── mmdd/           (ngày lấy tồn kho, vd: 0501)
        └── pic_store/ (vd: P1_2011)
              └── store_article-name_stock_counted.jpg
```

### API endpoints

| Method | Params | Mô tả |
|--------|--------|-------|
| GET | `?action=getStores` | Danh sách cửa hàng |
| GET | `?action=getStocks&store=XXXX` | Tồn kho theo cửa hàng |
| POST | `{action:"confirm", store, article, current_stock, counted_stock, note, lat, long, image (base64), imageType}` | Xác nhận + upload ảnh |

### Deploy backend

```bash
# Push code
clasp push --force

# Redeploy (cần làm sau mỗi lần push để web app nhận code mới)
clasp deploy --deploymentId "AKfycby_wrjH-cPUrNbMKVrhNqBEODHni-MPw83XIst_2altOMbKSjR7gagL5KLgZHFW-AHyUA"
clasp deploy --deploymentId "AKfycbyLl2hJvtLQyoB4aJERmw_Pzd8PPDSrPIEJ_omwJOKTFonEOzm77V7XYc1wuPqufIG1_A"
```

> **Sau mỗi lần redeploy:** vào Apps Script → Deploy → Manage deployments → set **Who has access: Anyone**

## Frontend — React Vite

**URL production:** `https://xac-nhan-ton-kho.netlify.app`

**Netlify site:** `xac-nhan-ton-kho` (ID: `0c4c3c2c-ca38-4a57-86b0-2f8f516c05db`)

### Biến môi trường

`frontend/.env`:
```
VITE_API_URL=https://script.google.com/macros/s/AKfycby_wrjH-.../exec
```

### Deploy frontend

```bash
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

### Luồng UX

1. Nhập mã cửa hàng (4 ký tự) → Kiểm tra
2. Danh sách sản phẩm chia 2 nhóm: chờ xác nhận / đã xác nhận
3. Bấm card → bottom sheet:
   - Nhập tồn hiện tại + tồn kiểm kho (bắt buộc)
   - Ghi chú (không bắt buộc)
   - Chụp ảnh (camera trực tiếp, không cho upload từ thư viện)
   - Bấm Gửi → lấy GPS tại thời điểm submit → gửi lên backend

### Lưu ý camera

Dùng `getUserMedia` (không dùng `<input capture>`) để đảm bảo chỉ mở camera, không cho chọn ảnh từ thư viện.
