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

    return respond({ error: 'Unknown action' });
  } catch (err) {
    return respond({ error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'confirm')        return respond(confirmStock(data));
    if (data.action === 'picLogin')       return respond(picLogin(data));
    if (data.action === 'savePicComment') return respond(savePicComment(data));
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
      note:          get(r, 'note')
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

  // Upload tất cả ảnh lên Drive
  const imageUrls = [];
  if (imageList.length > 0) {
    const root       = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const dateFolder = getOrCreateFolder(root, toMmdd(stockDay));
    const picFolder  = getOrCreateFolder(dateFolder, `${pic || 'nopic'}_${store}`);

    const baseName = [
      store,
      String(articleName).replace(/\s+/g, '-'),
      systemStock,
      counted_stock
    ].join('_');

    imageList.forEach(function(img, idx) {
      const mimeType = img.type || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      const suffix = imageList.length > 1 ? '_' + (idx + 1) : '';
      const blob = Utilities.newBlob(
        Utilities.base64Decode(img.base64),
        mimeType,
        baseName + suffix + '.' + ext
      );
      const file = picFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      imageUrls.push(file.getUrl());
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
      pic_status:    get(r, 'pic_status')
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
    };
  });

  stocks.forEach(s => {
    const info = storeMap[String(s.store)] || {};
    s.store_name = info.store_name || '';
    s.store_lat  = info.store_lat  || '';
    s.store_long = info.store_long || '';
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

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
