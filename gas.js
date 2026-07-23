/**
 * NMS 終端機 - 多工作表後端 Web API
 */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) { sheet = ss.insertSheet(sheetName); }
  return sheet;
}

function doGet(e) {
  const sheetName = (e && e.parameter && e.parameter.sheet) ? e.parameter.sheet : 'trading';
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return createJsonResponse([]);

  const headers = data.shift();
  const result = data.map(row => {
    let obj = {};
    headers.forEach((header, index) => obj[header] = row[index]);
    return obj;
  });

  return createJsonResponse(result);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const sheetName = payload.sheet || 'trading';
    const item = payload.data;
    const sheet = getSheet(sheetName);

    // 自動建置第一列 Header
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(Object.keys(item));
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // 支援 Update 邏輯 (如果有傳入已存在的 id)
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == item.id) { rowIndex = i + 1; break; }
    }

    const rowData = headers.map(h => item[h] !== undefined ? item[h] : "");

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return createJsonResponse({ status: "success" });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}