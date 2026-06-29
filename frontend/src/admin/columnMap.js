// Ánh xạ giữa tiêu đề cột trong file Excel (giống Google Sheets cũ) và tên cột DB.
// Dùng cho cả export (db → header) và import (header → db).
// Thứ tự phần tử = thứ tự cột khi xuất Excel.

export const TABLES = {
  stocks: [
    ['store', 'store'],
    ['store_name', 'store_name'],
    ['article', 'article'],
    ['article_name', 'article_name'],
    ['stock_day', 'stock_day'],
    ['stock', 'stock'],
    ['pic', 'pic'],
    ['risk', 'risk'],
    ['thùng', 'thung'],
    ['current_stock', 'current_stock'],
    ['counted_stock', 'counted_stock'],
    ['note', 'note'],
    ['lat', 'lat'],
    ['long', 'long'],
    ['stock_check', 'stock_check'],
    ['time_stamp', 'time_stamp'],
    ['location_check', 'location_check'],
    ['image', 'image'],
    ['pic_comment', 'pic_comment'],
    ['pic_status', 'pic_status'],
  ],
  stores: [
    ['store', 'store'],
    ['store_name', 'store_name'],
    ['lat', 'lat'],
    ['long', 'long'],
    ['CHT', 'cht'],
    ['SDT CHT', 'sdt_cht'],
    ['QLKV', 'qlkv'],
    ['QLKV id', 'qlkv_id'],
    ['SDT QLKV', 'sdt_qlkv'],
    ['KSTT', 'kstt'],
    ['GDV', 'gdv'],
    ['GDV id', 'gdv_id'],
    ['GDM', 'gdm'],
    ['GDM id', 'gdm_id'],
    ['GDC', 'gdc'],
    ['GDC id', 'gdc_id'],
  ],
  PIC: [
    ['PIC', 'pic'],
    ['password', 'password'],
  ],
  qlkv: [
    ['username', 'username'],
    ['name', 'name'],
    ['role', 'role'],
  ],
};

// Tên sheet trong Excel → tên bảng DB (whitelist phía backend: stocks/stores/pic/qlkv)
export const SHEET_TO_TABLE = {
  stocks: 'stocks',
  stores: 'stores',
  pic: 'pic',
  qlkv: 'qlkv',
};

// Đổi 1 dòng từ DB-keyed → Excel-header-keyed (export)
export function dbRowToExcel(sheetName, row) {
  const out = {};
  for (const [header, db] of TABLES[sheetName]) {
    out[header] = row[db] ?? '';
  }
  return out;
}

// Đổi 1 dòng từ Excel-header-keyed → DB-keyed (import).
// Chấp nhận cả tiêu đề tiếng Việt lẫn tên cột DB; bỏ qua cột lạ.
export function excelRowToDb(tableName, row, pairs) {
  const headerToDb = {};
  for (const [header, db] of pairs) {
    headerToDb[String(header).trim().toLowerCase()] = db;
    headerToDb[String(db).trim().toLowerCase()] = db; // fallback: header đã là tên db
  }
  const out = {};
  for (const key of Object.keys(row)) {
    const db = headerToDb[String(key).trim().toLowerCase()];
    if (!db) continue;
    const v = row[key];
    out[db] = v == null ? '' : String(v);
  }
  return out;
}
