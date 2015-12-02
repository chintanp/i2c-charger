// This is the js file to interact with the charger

var i2c = require('i2c');
var LineByLineReader = require('line-by-line');
var delayed = require('delayed');
var async = require('async');

var BQ27441_ADDR = 0x55;  

var gauge = new i2c(BQ27441_ADDR, {device: '/dev/i2c-1', debug: false});

var rbc = 0.0;
var fcc = 0.0;
var soc = 0.0;
var temp = 0.0;
var vol = 0;
var cur = 0;


// This function gets user data, matches it against format, stores it in a variable
// taken from http://st-on-it.blogspot.com/2011/05/how-to-read-user-input-with-nodejs.html

function ask(question, format, callback) {
    
    var stdin = process.stdin, 
        stdout = process.stdout;
        
    stdin.resume();
    stdout.write(question + ": ");
    
    stdin.once('data', function(data) {
        
        data = data.toString().trim();
        
        if(format.test(data)) {
            callback(data);
        }
        else {
            stdout.write("It should match: " + format + "\n");
            ask(question, format, callback);
        }
    });
}

function read_all_regs () {
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
            cur = res[16]*16*16 + res[15];
            
            console.log("Voltage : " + vol + " mV");
            console.log("Remaining Battery Capacity : " + rbc + " mAh");
            console.log("Full Charge Capacity : " + fcc + " mAh");
            console.log("SOC : " + soc + " %");
            console.log("Ambient Temperature : " + temp + " deg C");
            console.log("Average Current : " + cur + " mA");
            
        }
    });
}

/* ask("Name", /.+/, function(name) {
    ask("Email", /^.+@.+$/, function(email) {
        console.log("Your name is: ", name);
        console.log("Your email is: ", email);
        
        // Test write to the gauge, to read voltage
        
        gauge.write([0x00, 0x04], function(err) {
    
            if(err) {
                console.log("Error writing values : " + err);
            }
            else
                console.log("Successfully written to I2C");
            
        });
        
      // Unsealing the gauge with an instruction set
        
        // Read the TRM - page 14
       
        gauge.write([0x00, 0x00, 0x80], function(err) {
            
            if(err) {
                console.log("Error in trying to unseal");
            }
            else {
                console.log("Written successfully, may get unsealed.");
            }
        });
        
        gauge.write([0x00, 0x00, 0x80], function(err) {
            
            if(err) {
                console.log("Error in trying to unseal");
            }
            else {
                console.log("Written successfully, must be unsealed.");
            }
        });
       
        // Make the gauge configurable
        
        gauge.write([0x00, 0x13, 0x00], function(err) {
            
            if(err) {
                console.log("Error in trying to make gauge configurable");
            }
            else {
                console.log("Written successfully, gauge now configurable");
            }
        });
        
        // Check if the CGFUPDATE mode bit is set
        
        
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
                cur = res[16]*16*16 + res[15];
                
                console.log("Voltage : " + vol + " mV");
                console.log("Remaining Battery Capacity : " + rbc + " mAh");
                console.log("Full Charge Capacity : " + fcc + " mAh");
                console.log("SOC : " + soc + " %");
                console.log("Ambient Temperature : " + temp + " deg C");
                console.log("Average Current : " + cur + " mA");
                
                process.exit();
                
            }
        });
   });
});
*/

console.log("Begin program");

for(;;) {
    setTimeout(read_all_regs(), 1000);
}
