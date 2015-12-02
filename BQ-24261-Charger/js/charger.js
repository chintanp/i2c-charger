// This is the js file to interact with the charger

var i2c = require('i2c');
var LineByLineReader = require('line-by-line');
var delayed = require('delayed');

var address = 0x6B;  
var inputFile = "testdata.txt";

var lr = new LineByLineReader(inputFile);

var device1 = new i2c(address, {device: '/dev/i2c-1', debug: false});

var data0 = [];
var data1 = [];
var data2 = [];
var data3 = [];
var data4 = [];
var data5 = [];
var data6 = [];

data0[0] = 0;
data0[1] = 148; // 16; //144;   // make the voltage permanent
data1[0] = 1;
data1[1] = 64;
data2[0] = 2;
data2[1] = 4;
data3[0] = 3;
data3[1] = 70;
data4[0] = 4;
data4[1] = 42;
data5[0] = 5;
data5[1] = 0;
data6[0] = 6;
data6[1] = 112;

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
    var lineParts = line.toString().split(",");
    var time = parseFloat(lineParts[0]);
    var current = parseFloat(lineParts[1]);
    var voltage = parseFloat(lineParts[2]);
    
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
    	
    	data2[1] = iBatRegValue;
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
        console.log("Something wrong with the input, eiher one of voltage or current should be zero.");
    }
});

lr.on('end', function () {
    
    // All lines are read, file is closed now.
    console.log("End of input file");
    console.log("*****Charging done !!!****");

});

function setValues (data0, data1, data2, data3, data4, data5, data6) {
    
    console.log("Setting values at "  + getDateTime());
    
    device1.write(data0, function(err) { if(err) console.log("error in writing data0[0]"); });
    device1.write(data1, function(err) { if(err) console.log("error in writing data1[0]"); });
    device1.write(data2, function(err) { if(err) console.log("error in writing data2[0]"); });
    device1.write(data3, function(err) { if(err) console.log("error in writing data3[0]"); });   
    device1.write(data4, function(err) { if(err) console.log("error in writing data4[0]"); });
    device1.write(data5, function(err) { if(err) console.log("error in writing data5[0]"); });
    device1.write(data6, function(err) { if(err) console.log("error in writing data6[0]"); });
    
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


