var vol, rbc, fcc, soc, temp, cur;
var Wire, Gauge, gauge, address, buffer;

Wire = require('i2c');


Gauge = (function() {
  function Gauge(address) {
    this.address = address;
    this.wire = new Wire(this.address, {device: '/dev/i2c-1', debug: false});
    
    this.wire.on('data', function(data) {
      return console.log(data);
    });
  }

  Gauge.prototype.testConnection = function(callback) {
    return this.getDeviceID(function(err, data) {
      return data[0] === 0x2;
    });
  };

  Gauge.prototype.getDeviceID = function(callback) {
    return this.wire.read(0x00, 1, callback);
  };
  /*Accelerometer.prototype.testConnection = function(callback) {
    return this.getDeviceID(function(err, data) {
      return data[0] === 0x2;
    });
  };*/

 /* Accelerometer.prototype.getDeviceID = function(callback) {
    return this.wire.read(GET_ID, 1, callback);
  };*/

 

  Gauge.prototype.getStatus = function() {
    this.wire.write([0x00, 0x04], function(err) {
      if (err) console.log("Error while writing data : " + err);
      else
        console.log("Successfully written data to i2c device");
    });
    return setTimeout((function(_this) {
      return function() {
        return _this.wire.read(100, function(err, buffer) {
            if (err) console.log("Error happened during read : " + err);
            else {
                var battery_stats;
                battery_stats = {
                    vol : buffer[4]*16*16 + buffer[3],
                    rbc : buffer[12]*16*16 + buffer[11],
                    fcc : buffer[14]*16*16 + buffer[13],
                    temp : (buffer[2]*16*16 + buffer[1])/10.0 - 273.0,
                    cur : buffer[16]*16*16 + buffer[15]
                };
                return console.log(battery_stats);
            }                
                
            
            /*var pos;
            pos = {
                x: (buffer[1] << 8) | buffer[0],
                y: (buffer[3] << 8) | buffer[2],
                z: (buffer[5] << 8) | buffer[4]
            };
            return console.log(pos);*/
        });
      };
    })(this), 100);
  };

  /*Accelerometer.prototype.getMotion = function() {
    return this.wire.stream(0x02, 6, 100);
  };*/

  return Gauge;

})();

console.log("Execution begins");

gauge = new Gauge(85);

gauge.getStatus();

