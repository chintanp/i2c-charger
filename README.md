# i2c-charger
Codes related to BQ24261 i2c charger.


## Main File

  * charger.c - To compile this on a linux prompt, use:  
````  
gcc -o charger charger.c -lncurses -lm -lwiringPi  
````

to generate an executable named "charger". To run this file on linux prompt, use -  
````
./charger 
````

 This **needs** a file called "testdata.txt" in the directory, from which it reads, time voltage data, in comma separated form, like so: 

time1, voltage1   
time2, voltage2   
time3, voltage3  

... and so on. Hit a return after each row. A sample file along with this repository. 

##### Tested on: 

* Raspberry PI - B+ - with **distro** - Raspbian GNU/Linux 7 and **kernel** - Linux raspberrypi 4.1.7+

What this file does, is simply get the voltage and time from the file testdata.txt and set the charger to charger at this voltage for the given time, then move to the next line and so on. This file communicates with the charger using the I2C protocol. Read the charger datasheet for more info on the charger. 
