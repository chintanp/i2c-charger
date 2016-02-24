/**
 * Main controller for the gauge - BQ 27441 and the charger - BQ 24261
 */ 


var express = require('express'),
    routes = require('./routes'),
    socket = require('./routes/socket.js'),
    util = require('util'),
    http = require('http'),
    fs = require('fs'),
    net = require('net'),             // For TCP communication with datalogger
    url = require('url'),
    events = require('events'),
    path = require('path');         //For manipulating file-paths
    //request = require('request');

var app = module.exports = express();
var server = require('http').createServer(app);

// Hook Socket.io into Express
var io = require('socket.io').listen(server);

// Configuration
app.configure(function() {
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.static(__dirname + '/public'));
    app.use(app.router);
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
    app.use(express.errorHandler());
});

// Routes
app.get('/', routes.index);
app.get('/partials/:name', routes.partials);

// redirect all others to the index (HTML5 history)
app.get('*', routes.index);



var i2c = require('i2c-bus'),
    readline = require("readline"),
    google = require("googleapis"),
    googleAuth = require("google-auth-library"),
    delayed = require('delayed'),
    temporal = require('temporal'),
    LineByLineReader = require('line-by-line'),
    assert = require("assert"),
    gauge = i2c.openSync(1), 
    charger = i2c.openSync(1),
    gauge_buffer = new Buffer(100000), 
    charger_buffer = new Buffer(100000), 
    vol, rbc, fcc, soc, temp, cur, 
    writeBuffer = new Buffer([0x00, 0x04]),
    charge_controller = require("./charge_controller.js"),
    temp_date = new Date();
    
//var auth = new googleAuth();
var OAuth2 = google.auth.OAuth2;
var CLIENT_SECRET_FILEPATH = 'client_secret.json';
var fileContents = fs.readFileSync(CLIENT_SECRET_FILEPATH);
var credentials = JSON.parse(fileContents);
var CLIENT_SECRET = credentials.installed.client_secret;
var CLIENT_ID = credentials.installed.client_id;
var REDIRECT_URL = credentials.installed.redirect_uris[0];

var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
google.options({ auth: oauth2Client });

var SCOPES = ['https://www.googleapis.com/auth/drive', 
			  'https://www.googleapis.com/auth/userinfo.email', 
			  'https://www.googleapis.com/auth/documents', 
		      'https://mail.google.com/'];

var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || 
		process.env.USERPROFILE) + '/credentials/';
var TOKEN_PATH = TOKEN_DIR + 'nodejs-googledocs.json';

var BATTERY_STATS;

/**
 * Get and store new token after prompting for user authorization, and then 
 * execute the given callback with the authorized OAuth2 client. 
 * 
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *	client.
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
			callback(oauth2Client, "");
		});
	});
}

/**
 * Store token to disk to be used in later program executions
 * 
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
	try {
		fs.mkdirSync(TOKEN_DIR);
	} catch(err) {
		if(err.code != 'EEXIST') {
			throw err;
		}
	}
	fs.writeFile(TOKEN_PATH, JSON.stringify(token));
	console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Call an Apps Script function to list the folders in the user's root
 * Drive foler.
 * 
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {String} text Text passed to be written to the file.
 */
function callAppsScript(auth, text) {
    
	var scriptId = 'MOD_u6xqlttEheN8kg1A97ZX-Fj_WW1Ds';
	var script = google.script('v1');
	
	// Make the API request. The request object is included here as 'resource'.
	script.scripts.run({
		auth: auth, 
		resource: {
			function: 'createAndSendDocument', 
			parameters: text
		}, 
		scriptId: scriptId 
	}, function(err, resp) {
		
		if(err) {
			// THe API encountered a problem before the script started executing.
			console.log('The API returned an error: ' + err);
			return;
		}
		
		if(resp.error) {
			// The API executed, but the script returned an error. 
			
			// Extract the first (and only) set of error details. The values of this 
			// object are the script's errorMessage and 'errorType', and an array
			// of stack trace elements.
			var error = resp.error.details[0];
			console.log('Script error message: ' + error.errorMessage);
			console.log('Script error stacktrace: ');
			
			if(error.scriptStackTraceElements) {
				// There may not be a stacktrace if the script didn't start executing.
				for(var i = 0; i < error.scriptStackTraceElements.length; i++) {
					var trace = error.scriptStackTraceElements[i];
					console.log('\t%s: %s', trace.function, trace.lineNumber);
				}
			}
		} else {
		    console.log("Data successfully written to Google Drive");
		}
	});
}

try {
    getNewToken(oauth2Client, callAppsScript);
} catch (err) {
    console.log("Some error occured while trying to getNewToken: " + err);
    throw err;
}


/* Hardware Addresses */
var BQ27441_ADDR = 0x55;    // Gauge
var BQ24261_ADDR = 0x6B;    // Charger

// Rate at which measurement of battery voltage etc. is to done
var UPDATE_RATE = 10;

// Minimum discharge voltage, at this voltage charging is initiated, in mV
var MIN_DISCHARGE_VOLTAGE = 3290;

try {
    var gauge_test = gauge.i2cWriteSync(BQ27441_ADDR, 2, writeBuffer);    
} catch (err) {
    console.log("Error in writing to gauge at initiation: " + err);
    throw err;
}


if (gauge_test > 0) {
    
    console.log("Writen to the I2C gauge successfully");
    console.log("Now trying to read");
    
    // TODO: Error handling for socket.io
    io.on('connection', function(http_socket) {
        console.log("Socket connected");
        // Emits battery stats every UPDATE_RATE seconds
        setInterval(function() {
            http_socket.emit('old_data', {livedata: BATTERY_STATS}); 
        }, UPDATE_RATE*1000);
        
    });
    
    // This looks for battery stats and decides when to activate charger
    temporal.loop(UPDATE_RATE*1000, function() {
        console.log("Updating data every " + UPDATE_RATE + " secs");
        
        BATTERY_STATS = getBatteryStats();
         
        // Charger activating here
        if (BATTERY_STATS.vol <= MIN_DISCHARGE_VOLTAGE && BATTERY_STATS.cur < 0)
            charge_controller.charge_battery(BATTERY_STATS.vol);
        
        console.log(BATTERY_STATS);
    });
    
}

/**
 * Gets the batteries current stats and writes them to a local file and to
 * Google Drive folder
 * 
 * @param None
 */
function getBatteryStats () {
    
    // Write to gauge to reset the read head to start
    try {
        gauge.i2cWriteSync(BQ27441_ADDR, 2, writeBuffer);
    } catch (err) {
        console.log('Error in trying to write to gauge in getBatteryStats: ' + err);
        throw err;
    }
    
    // Read from gauge the full data
    try {
        gauge.i2cReadSync(BQ27441_ADDR, 100, gauge_buffer);
    } catch (err) {
        console.log('Error in trying to read from gauge in getBatteryStats: ' + err);
        throw err;
    }
    
    assert.equal(typeof(gauge_buffer[0]), 'number', 
                    "The values returned from the gauge seem to be not a number");
                    
    // Parse the read data to get the desired values - voltage, current etc.
    var battery_stats = {
        vol : gauge_buffer[4]*16*16 + gauge_buffer[3],
        rbc : gauge_buffer[12]*16*16 + gauge_buffer[11],
        fcc : gauge_buffer[14]*16*16 + gauge_buffer[13],
        soc : gauge_buffer[28]*16*16 + gauge_buffer[27],
        temp : (gauge_buffer[2]*16*16 + gauge_buffer[1])/10.0 - 273.0,
        cur : gauge_buffer[16]*16*16 + gauge_buffer[15]
    }
    if (battery_stats.cur >= 32267) 
        battery_stats.cur = battery_stats.cur - 65536;          // two's complement as signed integer
    
    try {
        var report_string = getDateTime() + " " + battery_stats.vol + 
                        " " + battery_stats.cur + " " + battery_stats.temp + 
                        "\n";
    } catch (err) {
        console.log("Error while trying to form report_string: " + err);
        throw err;
    }
    
    try {
        var dayFilename = "./reports/" + getDateTime().match(/\d+\:\d+\:\d+/)[0] + 
                        ".txt";
    } catch (err) {
        console.log("Error while trying to form dayFilename: " + err);
        throw err;
    }                   
    
    try {
        fs.appendFileSync(dayFilename, report_string.toString());
    } catch (err) {
        console.log("Error while trying to write BATTERY_STATS to local file :" +
                    err);
        throw err;
    }
    
    try {
        callAppsScript(oauth2Client, report_string);
    } catch (err) {
        console.log("Error while trying to write to google drive: " + err);
    }
    
    return battery_stats;
}

/**
 * Gets the current system time in the format:
 * yyyy:mm:dd:hh:mm:ss
 * 
 * @param None
 */
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

server.listen(80, function(){
    console.log("Express server listening on port %d in %s mode", 
                this.address().port, app.settings.env);
});
