/**
* This function reads some data, and writes it to a file. It creates a file
* if the file doesnt exist, otherwise it appends to the existing file.
*
* @param {String} someText Text you want to be written to the file.
*/
function createAndSendDocument(someText) {
  
  // This is the name of the file. Based on the name of the day, 
  // and so changes each new day.
  var dayFilename = getDateTime().match(/\d+\:\d+\:\d+/)[0] + ".txt";
  Logger.log(someText);
  
  // Getting the handle for folder named 'reports'
  var folder = DriveApp.getFoldersByName('reports').next();
  // Getting the handle for file by name 'dayFilename'
  var currentFile = DriveApp.getFilesByName(dayFilename);
  
  // Check if file with this name exists
  if (currentFile.hasNext()) {
    Logger.log('File already exists, trying to append to file ');
    // Get the handle of the specific file
    var hFile = currentFile.next();
    // Get the ID of the file
    var fileId = hFile.getId();
    // Use DocumentApp class to open the file using its ID
    var doc = DocumentApp.openById(fileId);
    var body = doc.getBody();
    var text = body.editAsText();
    // Append text 
    text.appendText(someText);
  } else {
    // Handles the case when there is no file by this name
    Logger.log('File not found, creating a new file');
    // Create a new DocumentApp object
    var newDoc = DocumentApp.create(dayFilename);
    // Get its ID
    var docId = newDoc.getId();
    // Get the same file, but through DriveApp object
    var driveFile = DriveApp.getFileById(docId);
    // Create a copy in the folder we want it to be, i.e 'reports' in our case
    var newCopy = driveFile.makeCopy(dayFilename, folder);
    // Get the ID of the new copy
    var newId = newCopy.getId();
    // Get the DocumentApp handle of the new copy
    var latestDoc = DocumentApp.openById(newId);
    var body = latestDoc.getBody();
    var text = body.editAsText();
    // Insert text into the new file
    text.insertText(0, someText);
    // Delete the original copy of the file, this was empty anyway
    driveFile.setTrashed(true);
    
  }
}

// Gets the date and time now
function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + ":" + hour + ":" + min + ":" + sec;

}
