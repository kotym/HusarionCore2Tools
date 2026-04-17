# hFramework Comprehensive API Guide

This guide documents the public classes exposed by hFramework and shows practical usage workflows based on code in:

- `hFramework/include`
- `hFramework/ports/*/include`
- `hFramework/examples`

It is written as a quick reference plus workflow handbook.

## 1. Typical Workflow

Most applications follow this flow:

1. Include `hFramework.h`.
2. Initialize and configure the peripherals you use (motors, serial, sensor ports, GPIO, etc.).
3. Create background tasks/timers if needed.
4. Enter a loop that reads inputs, computes outputs, and drives actuators.

```cpp
#include <hFramework.h>

void hMain()
{
    sys.setLogDev(&Serial);

    hMot1.setPower(400);
    sys.delay(500);
    hMot1.stop();

    while (true) {
        Serial.printf("Encoder: %ld\r\n", hMot1.getEncoderCnt());
        sys.delay(100);
    }
}
```

## 2. Global Objects By Board

The most-used variables are declared in `hFramework/ports/stm32/include/peripherals.h`.

### CORE2

- Motors: `hMotA..hMotD` and aliases `hMot1..hMot4`
- Sensor ports: `hSens1..hSens6`
- Buttons: `hBtn1`, `hBtn2`, `hCfg`
- LEDs: `hLED1`, `hLED2`, `hLED3`
- Serial: `Serial`, `RPi`
- Extension header: `hExt`
- Servo module: `hServo`
- CAN: `CAN`
- SD card: `SD`

### CORE2MINI

- Motors: `hMotA..hMotB` and aliases `hMot1..hMot2`
- Sensor ports: `hSens1..hSens3`
- Buttons: `hBtn1`, `hCfg`
- LEDs: `hLED1`, `hLED2`, `hLED3`
- Serial: `Serial`, `RPi`
- Servo module: `hServo`

### ROBOCORE

- Motors: `hMotA..hMotF` and aliases `hMot1..hMot6`
- Base sensor ports: `hBaseSens1..hBaseSens5`
- Lego-style sensor ports: `hSens1..hSens5`
- Buttons: `hBtn1`, `hBtn2`
- LEDs: `hLED1`, `hLED2`, `hLED3`
- Serial: `Serial`, `Edison`
- Extension headers: `hExt1`, `hExt2`
- CAN: `CAN`
- USB stream: `Usb`
- SD card: `SD`

## 3. Core Interfaces And Utility Classes

These are defined mainly in `hFramework/include`.

### GPIO/Bus/IO interfaces

- `IGPIO`: digital pin mode and read/write API.
- `IGPIO_int`: interrupt-capable GPIO API (`interruptOff`, `interruptSetEdge`, `interruptWait`).
- `IGPIO_adc`: ADC API (`analogReadVoltage`, `analogReadRaw`).
- `IGPIO_super`: combined interrupt + ADC GPIO interface.
- `II2C`: bus speed and `write/read/rw` transactions.
- `ISPI`: `write/read/rw` API for SPI.
- `ISerial`: serial stream API with `setBaudrate`, `available`, `flushRx`.
- `IStorage`: key persistent storage operations `clear/store/load`.

### Sensor and actuator abstraction interfaces

- `ISensor`: generic sensor port abstraction.
- `ISensor_i2c`: `ISensor` with hardware I2C access.
- `ISensor_serial`: `ISensor` with serial access.
- `ILegoSensor`: Lego-compatible sensor abstraction.
- `ILegoSensor_i2c`: Lego sensor with hardware I2C.
- `ILegoSensor_serial`: Lego sensor with serial.
- `IServo`: servo contract (`setWidth`, `setPeriod`, `calibrate`, `rotAbs`).

### Synchronization and RTOS helpers

- `IMutex`: lock primitive API.
- `hMutex`, `hRecursiveMutex`, `hSemaphore`: mutex and semaphore implementations.
- `hMutexGuard`: RAII lock wrapper.
- `hCondVar`: condition variable wait/notify.
- `hQueue<T>`: typed queue (send/receive/peek/flush/freeSpace).
- `hGenericQueue`: byte-size aware queue for arbitrary payload buffers.
- `hEventBits`: bitmask event synchronization (`waitAll`, `waitAny`, `setBits`).
- `hTask`: task handle (`join`, `isRunning`, `getName`).
- `hTimer`: timer handle (`start`, `stop`, `setPeriod`).

### Stream and formatting classes

- `hStreamDev`: stream interface with `read`/`write`, plus helpers `readAll`, `writeAll`, `printf`.
- `hPrintfDev`: formatting target abstraction used by `printf`-like APIs.
- `hPrintfContext`: internal formatter context class.
- `hPacketDev`: abstract packet-oriented stream contract.
- `hByteQueue`: queue + stream hybrid for byte-oriented buffering.

### Math and control classes

- `hVector3D`: 3D vector (`length`, `normalize`).
- `hQuaternion`: quaternion utilities (`conjugate`, multiplication, normalize, Euler conversion).
- `hPID`: generic PID controller with range and integrator limits.
- `hRegulator`: base class for motor regulators.
- `hPIDRegulator`: motor regulator built on `hPID`.
- `hCyclicBuffer<T>`: ring buffer utility for temporal values.
- `hElapsedTimer`: periodic trigger helper based on `sys.getRefTime()`.

### Other framework classes

- `hScriptingLanguage`: abstract VM binding contract.
- `hSoftwareI2C`: bit-banged I2C implementation.
- `hSSL`: SSL/TLS stream wrapper over TCP connection.
- `hTCPConnection`, `hUdpSocket`: networking socket wrappers.
- `IMU`: ROSbot IMU helper class.
- `Wheel`: wheel speed/distance helper around `hMotor`.
- `ROSbot`: high-level robot integration helper.
- `MPU9250_DMP`: SparkFun MPU9250 DMP class (advanced IMU access).
- `VL53L0X`: time-of-flight distance sensor class.

## 4. STM32 Port Classes (Most Hardware Features)

Defined in `hFramework/ports/stm32/include`.

- `hSystem`: global system singleton API (`taskCreate`, `delay`, `delayUs`, `delaySync`, `getRefTime`, stats/log functions).
- `hMotor`: DC motor and encoder control (`setPower`, `rotRel`, `rotAbs`, `waitDone`, regulator attach).
- `hGPIO`, `hGPIO_int`, `hGPIO_adc`, `hGPIO_super`: concrete GPIO implementations.
- `hI2C`: concrete hardware I2C.
- `hSPI`: concrete SPI with `SPISpeed` presets.
- `hSerial`: concrete UART/serial stream.
- `hSensor`, `hSensor_i2c`, `hSensor_serial`: generic sensor-port implementations.
- `hLegoSensor`, `hLegoSensor_i2c`, `hLegoSensor_serial`: Lego-port implementations.
- `hButton_int`, `hButton`: button helpers.
- `hLEDClass`: on-board LED control.
- `hCAN`: CAN bus controller.
- `hExtClass`: extension-header abstraction (pins + serial/spi/i2c).
- `hServoModuleClass`, `hServoModule_Servo`: external servo module API.
- `hSD`, `hFile`, `hFileIterator`, `hFileDescription`, `hSDLog`: SD card and file operations.
- `hUSB`: USB stream class.
- `Print`, `Stream`, `TwoWire`, `String`: Arduino compatibility classes.

## 5. Linux And ESP32 Port Classes

### Linux (`hFramework/ports/linux/include`)

- `hSystem`: Linux-port system helpers.
- `hGPIO`: Linux GPIO implementation.
- `hI2C`: Linux I2C wrapper.
- `hSPI`: Linux SPI wrapper.
- `hStorage`: Linux storage wrapper.
- `hSerialFD`, `hSerialFile`, `hSerialPTY`, `hBoardSerial`: serial transport classes.
- `_Network`: networking helper (`resolveAddress`, `connect`, `bindUdp`, `getLocalIp`).
- `_hWifi`: WiFi helper class.

### ESP32 (`hFramework/ports/esp32/include`)

- `hSystem`: ESP32 system API.
- `hGPIO`: ESP32 GPIO abstraction.
- `hSerial`: ESP32 serial class.
- `_Network`: ESP32 networking helper.
- `_hWifi`: ESP32 WiFi helper.

## 6. Common Workflows

### A. Motor position control with PID regulator

```cpp
hPIDRegulator reg;
reg.setKP(40.0f);
reg.setKI(0.05f);
reg.setKD(1000.0f);
reg.dtMs = 5;
reg.stableRange = 10;
reg.stableTimes = 3;

hMot1.attachPositionRegulator(reg);
bool ok = hMot1.rotRel(360, 600, true, 5000);
Serial.printf("rotRel status=%d\r\n", ok ? 1 : 0);
```

Key notes:

- `rotRel/rotAbs` are non-blocking unless `block=true`.
- `power` limits regulator output range.
- `waitDone()` can be used for queued command completion.

### B. Task + queue producer/consumer

```cpp
hQueue<int> q(32);

void producer()
{
    int n = 0;
    while (true) {
        q.sendToBack(n++);
        sys.delay(20);
    }
}

void consumer()
{
    int value;
    while (true) {
        if (q.receive(value, 1000)) {
            Serial.printf("%d\r\n", value);
        }
    }
}

void hMain()
{
    sys.taskCreate(producer, 2, 512, "producer");
    sys.taskCreate(consumer, 2, 512, "consumer");
}
```

### C. Sensor port mode switching

```cpp
// Use hardware I2C on hSens1.
hSens1.selectI2C();
uint8_t reg = 0x00;
uint8_t val = 0;
hSens1.getI2C().rw(0x1E, &reg, 1, &val, 1);

// Switch same port to GPIO when done.
hSens1.selectGPIO();
hSens1.pin2.setOut();
hSens1.pin2.write(true);
```

### D. SD card logging

```cpp
hFile file;
if (file.open("log.txt", hFile::MODE_CREATE_ALWAYS | hFile::MODE_WRITE) == hFile::ERROR_OK) {
    file.printf("boot=%llu\r\n", sys.getSerialNum());
    file.sync();
    file.close();
}
```

## 7. Frequently Asked Questions

### Which APIs block by default?

- Queue receive/send when empty/full.
- Motor `rotAbs/rotRel` only if `block=true`.
- I2C/SPI/serial read calls with timeout semantics.
- Button wait calls (`waitForPressed`, `waitForReleased`).

### How are timeouts represented?

- Most APIs use milliseconds.
- `INFINITE` means "wait forever".

### Why does a sensor stop working after changing mode?

Sensor ports are multiplexed. Re-select the expected mode (`selectGPIO`, `selectI2C`, `selectSerial`, `selectSoftI2C`) before using each interface.

### Should I share peripheral objects across tasks?

Yes, but protect higher-level operation sequences with `hMutex` if multiple tasks can interleave command groups.

## 8. Class Checklist (Quick Index)

This index is intentionally exhaustive for hFramework public headers:

- `_DevNull`
- `hByteQueue`
- `hCAN`
- `hCondVar`
- `hCyclicBuffer<T>`
- `hElapsedTimer`
- `hEventBits`
- `hExtClass`
- `hFile`
- `hFileDescription`
- `hFileIterator`
- `hGPIO`
- `hGPIO_adc`
- `hGPIO_int`
- `hGPIO_super`
- `hGenericQueue`
- `hI2C`
- `hLEDClass`
- `hLegoSensor`
- `hLegoSensor_i2c`
- `hLegoSensor_serial`
- `hMotor`
- `hMutex`
- `hMutexGuard`
- `hPacketDev`
- `hPID`
- `hPIDRegulator`
- `hPrintfContext`
- `hQueue<T>`
- `hQuaternion`
- `hRecursiveMutex`
- `hRegulator`
- `hSD`
- `hSDLog`
- `hSemaphore`
- `hSensor`
- `hSensor_i2c`
- `hSensor_serial`
- `hSerial`
- `hSPI`
- `hSSL`
- `hScriptingLanguage`
- `hServoModuleClass`
- `hServoModule_Servo`
- `hSoftwareI2C`
- `hStorage`
- `hStreamDev`
- `hSystem`
- `hTask`
- `hTCPConnection`
- `hTimer`
- `hUdpSocket`
- `hUSB`
- `hVector3D`
- `ILegoSensor`
- `ILegoSensor_i2c`
- `ILegoSensor_serial`
- `IGPIO`
- `IGPIO_adc`
- `IGPIO_int`
- `IGPIO_super`
- `II2C`
- `IMU`
- `IMutex`
- `ISensor`
- `ISensor_i2c`
- `ISensor_serial`
- `ISerial`
- `IServo`
- `ISPI`
- `IStorage`
- `MPU9250_DMP`
- `Print`
- `ROSbot`
- `Stream`
- `String`
- `TRoboCOREHeader`
- `TwoWire`
- `VL53L0X`
- `Wheel`
- `_Network`
- `_hWifi`
- `hBoardSerial`
- `hSerialFD`
- `hSerialFile`
- `hSerialPTY`
