# Stock Confirmation — Xác Nhận Tồn Kho

Hệ thống mobile-first để nhân viên cửa hàng xác nhận tồn kho thực tế, PIC theo dõi & nhận xét, và QLKV giám sát tiến độ.

---

## Cấu trúc project

```
xac-nhan-ton-kho/
├── backend/                      Google Apps Script (clasp)
│   ├── Code.js                   Toàn bộ logic backend (548 dòng)
│   └── appsscript.json
├── frontend/                     React 19 + Vite
│   └── src/
│       ├── App.jsx               Module nhân viên cửa hàng (Store staff)
│       ├── api.js                Tất cả hàm gọi API (fetch)
│       ├── components/           Components dùng chung (Store flow)
│       │   ├── StoreSearch       Nhập mã CH 4 ký tự
│       │   ├── StockList         Danh sách sản phẩm (card, 2 nhóm)
│       │   ├── ConfirmModal      Bottom sheet xác nhận tồn kho + ảnh
│       │   ├── CameraCapture     Camera live (getUserMedia, tối đa 5 ảnh)
│       │   └── Toast             Thông báo thành công
│       ├── pic/                  Module PIC (Product In Charge)
│       │   ├── PicApp.jsx        Router PIC: login → dashboard / progress
│       │   ├── PicLogin.jsx      Đăng nhập PIC (pic + password)
│       │   ├── PicDashboard.jsx  Bảng theo dõi tồn kho, nhận xét batch
│       │   ├── PicProgressView.jsx  View tiến độ xác nhận theo QLKV
│       │   └── ProgressDashboard.jsx  Dashboard tổng hợp tiến độ
│       └── qlkv/                 Module QLKV (Quản lý khu vực)
│           ├── QlkvApp.jsx       Router QLKV: login → dashboard / progress
│           ├── QlkvLogin.jsx     Đăng nhập QLKV (username)
│           ├── QlkvDashboard.jsx Bảng tồn kho theo khu vực, filter risk
│           └── QlkvProgressView.jsx  View tiến độ xác nhận theo QLKV
├── test.mjs                      Script test API (node test.mjs)
├── .clasp.json                   Cấu hình clasp (Script ID)
├── netlify.toml                  Cấu hình Netlify redirect
└── CLAUDE.md
```

---

## Backend — Google Apps Script

**Script ID:** `1bXUbjmKEMnXGBEhp5Dz5SE256F9jGrTE2Yqd9Gyiiav95NE7qv74saNR`

**Spreadsheet:** `https://docs.google.com/spreadsheets/d/1mQX6TXjrxjSP08cQ-sGES__prD0_NM23GcyexcFOc6I`

**Drive folder ảnh:** `https://drive.google.com/drive/folders/11tUqvg52iEOgdSldCiljSOnCE146Hnae`

### Sheets trong Spreadsheet

#### Sheet `stocks` — dữ liệu tồn kho

| Cột | Nguồn | Mô tả |
|-----|-------|-------|
| store | Admin nhập | Mã cửa hàng |
| store_name | Admin nhập | Tên cửa hàng |
| article | Admin nhập | Mã sản phẩm |
| article_name | Admin nhập | Tên sản phẩm |
| stock_day | Admin nhập | Ngày lấy tồn |
| stock | Admin nhập | Tồn hệ thống |
| pic | Admin nhập | Mã PIC phụ trách |
| risk | Admin nhập | Mức độ rủi ro (cao / tb / thap) |
| thùng / thung | Admin nhập | Số thùng |
| current_stock | User nhập | Tồn hiện tại |
| counted_stock | User nhập | Tồn kiểm kho |
| note | User nhập | Ghi chú |
| lat, long | Tự động | GPS lúc submit |
| stock_check | Tính toán | counted_stock - current_stock |
| time_stamp | Tự động | Thời điểm submit |
| location_check | Tính toán | Khoảng cách (m) giữa user và CH (Haversine) |
| image | Tự động | URL file ảnh trên Drive (nhiều URL cách nhau dấu phẩy) |
| pic_comment | PIC nhập | Nhận xét của PIC |
| pic_status | PIC nhập | Trạng thái PIC đánh dấu |

#### Sheet `stores` — danh sách cửa hàng

| Cột | Mô tả |
|-----|-------|
| store | Mã cửa hàng |
| store_name | Tên cửa hàng |
| lat, long | Tọa độ GPS cửa hàng |
| CHT | Chủ hàng trưởng |
| SDT CHT | SĐT CHT |
| QLKV | Tên quản lý khu vực |
| QLKV id | Username QLKV (dùng cho login) |
| SDT QLKV | SĐT QLKV |
| KSTT | Kiểm soát tồn thực |

#### Sheet `PIC` — tài khoản PIC

| Cột | Mô tả |
|-----|-------|
| PIC | Mã PIC (vd: P1) |
| password | Mật khẩu |

#### Sheet `qlkv` — tài khoản QLKV

| Cột | Mô tả |
|-----|-------|
| username | Tên đăng nhập QLKV |
| name | Tên hiển thị |

### Cấu trúc thư mục Drive ảnh

```
Drive root/
  └── mmdd/           (ngày lấy tồn kho, vd: 0501)
        └── pic_store/ (vd: P1_2011)
              └── store_article-name_stock_counted[_n].jpg
```

### API endpoints

#### GET requests

| Action | Params | Mô tả |
|--------|--------|-------|
| getStores | — | Danh sách cửa hàng |
| getStocks | store=XXXX | Tồn kho theo cửa hàng (Store flow) |
| getPicStocks | pic=P1 | Tồn kho theo PIC + thông tin stores, cht, qlkv |
| getProgress | pic=dunghd hoặc hienbm | Tiến độ xác nhận toàn bộ (chỉ admin) |
| getQlkvStocks | username=xxx | Tồn kho theo khu vực QLKV |

#### POST requests (JSON body, Content-Type: text/plain để tránh CORS preflight)

| Action | Payload | Mô tả |
|--------|---------|-------|
| confirm | {store, article, current_stock, counted_stock, note, lat, long, images:[{base64,type}], image, imageType} | Xác nhận tồn + upload ảnh (tối đa 5 ảnh) |
| picLogin | {pic, password} | Đăng nhập PIC |
| savePicComment | {pic, store, article, comment, pic_status} | Lưu nhận xét PIC (single) |
| batchSavePicComment | {pic, items:[{store, article, comment, pic_status}]} | Lưu nhận xét PIC hàng loạt |
| qlkvLogin | {username} | Đăng nhập QLKV |

### Deploy backend

```bash
# Push code
clasp push --force

# Redeploy (cần làm sau mỗi lần push để web app nhận code mới)
clasp deploy --deploymentId "AKfycby_wrjH-cPUrNbMKVrhNqBEODHni-MPw83XIst_2altOMbKSjR7gagL5KLgZHFW-AHyUA"
clasp deploy --deploymentId "AKfycbyLl2hJvtLQyoB4aJERmw_Pzd8PPDSrPIEJ_omwJOKTFonEOzm77V7XYc1wuPqufIG1_A"
```

> **Sau mỗi lần redeploy:** vào Apps Script → Deploy → Manage deployments → set **Who has access: Anyone**

---

## Frontend — React 19 + Vite

**URL production:** `https://xac-nhan-ton-kho.netlify.app`

**Netlify site:** `xac-nhan-ton-kho` (ID: `0c4c3c2c-ca38-4a57-86b0-2f8f516c05db`)

**Dependencies chính:** React 19, Vite 8, xlsx (xuất Excel)

### Biến môi trường

`frontend/.env`:
```
VITE_API_URL=https://script.google.com/macros/s/AKfycby_wrjH-.../exec
```

> **Lưu ý:** `api.js` đang dùng URL hardcode thay vì import.meta.env.VITE_API_URL. Cần đồng bộ khi thay đổi deployment ID.

### Deploy frontend

```bash
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

### Dev local

```bash
cd frontend
npm run dev
```

---

## Luồng UX theo module

### Module Store (App.jsx) — Nhân viên cửa hàng

```
Nhập mã CH (4 ký tự)
  → Tải danh sách sản phẩm
  → Hiển thị 2 nhóm: chờ xác nhận / đã xác nhận
  → Bấm card → Bottom sheet ConfirmModal:
      Nhập tồn hiện tại + tồn kiểm kho (bắt buộc)
      Ghi chú (không bắt buộc)
      Chụp ảnh (camera trực tiếp, tối đa 5 ảnh)
      Lấy GPS tại thời điểm Submit
      → Gửi lên backend → cập nhật UI
```

### Module PIC (src/pic/) — Product In Charge

```
Đăng nhập (pic + password)
  → PicDashboard:
      Xem toàn bộ tồn kho của PIC phụ trách
      Filter: tất cả / chờ XN / đã XN / pic_status / risk / search
      Chỉnh sửa pic_comment + pic_status (local → batch save)
      Xuất Excel (xlsx)
  → PicProgressView:
      Tiến độ xác nhận nhóm theo QLKV
      Sort theo cột, expand/collapse nhóm
```

### Module QLKV (src/qlkv/) — Quản lý khu vực

```
Đăng nhập (username)
  → QlkvDashboard:
      Xem tồn kho các CH trong khu vực
      Filter: tất cả / chờ XN / đã XN / risk (cao/tb/thấp)
      Tìm kiếm theo CH
      Xuất Excel (xlsx)
  → QlkvProgressView:
      Tiến độ xác nhận theo cửa hàng
```

---

## Lưu ý kỹ thuật

### Camera
- Dùng `getUserMedia` (không dùng `<input capture>`) để đảm bảo chỉ mở camera, không cho chọn ảnh từ thư viện.
- Hỗ trợ tối đa 5 ảnh mỗi lần submit.
- Ảnh upload dạng base64, backend decode và lưu lên Google Drive.

### CORS với Google Apps Script
- GAS không hỗ trợ CORS preflight (OPTIONS). Tất cả POST request phải dùng `Content-Type: text/plain` thay vì `application/json`.

### Batch save PIC comment
- PIC chỉnh sửa nhiều dòng locally → batch save một lần để tránh quota GAS.
- `localChanges` state lưu các thay đổi chưa sync, `pendingCount` hiển thị badge số dòng chờ lưu.

### GPS & location_check
- GPS lấy tại thời điểm bấm Gửi (không phải khi mở modal).
- `location_check` tính bằng công thức Haversine, đơn vị: mét.

### Phân quyền getProgress
- Chỉ `dunghd` và `hienbm` được phép gọi `getProgress` (hardcode trong backend).
