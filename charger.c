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

// This function gets the voltage from the variable data2[1] by removing
// the rightmost bit and adjacent bit, and uses the rest of bits to generate 
// a bianry code, whose decimal representation multiplied by 20 mV 
// represents the charging voltage - details on datasheet, pg-33

double get_voltage(int dec) 
{
	
	int remainder, quotient;
	int binary[100], i=0, j;
	double newDec = 0.0, vol = 0.0;
	quotient = dec;

	while(quotient != 0)
	{
		binary[i] = quotient % 2;
		quotient = quotient / 2;
		i = i + 1;
	}
	
	for(j = i-1; j>1; j--)
	{	
		newDec = newDec + pow(2, j-2)*binary[j];
	}		
	
	// This formula from datasheet page no. 33 for battery regulation voltage 
	vol = 3500.0 + 20.0*newDec;
	printf("Voltage: %f mVolts\n", vol);
	return vol;
}

int main(int argc, char **argv)
{
        int i;
	double v, voltage, timer, parts[2];
  	byte data[20], data0[20], data1[20], data2[20], data3[20], data4[20], data5[20], data6[20];
	FILE *file1;
	const char *filename1 = "testdata.txt";
	unsigned char file_data[100];
	time_t rawtime;
	struct tm *timeinfo;
	
	fflush(stdout);

	printf("Inside main \n");
	
	// the charger is connected to I2C bus-1 on RPi
        init_i2c("/dev/i2c-1");
	
	// set the registers of charger
	// first assignment tells the address
	// the next assignment gives the actual value to be stored in decimal format	
	
	data0[0] = 0;
	data0[1] = 148; // 16; //144;   // make the voltage permanent
	data1[0] = 1;
	data1[1] = 64;
	data2[0] = 2;
	//	data2[1] = 160;
	data3[0] = 3;
	data3[1] = 70;
	data4[0] = 4;
	data4[1] = 42;
	data5[0] = 5;
	data5[1] = 0;
	data6[0] = 6;
	data6[1] = 112;
	
	
	file1 = fopen(filename1, "rb");
	
	if(file1 != NULL) 
	{
		char line[1000];
		char *part;
		int q = 0, delV = 0, vBatCode, vBatRegValue, totalDelay = 0;
		while(fgets(line, sizeof line, file1) != NULL)		/* read a line from file */
		{
			printf("%s", line);  // print the line contents to stdout
			part = strtok(line, ",");
			while(part != NULL) 
			{
				parts[q] = atof(part);
//				printf("%f \n", parts[q]);
				part = strtok(NULL, ",");
				q++;	
			}
			
			q = 0;	
			printf("Time: %lf, voltage: %lf \n", parts[0], parts[1]);
			
			// set the value of data2[1] based on the voltage, i.e. parts[1]
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
			
			vBatCode = delV / 20;
			vBatRegValue = vBatCode * 4;			// as the first two bits are zero, pg - 33  of datasheet
			data2[1] = vBatRegValue;
			totalDelay = parts[0];			// This is the time, from the text file.
			
			setRegisters: 				// GOTO should be used **very rarely**	
			
			// Find the time of register write
			time (&rawtime);
			timeinfo = localtime(&rawtime);
			printf("Current local time and data: %s \n", asctime(timeinfo));
			printf("Setting voltage to: %lf \n", 3500.0 + delV);

			// Write data to the I2C device, one register at a time
			I2cSendData(BQ24261_ADDR, data0, 2);
			I2cSendData(BQ24261_ADDR, data1, 2);
			I2cSendData(BQ24261_ADDR, data2, 2);
			I2cSendData(BQ24261_ADDR, data3, 2);
			I2cSendData(BQ24261_ADDR, data4, 2);
			I2cSendData(BQ24261_ADDR, data5, 2);
			I2cSendData(BQ24261_ADDR, data6, 2);
			
			// The voltage value needs to be re-written to the charger every few seconds (10 here)	
			while (totalDelay > 0) 
			{
				if (totalDelay > 10) 
				{
					totalDelay = totalDelay - 10;
					delay(10000);
					goto setRegisters;
				}
				else if (totalDelay < 10) 
				{
					delay(totalDelay * 1000);					
					totalDelay = 0;
				}	
					
			}

			// set a delay based on the time, i.e. parts[0]
			// delay(1000 * parts[0]);
		}

		fclose(file1);
	}
	else
	{
		perror(filename1);
	}

        close(deviceDescriptor);

        endwin();

        return 0;
}
