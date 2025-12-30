function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Your spreadsheet ID
    const spreadsheetId = '10NFx7N-EWefbDnAvzV8VUtqeNzHJD4xAqtLZ5mICKMY';
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    
    // Get the specific sheet by GID (1916472976)
    const sheet = spreadsheet.getSheets().find(s => s.getSheetId() === 1916472976) || spreadsheet.getSheetByName('Sheet1');
    
    // Prepare row data with AI fields
    const row = [
      data.timestamp,
      data.userId,
      data.sessionId,
      data.eventType,
      data.currentLanguage,
      data.devicePlatform,
      data.deviceType,
      data.screenSize,
      data.browserLanguage,
      data.referrer,
      data.timeOnPageSeconds || 0,
      data.totalSessionSeconds || 0,
      
      // Event specific fields
      data.socialPlatform || '',
      data.buttonText || '',
      data.searchTerm || '',
      data.resultsFound || '',
      data.projectTitle || '',
      data.projectIndex || '',
      data.contactType || '',
      data.scrollDepth || '',
      data.filename || '',
      
      // AI CHAT FIELDS - NEW
      data.aiQuestion || '',
      data.aiAnswer || '',
      data.aiResponseTime || ''
    ];
    
    // Add headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 24).setValues([[
        'Timestamp (UTC+5)', 'User ID', 'Session ID', 'Event Type', 'Language',
        'Device Platform', 'Device Type', 'Screen Size', 'Browser Language', 'Referrer',
        'Time on Page (s)', 'Total Session (s)', 'Social Platform', 'Button Text', 'Search Term',
        'Results Found', 'Project Title', 'Project Index', 'Contact Type', 'Scroll Depth', 'Filename',
        'AI Question', 'AI Answer', 'AI Response Time (ms)'
      ]]);
      
      // Format headers
      sheet.getRange(1, 1, 1, 24).setFontWeight('bold').setBackground('#4285F4').setFontColor('white');
    }
    
    // Add the data row
    sheet.appendRow(row);
    
    return ContentService.createTextOutput('Success');
  } catch (error) {
    console.log('Error:', error);
    return ContentService.createTextOutput('Error: ' + error.toString());
  }
}

