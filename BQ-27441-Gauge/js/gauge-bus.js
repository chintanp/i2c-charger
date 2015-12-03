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
    gauge = i2c.openSync(1), 
    buffer = new Buffer(100000), vol, rbc, fcc, soc, temp, cur, 
    writeBuffer = new Buffer([0x00, 0x04]);

var BQ27441_ADDR = 0x55;  
var UPDATE_RATE = 2;

var written1 = gauge.i2cWriteSync(BQ27441_ADDR, 2, writeBuffer);
//var written2= gauge.i2cWriteSync(BQ27441_ADDR, 1, 0x04);

if (written1 > 0) {
    
    console.log("Writen to the I2C device successfully");
    console.log("Now trying to read");
    
    // Emit welcome message on connection
    io.on('connection', function(http_socket) {
        temporal.loop(UPDATE_RATE*1000, function() {
            console.log("Socket connected");
            console.log("Updating data every " + UPDATE_RATE + " secs");
            
            gauge.i2cWriteSync(BQ27441_ADDR, 2, writeBuffer);
            gauge.i2cReadSync(BQ27441_ADDR,100, buffer);
            
            var battery_stats = {
                vol : buffer[4]*16*16 + buffer[3],
                rbc : buffer[12]*16*16 + buffer[11],
                fcc : buffer[14]*16*16 + buffer[13],
                soc : buffer[28]*16*16 + buffer[27],
                temp : (buffer[2]*16*16 + buffer[1])/10.0 - 273.0,
                cur : buffer[16]*16*16 + buffer[15]
            }
            if (battery_stats.cur >= 32267) 
                battery_stats.cur = battery_stats.cur - 65536;          // two's complement as signed integer
            
            console.log(battery_stats);
            
            http_socket.emit('old_data', {livedata: battery_stats});
        });
    });
}

server.listen(5002, function(){
    console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
gauge.closeSync();