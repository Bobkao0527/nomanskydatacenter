const SHEET_NAME = 'Sheet1';

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return createJsonResponse([]);

  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return createJsonResponse([]);

  const values = sheet.getRange(1, 1, lastRow, 1).getValues();
  const treeData = [];

  values.forEach((row) => {
    if (!row[0]) return;
    try {
      treeData.push(JSON.parse(row[0]));
    } catch (err) {}
  });

  return createJsonResponse(treeData);
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const body = JSON.parse(e.postData.contents);

    if (body.action === 'save_all' && Array.isArray(body.data)) {
      sheet.clearContents();
      const rows = body.data.map(item => [JSON.stringify(item)]);
      if (rows.length > 0) {
        sheet.getRange(1, 1, rows.length, 1).setValues(rows);
      }
      return createJsonResponse({ status: 'success' });
    }
    return createJsonResponse({ status: 'error', message: 'Invalid action' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}