/**
 * This code takes care of programming the charger BQ24261
 * based on the requirement from the caller script.
 */ 

var exports = module.exports = {};

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
    writeBuffer = new Buffer([0x00, 0x04]);
    

/* Hardware Addresses */
var BQ27441_ADDR = 0x55;  
var BQ24261_ADDR = 0x6B;

// Rate at which measurement of battery voltage etc. is to done
var UPDATE_RATE = 10;

// Minimum discharge voltage, at this voltage charging is initiated, in mV
var MIN_DISCHARGE_VOLTAGE = 3300;

// File location to read charging profile from 
var CHARGE_PROFILE = "testdata.txt";

exports.charge_battery = function(initial_voltage) {
    console.log("Initiating charging at: " + initial_voltage);
    
    var lr = new LineByLineReader(CHARGE_PROFILE);
    
    var data0 = new Buffer([0x00, 148]);
    var data1 = new Buffer([0x01, 112]);
    var data2 = new Buffer([0x02, 4]);
    var data3 = new Buffer([0x03, 70]);
    var data4 = new Buffer([0x04, 42]);
    var data5 = new Buffer([0x05, 0]);
    var data6 = new Buffer([0x06, 112]);
   
    lr.on('error', function (err) {
        // 'err' contains error object
        if(err)
            console.log("Error opening input file : " + err);
    });
    
    lr.on('line', function (line) {
        
        lr.pause();
        
        // 'line' contains the current line without the trailing newline character.
        console.log("Line read : " + line);
        
        // Each line is an ordered-pair of time,current,voltage
        // Only one of current or voltage, will be non-zero.
        try {
            var lineParts = line.toString().split(",");
            var time = parseFloat(lineParts[0]);
            var current = parseFloat(lineParts[1]);
            var voltage = parseFloat(lineParts[2]);
        } catch (err) {
            console.log("Error parsing line of the file: " + err);
            throw err;
        }
        
        
        if (current == 0) {
            console.log("Trying to set voltage to : " + voltage + " V for a time of : " + time);
            
             /* Logic for converting voltage to code as needed by the charger */
    
        	// Get voltage over 3.5V, in milivolts
        	var delV = voltage * 1000 - 3500;
        	
        	// Regularize bad voltages, no voltage allowed under 3.5 V and over 4.44 V
        	if (delV < 0) {
        		
        		delV = 0;
        	}
        	else if (delV > 900) {
        		
        		delV = 900;
        	}
        	
        	// Our resolution is 20 mV
        	var vBatCode = delV / 20;
        	// as the first two bits are zero, pg - 33  of datasheet
        	var vBatRegValue = vBatCode * 4;	
        	
        	// The zero problem, the voltage starts with 3.6, even trying to set it to 3.5, so rather, starting with 3.52
        	if(vBatRegValue < 4) {
        		
        		data2[1] = 4; //vBatRegValue;
        	}
        	else {
        	    
        		data2[1] = vBatRegValue;
        	}
            
            var timeDelay = time;
            
            setValues (data0, data1, data2, data3, data4, data5, data6);
            
            delayed.delay( function() {
                
                lr.resume();
            
            }, timeDelay*1000);
            
            while (timeDelay > 0.0) {
                
                if (timeDelay > 10.0) {
        
                    delayed.delay( function() {
                        
                        setValues (data0, data1, data2, data3, data4, data5, data6);
                        console.log("TimeDelay :" + timeDelay);
        
                    }, timeDelay*1000);
        
                    timeDelay = timeDelay - 10.0;
        
                }
                
                else if (timeDelay <= 10) {
                
                    delayed.delay( function() { 
        
                    }, timeDelay*1000);
        
                    timeDelay = 0.0;
        
                }
            }
        } else if (voltage == 0) {
            console.log("Trying to set current to : " + current + " mA for a time of : " + time);
            
             /* Logic for converting current to code as needed by the charger */
    
        	// Get current over 500 mA
        	var delI = current - 500;
        	
        	// Regularize bad currents, no current allowed under 500 mA and over 3000 mA
        	if (delI < 0) {
        	
        		delI = 0;
        	} else if (delI > 2500) {
        		
        		delI = 2500;
        	}
        	
        	// Our resolution is 100 mA
        	var iBatCode = delI / 100;
        	// as the first three bits are 010, pg - 33  of datasheet
        	var iBatRegValue = iBatCode * 8 + 2;	
        	
        	data4[1] = iBatRegValue;
        	data2[1] = 140;  // 4.2 V
        	
        	/*// The zero problem, the voltage starts with 3.6, even trying to set it to 3.5, so rather, starting with 3.52
        	if(vBatRegValue < 4) {
        		
        		data2[1] = 4; //vBatRegValue;
        	}
        	else {
        	    
        		data2[1] = vBatRegValue;
        	}*/
        	
            
            var timeDelay = time;
            
            setValues (data0, data1, data2, data3, data4, data5, data6);
            
            delayed.delay( function() {
                
                lr.resume();
            
            }, timeDelay*1000);
            
            while (timeDelay > 0.0) {
                
                if (timeDelay > 10.0) {
        
                    delayed.delay( function() {
                        
                        setValues (data0, data1, data2, data3, data4, data5, data6);
                        console.log("TimeDelay :" + timeDelay);
        
                    }, timeDelay*1000);
        
                    timeDelay = timeDelay - 10.0;
        
                }
                
                else if (timeDelay <= 10) {
                
                    delayed.delay( function() { 
        
                    }, timeDelay*1000);
        
                    timeDelay = 0.0;
        
                }
            }
        } else {
            console.log("Something wrong with the input, either one of voltage or current should be zero.");
        }
    });
    
    lr.on('end', function () {
        
        // All lines are read, file is closed now.
        console.log("End of input file");
        console.log("*****Charging done !!!****");
    
    });
}

/**
 * Sets the values of the corresponding registers in the charger
 * 
 * @param {Buffer} data0 Status/Control Register (R/W)
 * @param {Buffer} data1 Control Register (R/W)
 * @param {Buffer} data2 Control/Battery Voltage Register (R/W)
 * @param {Buffer} data3 Vendor/Part/Revision Register (Read only)
 * @param {Buffer} data4 Battery Termination/Fast Charger Current Register (R/W)
 * @param {Buffer} data5 VINDPM Voltage/MINSYS Status Register
 * @param {Buffer} data6 Safety Timer/ NTC Monitor Register (R/W)
 */
function setValues (data0, data1, data2, data3, data4, data5, data6) {
    
    console.log("Setting values at "  + getDateTime());
    charger.i2cWrite(BQ24261_ADDR, 2, data0, function(err) { if(err) console.log("error in writing data0[0]"); });
    charger.i2cWrite(BQ24261_ADDR, 2, data1, function(err) { if(err) console.log("error in writing data1[0]"); });
    charger.i2cWrite(BQ24261_ADDR, 2, data2, function(err) { if(err) console.log("error in writing data2[0]"); });
    charger.i2cWrite(BQ24261_ADDR, 2, data3, function(err) { if(err) console.log("error in writing data3[0]"); });   
    charger.i2cWrite(BQ24261_ADDR, 2, data4, function(err) { if(err) console.log("error in writing data4[0]"); });
    charger.i2cWrite(BQ24261_ADDR, 2, data5, function(err) { if(err) console.log("error in writing data5[0]"); });
    charger.i2cWrite(BQ24261_ADDR, 2, data6, function(err) { if(err) console.log("error in writing data6[0]"); });
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