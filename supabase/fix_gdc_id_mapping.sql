-- Cập nhật gdc_id theo tên GDC trong bảng stores
-- Chạy trong Supabase ▸ SQL Editor

UPDATE stores SET gdc_id = 'khoald'
WHERE LOWER(BTRIM(gdc)) LIKE '%lê dương khoa%'
   OR LOWER(BTRIM(gdc)) LIKE '%le duong khoa%';

UPDATE stores SET gdc_id = 'trangptt'
WHERE LOWER(BTRIM(gdc)) LIKE '%phạm thị hiền trang%'
   OR LOWER(BTRIM(gdc)) LIKE '%pham thi hien trang%';

UPDATE stores SET gdc_id = 'hakt2'
WHERE LOWER(BTRIM(gdc)) LIKE '%khúc tiến hà%'
   OR LOWER(BTRIM(gdc)) LIKE '%khuc tien ha%';

-- Kiểm tra kết quả
SELECT store, store_name, gdc, gdc_id
FROM stores
WHERE gdc_id IN ('khoald', 'trangptt', 'hakt2')
ORDER BY gdc_id, store;
