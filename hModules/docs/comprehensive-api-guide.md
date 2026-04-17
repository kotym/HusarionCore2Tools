# hModules Comprehensive API Guide

This guide documents all public classes in hModules using code from:

- `hModules/include`
- `hModules/src`
- `hModules/examples`

It focuses on real integration patterns used with hFramework.

## 1. Typical Workflow

1. Pick a module class (distance, IMU, matrix keyboard, servo driver, PID helper).
2. Construct it with the required hFramework dependency (`ISensor`, `ISensor_i2c`, `ISerial`, or `hExtClass`).
3. Call init/config methods.
4. Use periodic update/read calls in your loop or task.

## 2. Class Inventory

All public classes from headers are listed below.

### Distance and control

- `DistanceSensor`
- `DistanceSensorPimpl` (internal opaque implementation holder)
- `hDoublePID`
- `hDoublePIDRegulator`

### Input matrix and servo driver

- `MatrixButtons`
- `ServoDriver`
- `ServoDriver_Servo`

### IMU and math

- `MPU9250`
- `MPU9250_CLASSNAME` (macro-configurable low-level MPU API class in `mpudmp.h`)
- `Quaternion`
- `VectorInt16`
- `VectorFloat`

## 3. Detailed Class Reference

## DistanceSensor

Header: `hModules/include/DistanceSensor.h`

Purpose:

- HC-SR04-style ultrasonic distance measurement.

Constructor dependency:

- `DistanceSensor(ISensor& sens)`

Key methods:

- `int16_t getDistance()` returns distance in cm.
- Returns `-1` when measurement times out or echo is invalid.

Implementation behavior:

- Uses sensor GPIO + interrupt timing for pulse width.
- Internal `init()` is lazy-called in first read path.

Example workflow:

```cpp
DistanceSensor dist(hSens1);

while (true) {
    int d = dist.getDistance();
    Serial.printf("distance=%d cm\r\n", d);
    sys.delay(200);
}
```

## hDoublePID

Header: `hModules/include/hDoublePID.h`

Purpose:

- Asymmetric PID where positive and negative errors can use different gains.

Constructors:

- `hDoublePID()`
- `hDoublePID(float Kp_pos, float Ki_pos, float Kd_pos, float Kp_neg, float Ki_neg, float Kd_neg)`

Key methods:

- `setScale(float)`
- `setCoeffs(...)`
- `setKPup`, `setKPdown`, `setKIup`, `setKIdown`, `setKDup`, `setKDdown`
- `setRange`, `setRangeMin`, `setRangeMax`
- `setIRange`, `setIRangeMin`, `setIRangeMax`
- `enableI()`, `disableI()`
- `reset()`
- `float update(float error, int dt_ms)`

Usage notes:

- `dt_ms` must match your control-loop period.
- Output and integral clamping should be configured to avoid windup.

## hDoublePIDRegulator

Header: `hModules/include/hDoublePIDRegulator.h`

Purpose:

- hFramework motor regulator wrapper based on `hDoublePID`.

Inheritance:

- `hDoublePIDRegulator : public virtual hRegulator, public hDoublePID`

Public fields used during tuning:

- `stableRange`
- `stableTimes`

Key method:

- `regFuncState regFunct(int32_t encoderNow, int32_t encoderTarget, uint16_t power, int16_t& motorOut)`

Typical use with a motor:

```cpp
hDoublePIDRegulator reg;
reg.setCoeffs(10, 0, 0, 10, 0, 0);
reg.dtMs = 5;
reg.stableRange = 10;
reg.stableTimes = 3;

hMot1.attachPositionRegulator(reg);
hMot1.rotRel(360, 600, true, 5000);
```

## MatrixButtons

Header: `hModules/include/MatrixButtons.h`

Purpose:

- Scan a row/column keypad matrix and run callbacks for pressed keys.

Constructor:

- `MatrixButtons(unsigned int t_width, unsigned int t_height)`

Key methods:

- `addPinOnWidth(hGPIO pin)`
- `addPinOnHeight(hGPIO pin)`
- `addButon(unsigned int poz_width, unsigned int poz_height, std::function<void(void)> function)`
- `init()`
- `update()`

Behavior notes:

- `update()` should be called periodically.
- Built-in software debounce delay is used during scan.

Example workflow:

```cpp
MatrixButtons kb(4, 4);
kb.addPinOnHeight(hSens6.getPin1());
kb.addPinOnHeight(hSens6.getPin2());
kb.addPinOnHeight(hSens6.getPin3());
kb.addPinOnHeight(hSens6.getPin4());

kb.addPinOnWidth(hSens5.getPin1());
kb.addPinOnWidth(hSens5.getPin2());
kb.addPinOnWidth(hSens5.getPin3());
kb.addPinOnWidth(hSens5.getPin4());

kb.addButon(0, 0, []() { Serial.printf("0,0\r\n"); });
kb.init();

while (true) {
    kb.update();
    sys.delay(50);
}
```

## MPU9250

Headers:

- `hModules/include/MPU9250.h`
- `hModules/include/mpudmp.h`
- `hModules/include/helper_3dmath.h`

Purpose:

- 9-axis IMU wrapper with DMP and non-DMP workflows.

Constructor dependency:

- `MPU9250(ISensor_i2c& sens)`

High-level methods:

- `bool initDMP()`
- `bool init()`
- `bool enableInterrupt()` / `bool disableInterrupt()`
- `void waitForData()`
- `bool process()`
- `const hQuaternion& getQuaternion()`
- `bool setGyroScale(GyroScale)`

Low-level API class:

- `MPU9250_CLASSNAME` in `mpudmp.h` exposes extensive register/FIFO/DMP configuration and data extraction methods.

Practical mode selection:

- Use `initDMP()` + `process()` + `getQuaternion()` for orientation-first applications.
- Use `init()` + low-level reads (`getMotion9`, etc.) for raw-data applications.

Example DMP workflow:

```cpp
MPU9250 imu(hSens1);
imu.enableInterrupt();
imu.initDMP();

while (true) {
    imu.waitForData();
    if (imu.process()) {
        const hQuaternion& q = imu.getQuaternion();
        Serial.printf("q=%f %f %f %f\r\n", q.scalar, q.x, q.y, q.z);
    }
}
```

Math helper classes:

- `Quaternion`
- `VectorInt16`
- `VectorFloat`

These provide rotation and normalization helpers used by IMU data paths.

## ServoDriver and ServoDriver_Servo

Header: `hModules/include/ServoDriver/ServoDriver.h`

Purpose:

- Control up to 12 external servos via the servo-driver module.

Constructors:

- `ServoDriver(hExtClass& ext, int address = 0)`
- `ServoDriver(ISerial& serial, int address = 0)`

Key methods:

- `init()`
- `enablePower()`, `disablePower()`
- `setPowerLow()`, `setPowerMedium()`, `setPowerHigh()`, `setPowerUltra()`
- `setWidth(int num, uint16_t widthUs)`
- `setPeriod(uint16_t periodUs)`
- `update()`
- `enableAutoUpdate()`, `disableAutoUpdate()`
- `enableRetransmissions()`, `disableRetransmissions()`
- `getServo(int num)`

Per-servo helper class:

- `ServoDriver_Servo` implements `IServo`
- Methods: `setWidth(uint16_t widthUs)`, `setPeriod(uint16_t periodUs)`

Example workflow:

```cpp
ServoDriver drv(hSens3.serial, 0);
drv.init();
drv.enablePower();
drv.setPowerMedium();

drv.s1.setWidth(1500);
drv.s2.setWidth(1500);
drv.update();
```

## 4. API Quick Tables

### Constructors and dependencies

| Class | Constructor dependency |
| --- | --- |
| DistanceSensor | `ISensor&` |
| hDoublePID | none |
| hDoublePIDRegulator | none |
| MatrixButtons | dimensions + `hGPIO` pins |
| MPU9250 | `ISensor_i2c&` |
| ServoDriver | `hExtClass&` or `ISerial&` |
| ServoDriver_Servo | `ServoDriver&`, servo index |

### Common return semantics

| API | Meaning |
| --- | --- |
| `DistanceSensor::getDistance()` | cm, `-1` on timeout/error |
| `hDoublePID::update()` | clamped control output |
| `hDoublePIDRegulator::regFunct()` | regulator state + motor output |
| `MPU9250::process()` | `true` if valid packet processed |
| `ServoDriver::*` bool methods | command/transport success |

## 5. Integration Patterns

### Pattern A: Distance + motor stop

```cpp
DistanceSensor d(hSens1);

while (true) {
    int cm = d.getDistance();
    if (cm > 0 && cm < 20) {
        hMot1.stop();
    }
    sys.delay(50);
}
```

### Pattern B: IMU + regulator loop

Use IMU orientation to compute heading error, then feed `hDoublePID` or `hDoublePIDRegulator`.

### Pattern C: Servo batch update

Disable auto-update, set multiple channel widths, then call one `update()` to reduce bus traffic.

## 6. Caveats And Troubleshooting

- Keep control-loop `dt_ms` consistent with real loop frequency.
- For MPU9250, choose DMP or raw mode intentionally; do not mix assumptions.
- Matrix scanning callback logic should be short and non-blocking.
- Servo power mode and pulse period must match the physical servo specification.
- On shared serial buses, confirm driver address uniqueness.
