function doPost(e) {
  try {
    // 解析前端傳過來的 JSON 數據
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var data = contents.data;

    // 檢查 action 是否為 save_all
    if (action === 'save_all') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      
      // 1. 清空舊資料
      sheet.clear(); 
      
      // 2. 將整個 JSON 寫入 A1 儲存格 (或轉成字串儲存)
      sheet.getRange("A1").setValue(JSON.stringify(data));

      // 回傳成功訊息
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Data saved successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // 如果 action 不對，會報 Invalid action
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Invalid action: ' + action
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var val = sheet.getRange("A1").getValue();
    
    var data = val ? JSON.parse(val) : {};
    
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}