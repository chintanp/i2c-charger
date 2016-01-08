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
    delayed = require('delayed'),
    temporal = require('temporal'),
    LineByLineReader = require('line-by-line'),
    //i2c1,
    gauge = i2c.openSync(1), 
    charger = i2c.openSync(1),
    gauge_buffer = new Buffer(100000), 
    charger_buffer = new Buffer(100000), 
    vol, rbc, fcc, soc, temp, cur, 
    writeBuffer = new Buffer([0x00, 0x04]),
    charge_controller = require("./charge_controller.js"),
    temp_date = new Date();

/* Hardware Addresses */
var BQ27441_ADDR = 0x55;  
var BQ24261_ADDR = 0x6B;

// Rate at which measurement of battery voltage etc. is to done
var UPDATE_RATE = 10;

// Minimum discharge voltage, at this voltage charging is initiated, in mV
var MIN_DISCHARGE_VOLTAGE = 3600;

var gauge_test = gauge.i2cWriteSync(BQ27441_ADDR, 2, writeBuffer);

if (gauge_test > 0) {
    
    console.log("Writen to the I2C gauge successfully");
    console.log("Now trying to read");
    
    // Emit welcome message on connection
    io.on('connection', function(http_socket) {
        temporal.loop(UPDATE_RATE*1000, function() {
            console.log("Socket connected");
            console.log("Updating data every " + UPDATE_RATE + " secs");
            
            var battery_stats = getBatteryStats();
            
            console.log(battery_stats);
            
            var report_string = getDateTime() + " " + battery_stats.vol + " " + battery_stats.cur + " " + battery_stats.temp + "\n";
            var dayFilename = "./reports/" + getDateTime().match(/\d+\:\d+\:\d+/)[0] + ".txt";
            
            fs.appendFileSync(dayFilename, report_string.toString());
            
            if (battery_stats.vol <= MIN_DISCHARGE_VOLTAGE && battery_stats.cur < 0)
                charge_controller.charge_battery(battery_stats.vol);
                
            http_socket.emit('old_data', {livedata: battery_stats});
        });
    });
}

function getBatteryStats () {
    
    gauge.i2cWriteSync(BQ27441_ADDR, 2, writeBuffer);
    gauge.i2cReadSync(BQ27441_ADDR,100, gauge_buffer);
    
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

    return battery_stats;
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

server.listen(80, function(){
    console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
