const SPREADSHEET_ID = '1mQX6TXjrxjSP08cQ-sGES__prD0_NM23GcyexcFOc6I';
const DRIVE_FOLDER_ID = '11tUqvg52iEOgdSldCiljSOnCE146Hnae';


function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getStores') return respond(getStores());

    if (action === 'getStocks') {
      const store = e.parameter.store;
      if (!store) return respond({ error: 'Missing store parameter' });
      return respond(getStocksByStore(store));
    }

    if (action === 'getPicStocks') {
      const pic = e.parameter.pic;
      if (!pic) return respond({ error: 'Missing pic parameter' });
      return respond(getPicStocks(pic));
    }

    if (action === 'getProgress') {
      const pic = e.parameter.pic;
      const allowed = ['dunghd', 'hienbm'];
      if (!allowed.includes(String(pic).toLowerCase())) return respond({ error: 'Unauthorized' });
      return respond(getProgress());
    }

    if (action === 'getQlkvStocks') {
      const username = e.parameter.username;
      if (!username) return respond({ error: 'Missing username parameter' });
      return respond(getQlkvStocks(username));
    }

    return respond({ error: 'Unknown action' });
  } catch (err) {
    return respond({ error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'confirm')             return respond(confirmStock(data));
    if (data.action === 'uploadImages')        return respond(uploadImages(data));
    if (data.action === 'picLogin')            return respond(picLogin(data));
    if (data.action === 'savePicComment')      return respond(savePicComment(data));
    if (data.action === 'batchSavePicComment') return respond(batchSavePicComment(data));
    if (data.action === 'qlkvLogin')           return respond(qlkvLogin(data));
    return respond({ error: 'Unknown action' });
  } catch (err) {
    return respond({ error: err.message });
  }
}

function getStores() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('stores');
  const [headers, ...rows] = sheet.getDataRange().getValues();
  const idx = name => headers.indexOf(name);

  return {
    stores: rows
      .filter(r => r[idx('store')])
      .map(r => ({
        store: r[idx('store')],
        store_name: r[idx('store_name')],
        lat: r[idx('lat')],
        long: r[idx('long')]
      }))
  };
}

function testGetStockByStore (){
  const storeId = 2011
  console.log(getStocksByStore(storeId))
}

function getStocksByStore(storeId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const storesData = ss.getSheetByName('stores').getDataRange().getValues();
  const sh = storesData[0];
  const storeRow = storesData.slice(1).find(
    r => String(r[sh.indexOf('store')]) === String(storeId)
  );
  if (!storeRow) return { error: 'Store not found' };

  const stocksData = ss.getSheetByName('stocks').getDataRange().getValues();
  const h = stocksData[0];
  const col = name => h.indexOf(name);

  const get = (r, name) => {
    const c = col(name);
    return c !== -1 ? r[c] : null;
  };
  var thungCol = col('thùng') !== -1 ? 'thùng' : 'thung';

  const stocks = stocksData
    .slice(1)
    .filter(r => String(r[col('store')]) === String(storeId))
    .map(r => ({
      article:       get(r, 'article'),
      article_name:  get(r, 'article_name'),
      stock_day:     get(r, 'stock_day'),
      stock:         get(r, 'stock'),
      pic:           get(r, 'pic'),
      current_stock: get(r, 'current_stock'),
      counted_stock: get(r, 'counted_stock'),
      note:          get(r, 'note'),
      thung:         get(r, thungCol),
      risk:          get(r, 'risk')
    }));

  return {
    store: storeId,
    store_name: storeRow[sh.indexOf('store_name')],
    stocks
  };
}

// data: { store, article, current_stock, counted_stock, note, lat, long,
//         images: [{base64, type}],   // tối đa 5 ảnh
//         image, imageType            // backward-compat (single)
// }
function confirmStock(data) {
  const { store, article, current_stock, counted_stock, note, lat, long,
          image, imageType, images } = data;

  if (!store || !article || counted_stock === undefined || counted_stock === '') {
    return { error: 'Missing required fields: store, article, counted_stock' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('stocks');
  const values = sheet.getDataRange().getValues();
  const h = values[0];
  const col = name => h.indexOf(name);

  const rowIdx = values.findIndex(
    (r, i) => i > 0 &&
      String(r[col('store')]) === String(store) &&
      String(r[col('article')]) === String(article)
  );
  if (rowIdx === -1) return { error: 'Stock record not found' };

  const rowData = values[rowIdx];
  const articleName = rowData[col('article_name')];
  const systemStock = rowData[col('stock')];
  const stockDay   = rowData[col('stock_day')];
  const pic        = rowData[col('pic')];
  const rowNum = rowIdx + 1;

  // Tính stock_check = counted_stock - current_stock
  const stockCheck = Number(counted_stock) - Number(current_stock || 0);

  // Tính khoảng cách GPS với cửa hàng (location_check)
  let locationCheck = '';
  if (lat && long) {
    const storesData = ss.getSheetByName('stores').getDataRange().getValues();
    const sh = storesData[0];
    const storeRow = storesData.slice(1).find(
      r => String(r[sh.indexOf('store')]) === String(store)
    );
    if (storeRow) {
      const storeLat = storeRow[sh.indexOf('lat')];
      const storeLong = storeRow[sh.indexOf('long')];
      if (storeLat && storeLong) {
        const dist = haversineDistance(Number(lat), Number(long), Number(storeLat), Number(storeLong));
        locationCheck = dist;
      }
    }
  }

  // Chuẩn hoá danh sách ảnh: ưu tiên images[], fallback về single image
  const imageList = Array.isArray(images) && images.length > 0
    ? images.slice(0, 5)
    : (image ? [{ base64: image, type: imageType || 'image/jpeg' }] : []);

  // Upload ảnh lên Google Drive
  const imageUrls = [];
  if (imageList.length > 0) {
    const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const dateFolder = getOrCreateFolder(rootFolder, toMmdd(stockDay));
    const picStoreFolder = getOrCreateFolder(dateFolder, (pic || 'nopic') + '_' + store);

    imageList.forEach(function(img, idx) {
      const suffix = imageList.length > 1 ? '_' + (idx + 1) : '';
      const fileName = store + '_' + String(article) + suffix + '.jpg';
      const url = uploadToDrive(img.base64, img.type || 'image/jpeg', fileName, picStoreFolder);
      if (url) imageUrls.push(url);
    });
  }

  // Ghi vào sheet — nhiều URL phân cách bằng dấu phẩy
  const imageUrlValue = imageUrls.join(',');

  [
    ['current_stock',  current_stock ?? ''],
    ['counted_stock',  counted_stock],
    ['note',           note || ''],
    ['lat',            lat || ''],
    ['long',           long || ''],
    ['stock_check',    stockCheck],
    ['time_stamp',     new Date()],
    ['location_check', locationCheck],
    ['image',          imageUrlValue]
  ].forEach(([name, value]) => {
    const c = col(name);
    if (c !== -1) sheet.getRange(rowNum, c + 1).setValue(value);
  });

  return { success: true, imageUrls, location_check: locationCheck };
}

// ── PIC functions ──────────────────────────────────────────

// data: { pic, password }
function picLogin(data) {
  const { pic, password } = data;
  if (!pic || !password) return { error: 'Missing pic or password' };

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('PIC');
  if (!sheet) return { error: 'PIC sheet not found' };

  const [headers, ...rows] = sheet.getDataRange().getValues();
  const picCol  = headers.indexOf('PIC');
  const passCol = headers.indexOf('password');

  const row = rows.find(
    r => String(r[picCol]).trim() === String(pic).trim() &&
         String(r[passCol]).trim() === String(password).trim()
  );

  if (!row) return { error: 'Sai tên PIC hoặc mật khẩu' };
  return { success: true, pic: String(row[picCol]).trim() };
}

// GET ?action=getPicStocks&pic=P1
function getPicStocks(picName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const stocksData = ss.getSheetByName('stocks').getDataRange().getValues();
  const h = stocksData[0];
  const col = name => h.indexOf(name);

  const get = (r, name) => {
    const c = col(name);
    return c !== -1 ? r[c] : null;
  };
  var thungCol = col('thùng') !== -1 ? 'thùng' : 'thung';

  const stocks = stocksData
    .slice(1)
    .filter(r => String(get(r, 'pic')).trim() === String(picName).trim())
    .map(r => ({
      store:         get(r, 'store'),
      article:       get(r, 'article'),
      article_name:  get(r, 'article_name'),
      stock_day:     get(r, 'stock_day'),
      stock:         get(r, 'stock'),
      current_stock: get(r, 'current_stock'),
      counted_stock: get(r, 'counted_stock'),
      note:          get(r, 'note'),
      lat:           get(r, 'lat'),
      long:          get(r, 'long'),
      image:         get(r, 'image'),
      time_stamp:    get(r, 'time_stamp'),
      location_check: get(r, 'location_check'),
      pic_comment:   get(r, 'pic_comment'),
      pic_status:    get(r, 'pic_status'),
      thung:         get(r, thungCol),
      risk:          get(r, 'risk')
    }));

  // Gắn thêm store_name, store_lat, store_long từ sheet stores
  const storesData = ss.getSheetByName('stores').getDataRange().getValues();
  const sh = storesData[0];
  const storeMap = {};
  storesData.slice(1).forEach(r => {
    storeMap[String(r[sh.indexOf('store')])] = {
      store_name: r[sh.indexOf('store_name')],
      store_lat:  r[sh.indexOf('lat')],
      store_long: r[sh.indexOf('long')],
      cht:        r[sh.indexOf('CHT')],
      sdt_cht:    r[sh.indexOf('SDT CHT')],
      qlkv:       r[sh.indexOf('QLKV')],
      sdt_qlkv:   r[sh.indexOf('SDT QLKV')],
    };
  });

  stocks.forEach(s => {
    const info = storeMap[String(s.store)] || {};
    s.store_name = info.store_name || '';
    s.store_lat  = info.store_lat  || '';
    s.store_long = info.store_long || '';
    s.cht        = info.cht        || '';
    s.sdt_cht    = info.sdt_cht    || '';
    s.qlkv       = info.qlkv       || '';
    s.sdt_qlkv   = info.sdt_qlkv   || '';
  });

  return { pic: picName, stocks };
}

// data: { pic, store, article, comment, pic_status }
function savePicComment(data) {
  const { pic, store, article, comment, pic_status } = data;
  if (!pic || !store || !article) return { error: 'Missing required fields' };

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('stocks');
  const values = sheet.getDataRange().getValues();
  const h = values[0];
  const col = name => h.indexOf(name);

  const rowIdx = values.findIndex(
    (r, i) => i > 0 &&
      String(r[col('store')]) === String(store) &&
      String(r[col('article')]) === String(article)
  );
  if (rowIdx === -1) return { error: 'Stock record not found' };

  const picCommentCol = col('pic_comment');
  if (picCommentCol === -1) return { error: 'Column pic_comment not found in sheet' };

  sheet.getRange(rowIdx + 1, picCommentCol + 1).setValue(comment || '');

  const picStatusCol = col('pic_status');
  if (picStatusCol !== -1) {
    sheet.getRange(rowIdx + 1, picStatusCol + 1).setValue(pic_status || '');
  }

  return { success: true };
}

// data: { pic, items: [{store, article, comment, pic_status}] }
function batchSavePicComment(data) {
  var pic   = data.pic;
  var items = data.items;
  if (!pic || !Array.isArray(items) || items.length === 0) {
    return { error: 'Missing pic or items', receivedPic: pic, itemCount: items ? items.length : 0 };
  }

  var sheet  = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('stocks');
  var all    = sheet.getDataRange().getValues();
  var h      = all[0];
  var storeCol      = h.indexOf('store');
  var articleCol    = h.indexOf('article');
  var picStatusCol  = h.indexOf('pic_status');
  var picCommentCol = h.indexOf('pic_comment');

  if (picStatusCol === -1 || picCommentCol === -1) {
    return { error: 'Columns not found', picStatusCol: picStatusCol, picCommentCol: picCommentCol, headers: h };
  }

  // Tạo lookup map: "store-article" → rowIndex (1-based sheet row)
  var rowMap = {};
  for (var i = 1; i < all.length; i++) {
    var key = String(all[i][storeCol]).trim() + '-' + String(all[i][articleCol]).trim();
    rowMap[key] = i + 1; // sheet row = array index + 1
  }

  var saved  = 0;
  var errors = [];
  var debug  = [];

  for (var j = 0; j < items.length; j++) {
    var item        = items[j];
    var itemStore   = String(item.store).trim();
    var itemArticle = String(item.article).trim();
    var lookupKey   = itemStore + '-' + itemArticle;
    var sheetRow    = rowMap[lookupKey];

    if (!sheetRow) {
      errors.push(lookupKey + ' not found');
      debug.push({ key: lookupKey, found: false });
      continue;
    }

    sheet.getRange(sheetRow, picStatusCol + 1).setValue(item.pic_status || '');
    sheet.getRange(sheetRow, picCommentCol + 1).setValue(item.comment || '');
    saved++;
    debug.push({ key: lookupKey, row: sheetRow, status: item.pic_status, comment: item.comment });
  }

  SpreadsheetApp.flush();
  return { success: true, saved: saved, total: items.length, errors: errors, debug: debug };
}

// Lấy hoặc tạo subfolder theo tên
function getOrCreateFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// Chuyển stock_day thành chuỗi mmdd (vd: "0428")
function toMmdd(dateVal) {
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'nodate';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return mm + dd;
}

// Haversine formula — trả về khoảng cách (mét)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── Google Drive upload ───────────────────────────────────

// POST { action:'uploadImages', store, article, pic, stock_day, images:[{base64,type}] }
function uploadImages(data) {
  const { store, article, pic, stock_day, images } = data;
  if (!Array.isArray(images) || images.length === 0) return { imageUrls: [] };

  const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const dateFolder = getOrCreateFolder(rootFolder, toMmdd(stock_day));
  const picStoreFolder = getOrCreateFolder(dateFolder, (pic || 'nopic') + '_' + store);

  const imageUrls = [];
  images.slice(0, 5).forEach(function(img, idx) {
    const suffix = images.length > 1 ? '_' + (idx + 1) : '';
    const fileName = store + '_' + String(article) + suffix + '.jpg';
    const url = uploadToDrive(img.base64, img.type || 'image/jpeg', fileName, picStoreFolder);
    if (url) imageUrls.push(url);
  });

  return { imageUrls };
}

function uploadToDrive(base64Data, mimeType, fileName, folder) {
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    mimeType,
    fileName
  );
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/file/d/' + file.getId() + '/view';
}

// ── QLKV functions ────────────────────────────────────────

function qlkvLogin(data) {
  const { username } = data;
  if (!username) return { error: 'Missing username' };

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('qlkv');
  if (!sheet) return { error: 'QLKV sheet not found' };

  const [headers, ...rows] = sheet.getDataRange().getValues();
  const uCol = headers.indexOf('username');
  const nCol = headers.indexOf('name');
  const rCol = headers.indexOf('role');

  const row = rows.find(
    r => String(r[uCol]).trim().toLowerCase() === String(username).trim().toLowerCase()
  );
  if (!row) return { error: 'Không tìm thấy tài khoản' };
  var role = rCol !== -1 ? String(row[rCol]).trim().toLowerCase() : 'qlkv';
  if (!role) role = 'qlkv';
  return { success: true, username: String(row[uCol]).trim(), name: String(row[nCol]).trim(), role: role };
}

// GET ?action=getQlkvStocks&username=xxx
function getQlkvStocks(username) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Xác định role từ sheet qlkv
  var role = 'qlkv';
  var qlkvSheet = ss.getSheetByName('qlkv');
  if (qlkvSheet) {
    var qlkvData = qlkvSheet.getDataRange().getValues();
    var qh = qlkvData[0];
    var quCol = qh.indexOf('username');
    var qrCol = qh.indexOf('role');
    var userRow = qlkvData.slice(1).find(
      function(r) { return String(r[quCol]).trim().toLowerCase() === String(username).trim().toLowerCase(); }
    );
    if (userRow && qrCol !== -1) {
      role = String(userRow[qrCol]).trim().toLowerCase() || 'qlkv';
    }
  }

  // Chọn cột ID trong sheet stores để lọc theo role
  var matchColName = 'QLKV id';
  if (role === 'gdv') matchColName = 'GDV id';
  if (role === 'gdm') matchColName = 'GDM id';
  if (role === 'gdc') matchColName = 'GDC id';

  const storesData = ss.getSheetByName('stores').getDataRange().getValues();
  const sh = storesData[0];
  var matchIdx = sh.indexOf(matchColName);
  if (matchIdx === -1) matchIdx = sh.indexOf('QLKV id');

  const matchedStores = {};
  storesData.slice(1).forEach(r => {
    if (String(r[matchIdx]).trim().toLowerCase() === String(username).trim().toLowerCase()) {
      matchedStores[String(r[sh.indexOf('store')])] = {
        store_name: r[sh.indexOf('store_name')] || '',
        store_lat:  r[sh.indexOf('lat')]         || '',
        store_long: r[sh.indexOf('long')]        || '',
        cht:        r[sh.indexOf('CHT')]         || '',
        sdt_cht:    r[sh.indexOf('SDT CHT')]     || '',
        qlkv:       r[sh.indexOf('QLKV')]        || '',
        qlkv_id:    r[sh.indexOf('QLKV id')]     || '',
        sdt_qlkv:   r[sh.indexOf('SDT QLKV')]   || '',
        gdv:        r[sh.indexOf('GDV')]         || '',
        gdv_id:     r[sh.indexOf('GDV id')]      || '',
        gdm:        r[sh.indexOf('GDM')]         || '',
        gdm_id:     r[sh.indexOf('GDM id')]      || '',
        gdc:        r[sh.indexOf('GDC')]         || '',
        gdc_id:     r[sh.indexOf('GDC id')]      || '',
      };
    }
  });

  const stocksData = ss.getSheetByName('stocks').getDataRange().getValues();
  const h = stocksData[0];
  const col = name => h.indexOf(name);
  const get = (r, name) => { const c = col(name); return c !== -1 ? r[c] : null; };
  var thungCol = col('thùng') !== -1 ? 'thùng' : 'thung';

  const stocks = stocksData.slice(1)
    .filter(r => matchedStores[String(get(r, 'store'))])
    .map(r => {
      const info = matchedStores[String(get(r, 'store'))] || {};
      return {
        store:          String(get(r, 'store')),
        store_name:     info.store_name,
        article:        get(r, 'article'),
        article_name:   get(r, 'article_name'),
        stock_day:      get(r, 'stock_day'),
        stock:          get(r, 'stock'),
        pic:            get(r, 'pic'),
        current_stock:  get(r, 'current_stock'),
        counted_stock:  get(r, 'counted_stock'),
        note:           get(r, 'note'),
        lat:            get(r, 'lat'),
        long:           get(r, 'long'),
        image:          get(r, 'image'),
        time_stamp:     get(r, 'time_stamp'),
        location_check: get(r, 'location_check'),
        thung:          get(r, thungCol),
        risk:           get(r, 'risk'),
        store_lat:      info.store_lat,
        store_long:     info.store_long,
        cht:            info.cht,
        sdt_cht:        info.sdt_cht,
        qlkv:           info.qlkv,
        qlkv_id:        info.qlkv_id,
        sdt_qlkv:       info.sdt_qlkv,
        gdv:            info.gdv,
        gdv_id:         info.gdv_id,
        gdm:            info.gdm,
        gdm_id:         info.gdm_id,
        gdc:            info.gdc,
        gdc_id:         info.gdc_id,
      };
    });

  return { username, role, stocks };
}

// GET ?action=getProgress&pic=dunghd
function getProgress() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const stocksData = ss.getSheetByName('stocks').getDataRange().getValues();
  const h = stocksData[0];
  const col = name => h.indexOf(name);
  const get = (r, name) => { const c = col(name); return c !== -1 ? r[c] : null; };

  const stocks = stocksData.slice(1)
    .filter(r => get(r, 'store'))
    .map(r => ({
      store:         String(get(r, 'store')),
      pic:           String(get(r, 'pic') || ''),
      counted_stock: get(r, 'counted_stock'),
      pic_status:    get(r, 'pic_status') || '',
    }));

  const storesData = ss.getSheetByName('stores').getDataRange().getValues();
  const sh = storesData[0];
  const storeMap = {};
  storesData.slice(1).filter(r => r[sh.indexOf('store')]).forEach(r => {
    storeMap[String(r[sh.indexOf('store')])] = {
      store_name: r[sh.indexOf('store_name')] || '',
      kstt:       r[sh.indexOf('KSTT')]       || '',
      qlkv:       r[sh.indexOf('QLKV')]       || '',
    };
  });

  return { stocks, storeMap };
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
