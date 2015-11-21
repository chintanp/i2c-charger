/*
 * This file implements code to read data from and set data for
 * TI-make BQ-27441 battery fuel gauge. Data to be set include 
 * "Design Capacity", "Termination Voltage" etc. Data to be read 
 * include "Voltage", "Current", "Temperature", "SOC", etc.
 */

/* 
 * File:   main.c
 * Author: Chintan
 *
 * Created on November 17, 2015, 5:44 PM
 */

#define BQ27441_ADDR 0x55 		// taken from datasheet - page 13
#define CHECK_BIT(var,pos) ((var) & (1<<(pos)))

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

/* This function initializes the I2C device*/
void init_i2c(char *DeviceName)
{	
		printf("Initialising i2c device \n");
        deviceDescriptor=open(DeviceName, O_RDWR);

        if (deviceDescriptor == -1) {
                printf("Error opening device '%s' \n",DeviceName);
                exit(-1);
        }
}

/* This function sends data to the I2C device*/
void I2cSendData(byte addr,byte *data,int len)
{
        if(ioctl(deviceDescriptor,I2C_SLAVE, addr))
                printf("I2cSendData_device : IOCTL Problem \n");

        write(deviceDescriptor,data,len);
}

/* This function reads data from the I2C device*/
void I2cReadData(byte addr,byte *data,int len)
{
        if(ioctl(deviceDescriptor,I2C_SLAVE, addr))
                printf("I2cReadData_device : IOCTL Problem \n");

        read(deviceDescriptor,data,len);
}

/* This function returns the substring of the string */
char* substring(const char* str, int beg, int n) 
{
        char *ret = malloc(n+1);
        
        if (beg+n >= strlen(str))
                return NULL;
        
        strncpy(ret, (str + beg), n);
        *(ret + n) = 0;
        
        return ret;
}

/* Convert the number to hexadecimal representation */
void to_hex_16(char *output, unsigned n)
{
        static const char hex_digits[] = "0123456789abcdef";
        output[0] = hex_digits[(n >> 12) & 0xF];
        output[1] = hex_digits[(n >> 8) & 0xF];
        output[2] = hex_digits[(n >> 4) & 0xF];
        output[3] = hex_digits[(n & 0xF)];
        output[4] = '\0';
}

long to_dec_10(unsigned const char *hex) 
{
        static const long hextable[] = {
                ['0'] = 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 
                ['A'] = 10, 11, 12, 13, 14, 15,
                ['a'] = 10, 11, 12, 13, 14, 15
        };
        
        long ret = 0;
        
        while (*hex && ret >= 0) {
                ret = (ret << 4) | hextable[*hex++];
        }
        return ret;
}

static int checksum(byte *check_data)
{
        int sum = 0;
        int ii = 0;
        
        for(ii = 0; ii < 32; ii++) 
            sum += check_data[ii+62];
            
        sum &= 0xFF;
        
        return 0xFF - sum;
}

int main(int argc, char **argv)
{
	    int i, voltage, design_capacity, new_design_capacity, new_design_cap_hex;
	    int des_cap[10], cksum = 0;
		byte data[100], writeData[100], unseal_data[10], cfgupdate_data[10], flag_data[10], flag_out[10]; 
		byte block_data_control[10], data_block_class[10], data_block[10], block_data_checksum[10];
		byte block_data_checksum_data[10], design_capacity_loc[10], design_capacity_data[10];
		byte soft_reset[10], seal_data[10];
		float remaining_batt_cap = 0.0; 
		float full_charge_cap = 0.0;
        float soc = 0.0; 
        float temp = 0.0;
        float current = 0.0;
        char new_design_cap[100], a[10], b[10], tmp[10];
        
	
		printf("Inside main \n");
	
	    init_i2c("/dev/i2c-1");
	
		writeData[0] = 0x00;
	    writeData[1] = 0x04;
		
		unseal_data[0] = 0x00;
		unseal_data[1] = 0x00;
		unseal_data[2] = 0x80;
		
		cfgupdate_data[0] = 0x00;
		cfgupdate_data[1] = 0x13;
		cfgupdate_data[2] = 0x00;
		
		flag_data[0] = 0x06;
		
		block_data_control[0] = 0x61;
		block_data_control[1] = 0x00;
		
		data_block_class[0] = 0x3E;
		data_block_class[1] = 0x52;
		
		data_block[0] = 0x3F;
		data_block[1] = 0x00;
		
		block_data_checksum[0] = 0x60;
		
		design_capacity_loc[0] = 0x4A;
		
		soft_reset[0] = 0x00;
		soft_reset[1] = 0x42;
		soft_reset[2] = 0x00;
		
		seal_data[0] = 0x00;
		seal_data[1] = 0x20;
		seal_data[2] = 0x00;
		
		
		/* Unseal the gauge - Refer TRM - Pg-14 */
		I2cSendData(BQ27441_ADDR, unseal_data, 3);      // #1
		I2cSendData(BQ27441_ADDR, unseal_data, 3);          
		delay(5);
		printf("The gauge seems to be unsealed. \n");
		
        I2cSendData(BQ27441_ADDR, cfgupdate_data, 3);   // #2
        delay(1000);
        I2cSendData(BQ27441_ADDR, flag_data, 1);        // #3
        delay(5);
        I2cReadData(BQ27441_ADDR, flag_out, 1);
        
        printf("The flag_out is: %x \n", flag_out[0]);
        
        if (CHECK_BIT(flag_out[0], 4)) {
                printf("The gauge is ready to be configured \n");
                
                I2cSendData(BQ27441_ADDR, block_data_control, 2);       // #4
                delay(5);
                I2cSendData(BQ27441_ADDR, data_block_class, 2);         // #5   
                delay(5);
                I2cSendData(BQ27441_ADDR, data_block, 2);               // #6
                delay(5);
                I2cSendData(BQ27441_ADDR, block_data_checksum, 1);      // #7
                delay(5);
                I2cReadData(BQ27441_ADDR, block_data_checksum_data, 1);
                delay(5);
                
                printf("The checksum_data: %x \n", block_data_checksum_data[0]);
                
                if (block_data_checksum_data[0] == 0xE8) {
                        printf("The checksum is as expected. Config will proceed. \n");
                        
                        I2cSendData(BQ27441_ADDR, design_capacity_loc, 1);      // #8
                        delay(5);
                        I2cReadData(BQ27441_ADDR, design_capacity_data, 2);
                        delay(5);
                        
                        //printf("Design capacity data: %x and %x \n", design_capacity_data[0], design_capacity_data[1]);
                        
                        design_capacity = design_capacity_data[0]*16*16 + design_capacity_data[1];
                        delay(5);
                        
                        printf("The current design capacity is: %d mAh \n", design_capacity);
                        printf("Set new design capacity in mAh (ENTER to continue) ?");
                        scanf("%s", new_design_cap);
                        
                        if (new_design_cap != "\n") {
                                printf("Trying to update the design capacity \n");
                                
                                new_design_capacity = atoi(new_design_cap);                                     // #9
                                printf("Trying to set new design capacity to: %d \n", new_design_capacity);
                                to_hex_16(tmp, new_design_capacity);
                                
                                for(i = 0; i <= 3; i++) {
                                        printf("Output at position %d has %c \n", i, tmp[i]);
                                }
                                
                                des_cap[0] = design_capacity_loc[0];
                                des_cap[1] = (tmp[0] - '0')*16 + (tmp[1] - '0');
                                des_cap[2] = (tmp[2] - '0')*16 + (tmp[3] - '0');
                                
                                printf("Des cap 0: %d ", des_cap[0]);
                                printf("Des cap 1: %d ", des_cap[1]);
                                printf("Des cap 2: %d ", des_cap[2]);
                                I2cSendData(BQ27441_ADDR, des_cap, 3);
                                delay(1000);
                               
		                        cksum = checksum(data);                                                         // #10
		                        delay(1000);
		                        printf("New Checksum found is: %x ", cksum);
		                        
		                        block_data_checksum[1] = cksum;                                                 // #11    
		                        I2cSendData(BQ27441_ADDR, block_data_checksum, 2);
		                        delay(5);
		                        I2cSendData(BQ27441_ADDR, soft_reset, 3);                                       // #12
		                        delay(1000);
                                //printf("Design Cap data 0: %x", data[72]);
                                //printf("Design Cap data :1 %x", data[73]);
                                //design_capacity = data[72]*16*16 + data[73];
                                
                                I2cSendData(BQ27441_ADDR, flag_data, 1);                                        // #13
                                delay(5);
                                I2cReadData(BQ27441_ADDR, flag_out, 1);
                                printf("The flag_out is: %x \n", flag_out[0]);
                                
                                if(!CHECK_BIT(flag_out[0], 4)) {
                                        printf("CFGUPDTE has been exited, configuration done. \n");
                                        I2cSendData(BQ27441_ADDR, seal_data, 1);                                // #14
                                        delay(5);
                                        printf("Gauge has been sealed and is ready for operation \n");
                                }
        
        
                                
                                //printf("New capacity set as: %d mAh \n", design_capacity);
                                
                        } else {
                                printf("Design capacity left unchanged. Now at %d mAh \n", design_capacity);
                        }
                        
                        
                        // set new design capacity
                } else {
                        printf("The checksum is not as expected. Config halt. \n");
                }
                        
        } else {
                printf("Cannot proceed with configuration. \n");
                printf("The CFGUPDATE MODE has not been enabled yet. \n");
        }
		
		while(true) {
				//I2cSendData(BQ27441_ADDR, writeData, 2);
				
		        
			
				
				
				/* Reading the device registers */
				I2cSendData(BQ27441_ADDR, writeData, 2);
				I2cReadData(BQ27441_ADDR, data, 100);
				
				voltage = data[4]*16*16 + data[3];
				remaining_batt_cap = data[12]*16*16 + data[11];
				full_charge_cap = data[14]*16*16 + data[13];
				soc = (remaining_batt_cap/full_charge_cap)*100;
				temp = (data[2]*16*16 + data[1])/10.0 - 273.0;
				current = data[16]*16*16 + data[15];
				
				printf("Voltage: %d  mV\n", voltage);
				printf("Current: %f  mA\n", current);
				printf("Remaining Battery Capacity: %f  mAh\n", remaining_batt_cap);
				printf("Full Charge Capacity: %f mAh\n", full_charge_cap);
				printf("State of Charge: %f p.c. \n", soc);
				printf("Temperature: %f  Deg C\n", temp);

				delay(10000);
		}
		
        close(deviceDescriptor);
        endwin();

        return 0;
}