#include "myFTDI.h"
#include "utils.h"
#include "timeutil.h"
#include <stdio.h>
#include <stdint.h>
#include <string>

#define BOOT0  0
#define RST    1
#define EDISON 3

int setPin(int pin, int value)
{
    LOG_DEBUG("FTDI stub: setPin called (no FTDI available)");
    return -1;
}

bool reset_device(int vendorId, int productId) {
    LOG_DEBUG("FTDI stub: reset_device called (no FTDI available)");
    return false;
}

bool uart_open(int speed, bool showErrors)
{
    if (showErrors)
        fprintf(stderr, "FTDI stub: uart_open() called but FTDI not available\n");
    return false;
}

int uart_open_with_config(int speed, const gpio_config_t& config, bool showErrors)
{
    return uart_open(speed, showErrors) ? 0 : -1;
}

int uart_set_gpio_config(const gpio_config_t& config)
{
    LOG_DEBUG("FTDI stub: uart_set_gpio_config called (no FTDI available)");
    return -1;
}

int uart_reset_boot()
{
    LOG_DEBUG("FTDI stub: uart_reset_boot called (no FTDI available)");
    return -1;
}

int uart_switch_to_edison(bool resetSTM)
{
    return -1;
}
int uart_switch_to_stm32()
{
    return -1;
}
int uart_switch_to_esp()
{
    return -1;
}

bool uart_is_opened()
{
    return false;
}

int uart_tx(const void* data, int len)
{
    (void)data; (void)len;
    return -1;
}

int uart_rx_any(void* data, int len)
{
    (void)data; (void)len;
    return 0;
}

int uart_rx(void* data, int len, uint32_t timeout_ms)
{
    (void)data; (void)len; (void)timeout_ms;
    return 0;
}

void uart_reset_normal()
{
    LOG_DEBUG("FTDI stub: uart_reset_normal called");
}

void uart_close()
{
    LOG_DEBUG("FTDI stub: uart_close called");
}
