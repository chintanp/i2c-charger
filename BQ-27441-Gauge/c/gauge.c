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
//#include "bq27x00_battery.c"

#define BQ27441_ADDR 0x55 		// taken from datasheet - page 13
#define CHECK_BIT(var,pos) ((var) & (1<<(pos)))

#define BQ27441_CONTROL_STATUS		0x0000
#define BQ27441_DEVICE_TYPE		0x0001
#define BQ27441_FW_VERSION		0x0002
#define BQ27441_DM_CODE			0x0004
#define BQ27441_PREV_MACWRITE		0x0007
#define BQ27441_CHEM_ID			0x0008
#define BQ27441_BAT_INSERT		0x000C
#define BQ27441_BAT_REMOVE		0x000D
#define BQ27441_SET_HIBERNATE		0x0011
#define BQ27441_CLEAR_HIBERNATE		0x0012
#define BQ27441_SET_CFGUPDATE		0x0013
#define BQ27441_SHUTDOWN_ENABLE		0x001B
#define BQ27441_SHUTDOWN		0x001C
#define BQ27441_SEALED			0x0020
#define BQ27441_PULSE_SOC_INT		0x0023
#define BQ27441_RESET			0x0041
#define BQ27441_SOFT_RESET		0x0042

#define BQ27441_CONTROL_1		0x00
#define BQ27441_CONTROL_2		0x01
#define BQ27441_TEMPERATURE		0x02
#define BQ27441_VOLTAGE			0x04
#define BQ27441_FLAGS			0x06
#define BQ27441_NOMINAL_AVAIL_CAPACITY	0x08
#define BQ27441_FULL_AVAIL_CAPACITY	0x0a
#define BQ27441_REMAINING_CAPACITY	0x0c
#define BQ27441_FULL_CHG_CAPACITY	0x0e
#define BQ27441_AVG_CURRENT		0x10
#define BQ27441_STANDBY_CURRENT		0x12
#define BQ27441_MAXLOAD_CURRENT		0x14
#define BQ27441_AVERAGE_POWER		0x18
#define BQ27441_STATE_OF_CHARGE		0x1c
#define BQ27441_INT_TEMPERATURE		0x1e
#define BQ27441_STATE_OF_HEALTH		0x20

#define BQ27441_BLOCK_DATA_CHECKSUM	0x60
#define BQ27441_BLOCK_DATA_CONTROL	0x61
#define BQ27441_DATA_BLOCK_CLASS	0x3E
#define BQ27441_DATA_BLOCK		0x3F

#define BQ27441_DESIGN_CAPACITY_1	0x4A
#define BQ27441_DESIGN_CAPACITY_2	0x4B

#define BQ27441_BATTERY_LOW		15
#define BQ27441_BATTERY_FULL		100

#define BQ27441_MAX_REGS		0x7F

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

/* getliner() reads one line from standard input and copies it to line array 
 * (but no more than max chars)
 * It does not place the terminating \n line array.
 * Returns line length, or 0 for empty line, or EOF for end-of-file.
 */
int getliner(char line[], int max)
{
        int nch = 0;
        int c;
        max = max - 1;          /* Leave room for '\0' */

        while ((c = getchar()) != EOF) {
                if (c == '\n')
                        break;

                if (nch < max) {
                        line[nch] = c;
                        nch = nch + 1;
                }
        }

        if (c == EOF && nch == 0)
                return EOF;

        line[nch] = '\0';
        return nch;
}

void perform_config() 
{
        byte data[100], writeData[100], unseal_data[10], cfgupdate_data[10], flag_data[10], flag_out[10]; 
        byte block_data_control[10], data_block_class[10], data_block[10], block_data_checksum[10];
        byte block_data_checksum_data[10], design_capacity_loc[10], design_capacity_data[10];
        byte soft_reset[10], seal_data[10];
        int i, design_capacity, new_design_capacity, new_design_cap_hex; 
        int des_cap[10], cksum = 0;
        char new_design_cap[7], a[10], b[10], tmp[10];
        
        unseal_data[0] = BQ27441_CONTROL_1;
        unseal_data[1] = 0x00;
        unseal_data[2] = 0x80;

        cfgupdate_data[0] = BQ27441_CONTROL_1;
        cfgupdate_data[1] = 0x13;
        cfgupdate_data[2] = 0x00;

        flag_data[0] = BQ27441_FLAGS;

        block_data_control[0] = BQ27441_BLOCK_DATA_CONTROL;
        block_data_control[1] = 0x00;

        data_block_class[0] = BQ27441_DATA_BLOCK_CLASS;
        data_block_class[1] = 0x52;

        data_block[0] = BQ27441_DATA_BLOCK;
        data_block[1] = 0x00;

        block_data_checksum[0] = BQ27441_BLOCK_DATA_CHECKSUM;

        design_capacity_loc[0] = BQ27441_DESIGN_CAPACITY_1;

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
                        getliner(new_design_cap, 7);
                        
                        if (new_design_cap != EOF && new_design_cap[0] != 0) {
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
                                delay(1000);
                                I2cSendData(BQ27441_ADDR, soft_reset, 3);                                       // #12
                                delay(5);
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
                        } else {
                                printf("Design capacity left unchanged. Now at %d mAh \n", design_capacity);
                        }
                } else {
                        printf("The checksum is not as expected. Config halt. \n");
                }
        } else {
                printf("Cannot proceed with configuration. \n");
                printf("The CFGUPDATE MODE has not been enabled yet. \n");
        }
    
}

int main(int argc, char **argv)
{
        int i, voltage;
        byte data[100], writeData[100]; 
        float remaining_batt_cap = 0.0; 
        float full_charge_cap = 0.0;
        float soc = 0.0; 
        float temp = 0.0;
        float current = 0.0;
        
        writeData[0] = 0x00;
        writeData[1] = 0x04;
        
	printf("Inside main \n");
	
        init_i2c("/dev/i2c-1");
	
        update_design_cap();
        
        while(true) {
                /* Reading the device registers */
                I2cSendData(BQ27441_ADDR, writeData, 2);
                I2cReadData(BQ27441_ADDR, data, 100);

                voltage = data[4]*16*16 + data[3];
                remaining_batt_cap = data[12]*16*16 + data[11];
                full_charge_cap = data[14]*16*16 + data[13];
                soc = data[28]*16*16 + data[27];//(remaining_batt_cap/full_charge_cap)*100;
                temp = (data[2]*16*16 + data[1])/10.0 - 273.0;
                current = data[16]*16*16 + data[15];

                if (current >= 32267) 
                        current = current - 65536;          // two's complement as signed integer

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