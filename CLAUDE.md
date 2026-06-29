# Stock Confirmation — Xác Nhận Tồn Kho

Hệ thống mobile-first để nhân viên cửa hàng xác nhận tồn kho thực tế, PIC theo dõi & nhận xét, và QLKV giám sát tiến độ.

> **Kiến trúc hiện tại:** Frontend React kết nối **trực tiếp Supabase Postgres** qua `supabase-js`
> (anon key + RLS), gọi các **RPC function** thay cho backend. Ảnh upload thẳng lên **Cloudinary**
> (unsigned preset). Backend Google Apps Script trong `backend/` **chỉ còn giữ làm backup/legacy**.

---

## Cấu trúc project

```
xac-nhan-ton-kho/
├── supabase/
│   └── schema.sql                Toàn bộ schema: bảng + RLS + RPC + admin RPC (chạy trong SQL Editor)
├── backend/                      [LEGACY] Google Apps Script cũ — giữ làm backup, không còn dùng
│   ├── Code.js
│   └── appsscript.json
├── frontend/                     React 19 + Vite
│   └── src/
│       ├── main.jsx              Router theo path: / · /pic · /qlkv · /admin
│       ├── supabaseClient.js     Khởi tạo supabase-js + biến Cloudinary (từ import.meta.env)
│       ├── api.js                Tất cả hàm gọi API qua supabase.rpc() + upload Cloudinary
│       ├── App.jsx               Module nhân viên cửa hàng (Store staff)
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
│       ├── qlkv/                 Module QLKV (Quản lý khu vực)
│       │   ├── QlkvApp.jsx       Router QLKV: login → dashboard / progress
│       │   ├── QlkvLogin.jsx     Đăng nhập QLKV (username)
│       │   ├── QlkvDashboard.jsx Bảng tồn kho theo khu vực, filter risk
│       │   └── QlkvProgressView.jsx  View tiến độ xác nhận theo QLKV
│       └── admin/               Module Admin (export/import Excel hàng tuần)
│           ├── AdminApp.jsx      Đăng nhập admin (mật khẩu trong app_config)
│           ├── AdminPanel.jsx    Tải Excel + nạp Excel thay thế toàn bộ bảng
│           └── columnMap.js      Map tiêu đề cột Excel ↔ tên cột DB
├── frontend/test-supabase.mjs    Script test RPC Supabase (node test-supabase.mjs)
├── test.mjs                      [LEGACY] Script test API GAS cũ
├── netlify.toml                  Cấu hình Netlify (SPA redirect /* → /index.html)
└── CLAUDE.md
```

---

## Backend — Supabase

**Project URL / anon key / Cloudinary preset:** đặt trong `frontend/.env` (xem mục Biến môi trường).

**Toàn bộ schema** nằm trong [supabase/schema.sql](supabase/schema.sql) — chạy 1 lần trong
**Supabase ▸ SQL Editor**. File này tạo bảng, bật RLS, và định nghĩa mọi RPC.

### Nguyên tắc bảo mật

- Mọi cột để kiểu **`text`** (mirror Google Sheets — giúp import/export Excel round-trip không lỗi ép kiểu;
  RPC tự cast khi cần qua hàm `num()`).
- Bật **RLS** trên mọi bảng, **không cấp policy** cho `anon` → không thể SELECT/UPDATE thẳng bảng.
- Mọi truy cập đi qua **RPC `SECURITY DEFINER`** (chạy bằng quyền owner, bỏ qua RLS) và chỉ trả về
  đúng cột cần thiết. Role `anon` chỉ được `GRANT EXECUTE` các RPC.
- **Tuyệt đối không** đưa `service_role` key vào frontend. Trang Admin dùng cổng mật khẩu
  (`app_config.admin_password`) kiểm tra bên trong RPC.

### Bảng

#### `stocks` — dữ liệu tồn kho

| Cột | Nguồn | Mô tả |
|-----|-------|-------|
| store | Admin nạp | Mã cửa hàng |
| store_name | Admin nạp | Tên cửa hàng |
| article | Admin nạp | Mã sản phẩm |
| article_name | Admin nạp | Tên sản phẩm |
| stock_day | Admin nạp | Ngày lấy tồn |
| stock | Admin nạp | Tồn hệ thống |
| pic | Admin nạp | Mã PIC phụ trách |
| risk | Admin nạp | Mức độ rủi ro (rất cao / cao / tb / thap) |
| thung | Admin nạp | Số thùng (Excel: cột `thùng`) |
| current_stock | User nhập | Tồn hiện tại |
| counted_stock | User nhập | Tồn kiểm kho |
| note | User nhập | Ghi chú |
| lat, long | Tự động | GPS lúc submit |
| stock_check | Tính toán | counted_stock − current_stock |
| time_stamp | Tự động | Thời điểm submit (giờ VN) |
| location_check | Tính toán | Khoảng cách (m) giữa user và CH (Haversine) |
| image | Tự động | URL ảnh Cloudinary (nhiều URL cách nhau dấu phẩy) |
| pic_comment | PIC nhập | Nhận xét của PIC |
| pic_status | PIC nhập | Trạng thái PIC đánh dấu |

Index: `stocks(store)`, `stocks(pic)`, `stocks(store, article)`.

#### `stores` — danh sách cửa hàng

Cột DB (snake_case) ↔ tiêu đề Excel: `store`, `store_name`, `lat`, `long`, `cht`(CHT),
`sdt_cht`(SDT CHT), `qlkv`(QLKV), `qlkv_id`(QLKV id — username login QLKV), `sdt_qlkv`(SDT QLKV),
`kstt`(KSTT), `gdv`/`gdv_id`(GDV/GDV id), `gdm`/`gdm_id`, `gdc`/`gdc_id`.

#### `pic` — tài khoản PIC

`pic` (Excel: PIC), `password`.

#### `qlkv` — tài khoản QLKV

`username`, `name`, `role` (rỗng → mặc định `qlkv`; các giá trị: `qlkv`/`gdv`/`gdm`/`gdc` quyết định cột id dùng để lọc store).

#### `app_config` — cấu hình

`key`, `value`. Có sẵn dòng `admin_password` (mặc định `changeme` — **đổi sau khi chạy schema**).

### RPC functions

> `api.js` gọi qua `supabase.rpc(name, params)`. Mọi RPC trả `jsonb`; lỗi trả `{ error: "..." }`.

| RPC | Params | Thay cho | Trả về |
|-----|--------|----------|--------|
| `get_stores()` | — | getStores | `{ stores:[{store,store_name,lat,long}] }` |
| `get_stocks_by_store(p_store)` | store | getStocks | `{ store, store_name, stocks:[...] }` |
| `get_pic_stocks(p_pic)` | pic | getPicStocks | `{ pic, stocks:[... + thông tin store] }` |
| `get_qlkv_stocks(p_username)` | username | getQlkvStocks | `{ username, role, stocks:[...] }` (lọc store theo role/id) |
| `get_progress()` | — | getProgress | `{ stocks:[...], storeMap:{...} }` |
| `pic_login(p_pic, p_password)` | | picLogin | `{ success, pic }` / `{ error }` |
| `qlkv_login(p_username)` | | qlkvLogin | `{ success, username, name, role }` |
| `confirm_stock(p_store, p_article, p_current_stock, p_counted_stock, p_note, p_lat, p_long, p_image_urls)` | | confirm | `{ success, imageUrls, location_check }` |
| `save_pic_comment(p_pic, p_store, p_article, p_comment, p_pic_status)` | | savePicComment | `{ success }` |
| `batch_save_pic_comment(p_pic, p_items)` | items: jsonb[] | batchSavePicComment | `{ success, saved, total, errors }` |
| `admin_check(p_password)` | | — | `boolean` (xác thực mật khẩu admin) |
| `admin_export_all(p_password)` | | — | `{ stocks, stores, pic, qlkv }` (full row) |
| `admin_replace_table(p_password, p_table, p_rows)` | | — | `{ success, table, inserted }` (TRUNCATE + insert) |

Hàm phụ trong SQL: `num(text)` (ép số an toàn), `haversine_m(...)` (khoảng cách mét).

### Ảnh — Cloudinary (unsigned upload)

- `confirm_stock` **không** xử lý ảnh. Trình duyệt upload ảnh thẳng lên Cloudinary qua **unsigned upload
  preset** (`uploadToCloudinary` trong [frontend/src/api.js](frontend/src/api.js)), rồi truyền mảng
  `secure_url` vào `confirm_stock` (`p_image_urls`).
- `public_id` ảnh giữ cấu trúc cũ: `mmdd/pic_store/store_article[_n]` (vd `0501/P1_2011/2011_<article>_2`).
- Thiết lập preset 1 lần: Cloudinary ▸ Settings ▸ Upload ▸ Add upload preset → **Signing mode = Unsigned**,
  root folder `xac-nhan-ton-kho`, cho phép `public_id`. Tên preset đặt vào `VITE_CLOUDINARY_UPLOAD_PRESET`.

---

## Frontend — React 19 + Vite

**URL production:** `https://xac-nhan-ton-kho.netlify.app`

**Netlify site:** `xac-nhan-ton-kho` (ID: `0c4c3c2c-ca38-4a57-86b0-2f8f516c05db`)

**Dependencies chính:** React 19, Vite 8, `@supabase/supabase-js`, `xlsx` (export/import Excel).

### Routing (main.jsx)

Theo `window.location.pathname`: `/pic` → PicApp · `/qlkv` → QlkvApp · `/admin` → AdminApp · còn lại → App (Store).
`netlify.toml` đã redirect `/* → /index.html` (SPA) nên mọi path load được.

### Biến môi trường

`frontend/.env` (và Netlify env — xem mẫu `frontend/.env.example`):
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_CLOUDINARY_CLOUD=dy9kmwc6y
VITE_CLOUDINARY_UPLOAD_PRESET=...
```

### Deploy frontend

```bash
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

> Sau khi đổi `.env`: nhớ cập nhật cùng các biến trên **Netlify ▸ Site settings ▸ Environment variables**.

### Dev local

```bash
cd frontend
npm run dev
```

### Test backend

```bash
cd frontend
node test-supabase.mjs    # gọi vài RPC, kiểm tra dữ liệu + RLS chặn đọc thẳng bảng pic
```

---

## Luồng UX theo module

### Module Store (App.jsx) — Nhân viên cửa hàng

```
Nhập mã CH (4 ký tự)
  → Tải danh sách sản phẩm (get_stocks_by_store — cần CH có trong bảng stores)
  → Hiển thị 2 nhóm: chờ xác nhận / đã xác nhận
  → Bấm card → ConfirmModal:
      Nhập tồn hiện tại + tồn kiểm kho (bắt buộc)
      Ghi chú (không bắt buộc) · Chụp ảnh (camera, tối đa 5 ảnh)
      Lấy GPS tại thời điểm Submit
      → Upload ảnh lên Cloudinary → confirm_stock → cập nhật UI
```

### Module PIC (src/pic/) — Product In Charge

```
Đăng nhập (pic + password)
  → PicDashboard: xem tồn kho PIC phụ trách, filter, sửa pic_comment/pic_status (batch save), xuất Excel
  → PicProgressView: tiến độ xác nhận nhóm theo QLKV, sort, expand/collapse
```

### Module QLKV (src/qlkv/) — Quản lý khu vực

```
Đăng nhập (username) — role quyết định cột id lọc store (qlkv_id/gdv_id/gdm_id/gdc_id)
  → QlkvDashboard: tồn kho các CH trong khu vực, filter risk, tìm kiếm, xuất Excel
  → QlkvProgressView: tiến độ xác nhận theo cửa hàng
```

### Module Admin (src/admin/) — Quản trị dữ liệu hàng tuần

```
Đăng nhập (mật khẩu admin)
  → AdminPanel:
      1. Tải Excel: admin_export_all → workbook 4 sheet (stocks/stores/PIC/qlkv)
      2. Nạp Excel: đọc file → mỗi sheet THAY THẾ TOÀN BỘ bảng (admin_replace_table → TRUNCATE + insert)
```

**Quy trình hàng tuần:** Tải Excel sao lưu → chỉnh dữ liệu tồn kho mới → nạp lại (thay thế bảng `stocks`).
**Migration lần đầu:** tải Google Sheet cũ ra `.xlsx` (đủ 4 sheet) → vào `/admin` → nạp từng bảng.

---

## Lưu ý kỹ thuật

### Camera
- Dùng `getUserMedia` (không dùng `<input capture>`) để chỉ mở camera, không cho chọn ảnh từ thư viện.
- Tối đa 5 ảnh/lần submit; ảnh dạng base64 → upload thẳng Cloudinary từ trình duyệt.

### GPS & location_check
- GPS lấy tại thời điểm bấm Gửi (không phải khi mở modal).
- `location_check` tính bằng Haversine (`haversine_m` trong SQL), đơn vị mét.

### Batch save PIC comment
- PIC chỉnh sửa nhiều dòng locally → `batch_save_pic_comment` một lần (giảm số round-trip).
- `localChanges` lưu thay đổi chưa sync, badge `pendingCount` hiển thị số dòng chờ lưu.

### Phụ thuộc bảng stores
- `get_stocks_by_store` (và `confirm_stock`) tra cứu CH trong bảng `stores` trước. Nếu chưa nạp `stores`,
  Store flow báo `"Store not found"` dù `stocks` đã có dữ liệu → **nhớ nạp đủ cả 4 bảng** khi migration.

### Nạp Excel thay thế toàn bộ
- `admin_replace_table` chạy `TRUNCATE` rồi insert → **xoá hết dữ liệu cũ** của bảng (kể cả các cột
  người dùng đã nhập: counted_stock, ảnh, pic_comment…). Luôn **tải Excel sao lưu trước khi nạp**.
- Tiêu đề cột trong Excel ↔ cột DB được map ở [columnMap.js](frontend/src/admin/columnMap.js) (chấp nhận
  cả tên tiếng Việt lẫn tên cột DB). Nếu file Excel có tiêu đề khác → cập nhật map này.

