// This is the js file to interact with the charger

var i2c = require('i2c');

var device1 = new i2c(0x6B, {device: '/dev/i2c-1', debug: false});
var data0 = [];
var data1 = [];
var data2 = [];
var data3 = [];
var data4 = [];
var data5 = [];
var data6 = [];

data0[0] = 0x00;
data0[1] = 0x94; // 16; //144;   // make the voltage permanent
data1[0] = 1;
data1[1] = 64;
data2[0] = 2;
data2[1] = 136;
data3[0] = 3;
data3[1] = 70;
data4[0] = 4;
data4[1] = 42;
data5[0] = 5;
data5[1] = 0;
data6[0] = 6;
data6[1] = 112;

//device1.setAddress(0x6B);

device1.write(data0, function(err) { console.log("error in writing data0[0]"); console.log(err); });
//device1.write(data0[1], function(err) { console.log("error in writing data0[1]"); console.log(err); });
device1.write(data1, function(err) { console.log("error in writing data1[0]"); console.log(err); });
//device1.write(data1[1], function(err) { console.log("error in writing data1[1]"); console.log(err); });
device1.write(data2, function(err) { console.log("error in writing data2[0]"); console.log(err); });
//device1.write(data2[1], function(err) { console.log("error in writing data2[1]"); console.log(err); });
device1.write(data3, function(err) { console.log("error in writing data3[0]"); console.log(err); });
//device1.write(data3[1], function(err) { console.log("error in writing data3[1]"); console.log(err); });
device1.write(data4, function(err) { console.log("error in writing data4[0]"); console.log(err); });
//device1.write(data4[1], function(err) { console.log("error in writing data4[1]"); console.log(err); });
device1.write(data5, function(err) { console.log("error in writing data5[0]"); console.log(err); });
//device1.write(data5[1], function(err) { console.log("error in writing data5[1]"); console.log(err); });
device1.write(data6, function(err) { console.log("error in writing data6[0]"); console.log(err); });
//device1.write(data6[1], function(err) { console.log("error in writing data6[1]"); console.log(err); });
