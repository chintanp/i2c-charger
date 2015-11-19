// This is the js file to interact with the charger

var i2c = require('i2c');
var LineByLineReader = require('line-by-line');
var delayed = require('delayed');

var BQ27441_ADDR = 0x55;  

var gauge = new i2c(BQ27441_ADDR, {device: '/dev/i2c-1', debug: false});

var rbc = 0.0;
var fcc = 0.0;
var soc = 0.0;
var temp = 0.0;
var vol = 0;


gauge.write([0x00, 0x04], function(err) {
    
    if(err) {
        console.log("Error writing values : " + err);
    }
    else
        console.log("Successfully written to I2C");
    
});

gauge.read(100, function(err, res) {
    
    if(err) {
        console.log("Error reading values : " + err);
    }
    else {
        
        vol = res[4]*16*16 + res[3];
        rbc = res[12]*16*16 + res[11];
        fcc = res[14]*16*16 + res[13];
        soc = (rbc/fcc)*100;
        temp = (res[2]*16*16 + res[1])/10.0 - 273.0;
        
        console.log("Voltage : " + vol + " mV");
        console.log("Remaining Battery Capacity : " + rbc + " mAh");
        console.log("Full Charge Capacity : " + fcc + " mAh");
        console.log("SOC : " + soc + " %");
        console.log("Ambient Temperature : " + temp + " deg C");
        
    }
        
})


