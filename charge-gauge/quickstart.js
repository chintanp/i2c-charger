var fs = require("fs");
var readline = require("readline");
var google = require("googleapis");
var googleAuth = require("google-auth-library");


var SCOPES = ['https://www.googleapis.com/auth/drive'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || 
                process.env.USERPROFILE) + '/.credentials';
var TOKEN_PATH = TOKEN_DIR + 'drive-nodejs-writeToFile2.json';

// Load client secrets from a local file
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if(err) {
        console.log('Error loading client secret file: ' + err);
        return;
    }
    // Authorize a client with the loaded credentials, then call the 
    // Drive API
    authorize(JSON.parse(content), writeToFile);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the 
 * given callback function. 
 * 
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback with the authorized client.
 */
function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
     
    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
        if(err) {
            getNewToken(oauth2Client, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * 
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *      client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', 
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if(err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions. 
 * 
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if(err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the names and IDs of up to 10 files.
 * 
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client. 
 */
function listFiles(auth) {
    var service = google.drive('v3');
    service.files.list({
        auth: auth,
        pageSize: 10, 
        fields: "nextPageToken, files(id, name)"
    }, function(err, response) {
        if(err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var files = response.files;
        if(files.length == 0) {
            console.log("No files found. ");
        } else {
            console.log('Files: ');
            for(var i = 0; i < files.length; i++) {
                var file = files[i];
                console.log('%s (%s)', file.name, file.id);
            }
        }
    });
}

/** 
 * Inserts a file to google drive
 * 
 */
function insertFile(auth) {
    var drive = google.drive('v3');
    
    var fileMetadata = {
        'name' : 'My Report',
        'mimeType' : 'text/plain'
    };
    
    var media = {
        mimeType: 'text/plain',
        body: 'Hello World from NodeJS'
    };
    
    drive.files.create({
        resource: fileMetadata, 
        media: media, 
        fields: 'id', 
        auth: auth
    }, function(err, file) {
        if(err) {
            console.log('The API returned an error: ' + err);
            return;
        } else {
            console.log('New file created with file id: ' + file.id);
        }
    });
    
}

function writeToFile(auth) {
    var drive = google.drive('v2');
    
    var dayFilename = getDateTime().match(/\d+\:\d+\:\d+/)[0] + ".txt";
    var dayFileId = "1arxT9AvKBB7FfrzxILHHjFI5e0a7Y07hw_xZh-6UZv4";
    
    var fileMetadata = {
        'name' : dayFilename,
        'mimeType' : 'text/plain'
    };
    
    var media = {
        mimeType: 'text/plain',
        body: 'Hello World from NodeJS and some'
    };
    
    if (dayFileId == " ") {
        console.log("Trying to create new file");
        drive.files.create({
            resource: fileMetadata, 
            media: media, 
            fields: 'id',
            auth: auth
        }, function(err, file) {
            if(err) {
                console.log('The API returned an error: ' + err);
                return;
            } else {
                console.log('New file created with file id: ' + file.id);
                dayFileId = file.id;
            }
        });
    } else {
        console.log("File already exists, trying to update");
        
        var file = drive.files.get({
            fileId: dayFileId, 
            "alt": "media"
        });
        
        console.log("file is of type: " + typeof(file));
        
        media = {
            mimeType: 'text/plain',
            body: file.media.body + "someMoretext"
        };
        
        drive.files.update({
            fileId: dayFileId,
            resource: fileMetadata, 
            media: media, 
            fields: 'id',
            auth: auth
        }, function(err, file) {
            if(err) {
                console.log('The API returned an error: ' + err);
                return;
            } else {
                console.log('File Updated ' + file.id);
                dayFileId = file.id;
            }
        });
        
        
    }
    
    
}

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

