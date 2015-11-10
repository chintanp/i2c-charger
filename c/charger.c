// Original instructions - /* compile with cc -o mma7660 mma7660.c -lncurses */
// My changes -- //gcc -o mma mma.c -lncurses -l wiringPi -lm

#define BQ24261_ADDR 0x6B 		// taken from datasheet - page 27

#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <stdlib.h>
#include <errno.h>
#include <signal.h>
#include <math.h>
#include <fcntl.h>
#include <linux/i2c-dev.h>
#include <time.h>
#include <sys/time.h>
#include <curses.h>
#include <wiringPi.h>

typedef unsigned char byte;

int deviceDescriptor;

void I2cSendData(byte addr,byte *data,int len)
{
        if(ioctl(deviceDescriptor,I2C_SLAVE, addr))
                printf("I2cSendData_device : IOCTL Problem\n");

        write(deviceDescriptor,data,len);
}

void I2cReadData(byte addr,byte *data,int len)
{
        if(ioctl(deviceDescriptor,I2C_SLAVE, addr))
                printf("I2cReadData_device : IOCTL Problem\n");

        read(deviceDescriptor,data,len);
}

// Inititalizes the I2C channel

void init_i2c(char *DeviceName)
{	
	printf("Initialising i2c device");

        deviceDescriptor=open(DeviceName, O_RDWR);

        if (deviceDescriptor == -1)
        {
                printf("Error opening device '%s'\n",DeviceName);
                exit(-1);
        }
}

// Entry point
int main(int argc, char **argv)
{
	/* Variable Declaration */

        int i;
	double v, voltage, timer, parts[2];
  	byte data[20], data0[2], data1[2], data2[2], data3[2], data4[2], data5[2], data6[2];
	FILE *file1;
	const char *filename1 = "testdata.txt";
	unsigned char file_data[100];
	time_t rawtime;
	struct tm *timeinfo;
	
	/* Execution */

	printf("Inside main \n");
	
	// the charger is connected to I2C bus-1 on RPi
        init_i2c("/dev/i2c-1");
	
	/* Set the registers of charger */

	// first assignment tells the address - total 7 registers (0-6)
	// the next assignment gives the actual value to be stored in decimal format
	// To understand the value -- convert to binary - pad zeros on the left to make 8 bits -
	//	                      each bit represents value for corresponding regitser bit B0 - B7
     
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
	
	// Open the file in read-only mode
	file1 = fopen(filename1, "rb");
	
	if(file1 != NULL) 
	{
		/* Some more variables */

		char line[1000];
		char *part;
		int q = 0, delV = 0, vBatCode, vBatRegValue, totalDelay = 0;
		
		/* read a line from file */

		while(fgets(line, sizeof line, file1) != NULL)		
		{
			printf("%s", line);  // print the line contents to stdout

			// parse the line to get time and voltage
			part = strtok(line, ",");
			while(part != NULL) 
			{
				// convert the extracted part to float	
				parts[q] = atof(part);
				// continue parsing
				part = strtok(NULL, ",");
				q++;	
			}
			// reset the array counter for next line
			q = 0;	
			
			printf("Time: %lf, voltage: %lf \n", parts[0], parts[1]);
			
			/* Logic for converting voltage to code as needed by the charger */

			// Get voltage over 3.5V, in milivolts
			delV = parts[1] * 1000 - 3500;
			
			// Regularize bad voltages, no voltage allowed under 3.5 V and over 4.44 V
			if (delV < 0)
			{
				delV = 0;
			}
			else if (delV > 900)
			{
				delV = 900;
			}
			
			// Our resolution is 20 mV
			vBatCode = delV / 20;
			// as the first two bits are zero, pg - 33  of datasheet
			vBatRegValue = vBatCode * 4;	
			
			// The zero problem, the voltage starts with 3.6, even trying to set it to 3.5, so rather, starting with 3.52
			if(vBatRegValue == 0)
			{
				data2[1] = 4; //vBatRegValue;
			}
			else 
			{
				data2[1] = vBatRegValue;
			}
			// This is the time, from the text file.	
			totalDelay = parts[0];
			
			setRegisters: 				// GOTO should be used **very rarely**	
			
			// Find the time of register write
			time (&rawtime);
			timeinfo = localtime(&rawtime);
			printf("Current local time and data: %s \n", asctime(timeinfo));
			printf("Setting voltage to: %lf \n", 3500.0 + delV);

			// Write data to the I2C device, one register at a time
			printf("data0[1] : %d, data1[1]: %d, data2[1]: %d, data3[1]: %d \n", data0[1], data1[1], data2[1], data3[1]);
			printf("data4[1] : %d, data5[1]: %d, data6[1]: %d \n", data4[1], data5[1], data6[1]);
			I2cSendData(BQ24261_ADDR, data0, 2);
			I2cSendData(BQ24261_ADDR, data1, 2);
			I2cSendData(BQ24261_ADDR, data2, 2);
			I2cSendData(BQ24261_ADDR, data3, 2);
			I2cSendData(BQ24261_ADDR, data4, 2);
			I2cSendData(BQ24261_ADDR, data5, 2);
			I2cSendData(BQ24261_ADDR, data6, 2);
			
			/* Timing Logic */	
			
			// The voltage value needs to be re-written to the charger every few seconds (10 here)	
			while (totalDelay > 0) 
			{	
				// using delay, makes this platform specific
				if (totalDelay > 10) 
				{
					totalDelay = totalDelay - 10;
					delay(10000);
					goto setRegisters;
				}
				else if (totalDelay <= 10) 
				{
					delay(totalDelay * 1000);					
					totalDelay = 0;
				}	
					
			}

		}
		
		// Close the file	
		fclose(file1);
		printf("\n\n\n *****Charging done !!!*****");
	}
	else
	{
		perror(filename1);
	}
	
	printf("\n\n\n *****Charging done !!!*****");	
        close(deviceDescriptor);

        endwin();

        return 0;
}
