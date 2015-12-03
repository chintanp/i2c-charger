'use strict';

/* Controllers */

var sensorApp = angular.module('sensorApp', []);

sensorApp.controller('SensorDataCtrl', function($scope, $location, socket) { 
  $scope.sensordata = [];
  $scope.hide_on_data = false;
  //Receive weather data from the http socket
  //localStorage.debug = "*";

  socket.on('old_data', function(data) {

        //alert("Inside Old Data");
        console.log(data);
        console.log("Old data " + data.livedata);
        $scope.sensordata = data.livedata;

        
        if(data.livedata != " ")
        {
        	$scope.hide_on_data = true;
        }

        /*
        //Parsing the weather data to get usable information
        var response = data.livedata;
        var date = JSON.parse(response).date;
        var time = JSON.parse(response).time;
        var temperature = JSON.parse(response).temp_c;
        var humidity = JSON.parse(response).humidity;
        var pressure = JSON.parse(response).pressure_mbar;
        var wind_dir = JSON.parse(response).wind_dir;
        var wind_speed = JSON.parse(response).wind_speed_mps;
        var rain = JSON.parse(response).rain_mm;
        var solar_rad = JSON.parse(response).solar_rad_wpsqm;

        var localObject = [];
        var sensorName = "";
        var sensorValue = "";
        var sensorUnit = "";
        
        //Creating localObject by parsing the received data
		     
	  	localObject.push({"sensor" : "Date", "value": date, "unit" : " " });
		localObject.push({"sensor" : "Time", "value": time, "unit" : " " });	
		localObject.push({"sensor" : "Temperature", "value": temperature, "unit" : " Celsius " });	
		localObject.push({"sensor" : "Humidity", "value": humidity, "unit" : " % " });    
		localObject.push({"sensor" : "Atm_Pressure ", "value": pressure, "unit" : " mbar " });  
		localObject.push({"sensor" : "Wind_Direction", "value": wind_dir, "unit" : " Degrees_N " }); 
		localObject.push({"sensor" : "Wind_Speed", "value": wind_speed, "unit" : " mps " }); 
		localObject.push({"sensor" : "Rain", "value": rain, "unit" : " mm " });
		localObject.push({"sensor" : "Solar_Radiation", "value": solar_rad, "unit" : " w/m2 " });
	
	  	$scope.weatherdata =  localObject;
	  	//debugger;
	  	console.log($scope.weatherdata.length);*/
    });


  /*socket.on('livedata', function(data) {
  		//alert("Inside livedata");
        console.log(data);
        console.log("data.livedata: " + data.livedata);
        
        if(data.livedata != " ")
        {
        	$scope.hide_on_data = true;
        }
        //Parsing the weather data to get usable information

        var dataArray = data.livedata.split("\r\n");
        console.log("DataArray: " + dataArray);

        debugger;
        //JSON.stringify(dataArray);

        // console.log("dataRow: " + dataRow);

        // console.log("tyepeof(dataRow): " + typeof(dataRow));

        var dataRow = dataArray.toString().split(",");
        //console.log("dataRow[0]" + dataRow[0]);
        console.log("Length_dataArray = " + dataArray.toString().length);
        console.log("length_dataRow = " + dataRow.length);

        var localObject = [];
        var sensorName = "";
        var sensorValue = "";
        var sensorUnit = "";
        //console.log("dataArray.length-1" + dataArray.length-1);

	  	for(var i = 0; i < dataRow.length - 1; i++) {

	    //console.log(dataArray[i]);
		    if(dataRow[i].split(" ")[0] != '') {
		      sensorName = dataRow[i].split(" ")[0];
		      sensorValue = dataRow[i].split(" ")[1] ;
		      sensorUnit = dataRow[i].split(" ")[2] ;
		      

		      if(sensorName === "Wind_Speed") {
		      	sensorUnit = "mps";
		      }
		      else if (sensorName === "Rain") {
		      	sensorUnit = "mm";
		      }
			  
			  console.log(sensorName + " : " + sensorValue + " : " + sensorUnit );

		      //Creating localObject by parsing the received data
		      localObject.push({"sensor" : sensorName, "value": sensorValue, "unit" : sensorUnit });
		      }  
	  	}

	  	$scope.weatherdata =  localObject;
	  	//debugger;
	  	console.log($scope.weatherdata.length);
    });
*/
	
});


sensorApp.factory('socket', function($rootScope) {

	//Connect to the socket and expose events

    var socket = io.connect("localhost:8000");
    return {
        on: function(eventName, callback) {
            socket.on(eventName, function() {
                var args = arguments;
                $rootScope.$apply(function() {
                    callback.apply(socket, args);
                });
            });
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            })
        }
    };
});


// myApp.controller('AppCtrl', ['$scope', 'socket', function($scope, socket) {
// 	socket.on('send:name', function(data) {
// 		$scope.name = data.name;
// 	});
// }]);

// myApp.controller('MyCtrl1', ['$scope', 'socket', function($scope, socket) {
// 	socket.on('send:time', function(data) {
// 		$scope.time = data.time;
// 	});
// }]);

// myApp.controller('MyCtrl2', ['$scope', 'socket', function($scope, socket) {

// }]);
