# hSensors Comprehensive API Guide

This guide documents all public classes in hSensors using code from:

- `hSensors/include`
- `hSensors/src`
- `hSensors/examples`

It is organized by vendor and by sensor communication mode.

## 1. Typical Workflow

1. Choose a compatible sensor port type:
   - `ILegoSensor_i2c` for I2C sensors
   - `ILegoSensor` for analog/interrupt sensors
2. Construct the sensor class with that port.
3. Call read/config methods in your main loop.
4. Handle return codes (`EError`/`bool`) and conversion units.

## 2. Base Interface Expectations

All classes depend on hFramework interfaces:

- `ILegoSensor`
- `ILegoSensor_i2c`
- `ILegoSensor_serial` (not used by current public hSensors classes)

Important mode points:

- I2C sensors call/select I2C mode during init paths.
- Analog sensors use ADC-capable pin access (`getPinIntAdc`).
- Interrupt-based analog sensors rely on edge wait semantics.

## 3. Public Class Inventory

### Hitechnic

- `Hitechnic_Accel`
- `Hitechnic_Angle`
- `Hitechnic_ColorV2`
- `Hitechnic_Compass`
- `Hitechnic_EOPD`
- `Hitechnic_Gyro`
- `Hitechnic_IRSeeker`

### Lego

- `Lego_Light`
- `Lego_Sound`
- `Lego_Temp`
- `Lego_Touch`
- `Lego_Ultrasonic`

### Mindsensors

- `Mindsensors_IRDistance`
- `Mindsensors_LineLeader`
- `Mindsensors_NumericPad`
- `Mindsensors_Pressure`
- `Mindsensors_SumoEyes`
- `Pressed` (helper for NumericPad key-state decoding)

## 4. Detailed Class Reference

## Hitechnic_Accel

Header: `hSensors/include/Hitechnic_Accel.h`

Constructor:

- `Hitechnic_Accel(ILegoSensor_i2c& sensor)`

Key methods:

- `EError readRaw(int16_t& x, int16_t& y, int16_t& z)`
- `EError read(float& x, float& y, float& z)`

Notes:

- I2C sensor.
- Float read provides acceleration in g-style scaled values.

## Hitechnic_Angle

Header: `hSensors/include/Hitechnic_Angle.h`

Constructor:

- `Hitechnic_Angle(ILegoSensor_i2c& sensor)`

Data structure:

- `data` with `Angle`, `AccumulatedAngle`, `rpm`.

Key methods:

- `EError read(data* pTab)`
- `EError resetAccmulatedAngle()`
- `EError resetAngle()`

## Hitechnic_ColorV2

Header: `hSensors/include/Hitechnic_ColorV2.h`

Constructor:

- `Hitechnic_ColorV2(ILegoSensor_i2c& sensor)`

Key methods:

- `int readColor()`
- `bool readNormRGB(int& red, int& green, int& blue)`
- `bool readRawRGB(bool passive, long& red, long& green, long& blue)`
- `bool readRawWhite(bool passive, long& white)`
- `int readColorIndex()`

Notes:

- Supports active/passive measurement modes.

## Hitechnic_Compass

Header: `hSensors/include/Hitechnic_Compass.h`

Constructor:

- `Hitechnic_Compass(ILegoSensor_i2c& sensor)`

Key methods:

- `EError startCalibration()`
- `EError stopCalibration()`
- `EError getControlMode(uint8_t& status)`
- `EError readHeading(uint16_t& heading)`

Notes:

- Calibration workflow is required for best heading quality.

## Hitechnic_EOPD

Header: `hSensors/include/Hitechnic_EOPD.h`

Constructor:

- `Hitechnic_EOPD(ILegoSensor_i2c& sensor)`

Data structure:

- `data` with `raw` and `processed`.

Key methods:

- `EError read(data* pDataMsg)`
- `void setModeLong()`
- `void setModeShort()`

## Hitechnic_Gyro

Header: `hSensors/include/Hitechnic_Gyro.h`

Constructor:

- `Hitechnic_Gyro(ILegoSensor& sensor)`

Key method:

- `uint16_t read()` raw analog value.

## Hitechnic_IRSeeker

Header: `hSensors/include/Hitechnic_IRSeeker.h`

Constructor:

- `Hitechnic_IRSeeker(ILegoSensor_i2c& sensor)`

Data structure includes:

- AC/DC direction
- enhanced strength/direction
- per-segment arrays

Key method:

- `EError read(data* pDataMsg)`

## Lego_Light

Header: `hSensors/include/Lego_Light.h`

Constructor:

- `Lego_Light(ILegoSensor& sensor)`

Key methods:

- `int readRaw()`
- `void setActive()`
- `void setInactive()`

## Lego_Sound

Header: `hSensors/include/Lego_Sound.h`

Constructor:

- `Lego_Sound(ILegoSensor& sensor)`

Key methods:

- `int readRaw()`
- `int readNorm()`
- `void setDBA()`
- `void setDB()`

## Lego_Temp

Header: `hSensors/include/Lego_Temp.h`

Constructor:

- `Lego_Temp(ILegoSensor_i2c& sensor)`

Accuracy enum:

- `A_MIN`, `A_MEAN1`, `A_MEAN2`, `A_MAX`

Key methods:

- `EError readTemp(float& v)`
- `EError readAccuracy(Accuracy& v)`
- `EError setAccuracy(Accuracy v)`
- `EError setSingleShot()`
- `EError setContinuous()`

## Lego_Touch

Header: `hSensors/include/Lego_Touch.h`

Constructor:

- `Lego_Touch(ILegoSensor& sensor)`

Key methods:

- `int readState()`
- `bool isPressed()`
- `bool isReleased()`
- `bool waitUntilChange(uint32_t timeout = INFINITE)`

Notes:

- `waitUntilChange` is blocking with timeout.

## Lego_Ultrasonic

Header: `hSensors/include/Lego_Ultrasonic.h`

Constructor:

- `Lego_Ultrasonic(ILegoSensor_i2c& sensor)`

Key methods:

- `int readDist()`
- `bool setSingleMode()`
- `bool setContinuousMode()`
- `bool setEventCapture()`

## Mindsensors_IRDistance

Header: `hSensors/include/Mindsensors_IRDistance.h`

Constructor:

- `Mindsensors_IRDistance(ILegoSensor_i2c& sensor)`

Key methods:

- `EError readReal(int16_t& v)`
- `EError readVoltage(int16_t& v)`

Notes:

- `readReal` is the processed distance output.

## Mindsensors_LineLeader

Header: `hSensors/include/Mindsensors_LineLeader.h`

Constructor:

- `Mindsensors_LineLeader(ILegoSensor_i2c& sensor)`

Read methods:

- `readSensorUncalibrated(int8_t*)`
- `readSensorRaw(uint8_t*)`
- `readResult(uint8_t&)`
- `readAverage(uint8_t&)`
- `readSteering(int8_t&)`
- `readsetPoint(uint8_t&)`
- `readKp/Ki/Kd` and factor variants
- `readWhiteThresh`, `readBlackThresh`

Config methods:

- `wakeUp()`, `sleep()`
- `invertLineColor()`, `resetLineColor()`
- `takeSnapshot()`, `calWhite()`, `calBlack()`
- `setKp`, `setKi`, `setKd`, `setPoint`

## Pressed and Mindsensors_NumericPad

Header: `hSensors/include/Mindsensors_NumericPad.h`

`Pressed` helper methods:

- Key predicates `zero()` ... `nine()`, `hash()`, `star()`
- `void whichOne()`
- `int16_t getNumber()`

Numeric pad class:

- Constructor `Mindsensors_NumericPad(ILegoSensor_i2c& sensor)`
- Method `EError scanKeys(Pressed& k)`

## Mindsensors_Pressure

Header: `hSensors/include/Mindsensors_Pressure.h`

Constructor:

- `Mindsensors_Pressure(ILegoSensor_i2c& sensor)`

Key method:

- `EError read(float& v)`

## Mindsensors_SumoEyes

Header: `hSensors/include/Mindsensors_SumoEyes.h`

Enum:

- `Zone { NONE, FRONT, LEFT, RIGHT }`

Constructor:

- `Mindsensors_SumoEyes(ILegoSensor& sensor)`

Key methods:

- `Zone readZone()`
- `void setLongRange()`
- `void setShortRange()`

## 5. Mode Matrix

| Class | Port type | Mode |
| --- | --- | --- |
| Hitechnic_Accel | `ILegoSensor_i2c` | I2C |
| Hitechnic_Angle | `ILegoSensor_i2c` | I2C |
| Hitechnic_ColorV2 | `ILegoSensor_i2c` | I2C |
| Hitechnic_Compass | `ILegoSensor_i2c` | I2C |
| Hitechnic_EOPD | `ILegoSensor_i2c` | I2C |
| Hitechnic_Gyro | `ILegoSensor` | Analog/ADC |
| Hitechnic_IRSeeker | `ILegoSensor_i2c` | I2C |
| Lego_Light | `ILegoSensor` | Analog/ADC |
| Lego_Sound | `ILegoSensor` | Analog/ADC |
| Lego_Temp | `ILegoSensor_i2c` | I2C |
| Lego_Touch | `ILegoSensor` | Analog + interrupt |
| Lego_Ultrasonic | `ILegoSensor_i2c` | I2C |
| Mindsensors_IRDistance | `ILegoSensor_i2c` | I2C |
| Mindsensors_LineLeader | `ILegoSensor_i2c` | I2C |
| Mindsensors_NumericPad | `ILegoSensor_i2c` | I2C |
| Mindsensors_Pressure | `ILegoSensor_i2c` | I2C |
| Mindsensors_SumoEyes | `ILegoSensor` | Analog/ADC |

## 6. Practical Examples

### A. I2C sensor loop (temperature)

```cpp
hLegoSensor_i2c port(hSens1);
Lego_Temp temp(port);

while (true) {
    float c = 0;
    if (temp.readTemp(c) == Lego_Temp::ERROR_OK) {
        Serial.printf("temp=%.2f C\r\n", c);
    }
    sys.delay(200);
}
```

### B. Analog sensor loop (touch)

```cpp
hLegoSensor_simple port(hSens5);
Lego_Touch touch(port);

while (true) {
    if (touch.isPressed()) {
        hLED1.on();
    } else {
        hLED1.off();
    }
    sys.delay(20);
}
```

### C. Line follower data extraction

```cpp
hLegoSensor_i2c port(hSens1);
Mindsensors_LineLeader ll(port);

while (true) {
    int8_t steering = 0;
    if (ll.readSteering(steering) == Mindsensors_LineLeader::ERROR_OK) {
        Serial.printf("steering=%d\r\n", steering);
    }
    sys.delay(10);
}
```

## 7. Troubleshooting Notes

- If a sensor read always fails, confirm port type matches class constructor.
- Re-check sensor mode (I2C vs analog) after reusing the same physical port for another device.
- Keep I2C wiring short and stable, and avoid floating analog lines.
- For heading/color quality, perform calibration/mode procedures exposed by each class.
- Treat blocking methods (`waitUntilChange`) carefully inside timing-sensitive loops.
