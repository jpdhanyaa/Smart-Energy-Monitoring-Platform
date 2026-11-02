/**
 * ============================================================================
 * AI Smart Energy Management System - ESP32 Firmware
 * Hardware: ESP32 DevKit V1
 * Sensors: ACS712-5A (Current), LDR (Light), HC-SR501 (PIR Motion)
 * Actuators: 5V Relay (Light), BC547/MOSFET PWM (5V Fan), Active Buzzer
 * Status: Red LED (Alert/Comm), Green LED (WiFi/MQTT Online)
 * Protocol: Mosquitto MQTT with JSON Payload & Hardware Acknowledgements
 * ============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ----------------------------------------------------------------------------
// 1. PIN CONFIGURATION (Configurable GPIO Map)
// ----------------------------------------------------------------------------
#define PIN_PIR_MOTION        13    // HC-SR501 Motion Sensor Input
#define PIN_LDR_ADC           34    // LDR Analog Divider Input (ADC1_CH6)
#define PIN_ACS712_ADC        35    // ACS712 Current Sensor Analog Out (ADC1_CH7)
#define PIN_RELAY_LIGHT       26    // Relay Channel 1 (Active LOW or HIGH)
#define PIN_FAN_PWM           27    // BC547 Transistor Base / Gate for Fan PWM
#define PIN_BUZZER            25    // 5V Active Buzzer Alert
#define PIN_LED_RED           32    // System Warning / In-Progress LED
#define PIN_LED_GREEN         33    // WiFi & MQTT Health Indicator LED

// ----------------------------------------------------------------------------
// 2. PWM (LEDC) FAN CONFIGURATION
// ----------------------------------------------------------------------------
#define PWM_CHANNEL           0
#define PWM_FREQ_HZ           5000  // 5 kHz PWM for smooth fan motor rotation
#define PWM_RESOLUTION_BITS   8     // 8-bit resolution (0 - 255)

// ----------------------------------------------------------------------------
// 3. SENSOR CALIBRATION PARAMETERS
// ----------------------------------------------------------------------------
// ACS712-05B sensitivity: 185 mV/A. 
// For ESP32 (3.3V ADC, 12-bit = 4096 counts, ~0.805 mV per count).
// If using voltage divider on ACS712 5V Vout -> 3.3V, ratio = 3.3 / 5.0 = 0.66
const float ACS_SENSITIVITY_MV_PER_A = 185.0; 
const float ADC_VOLTAGE_REF_MV        = 3300.0;
const int   ADC_RESOLUTION_MAX        = 4095;
const float VOLTAGE_DIVIDER_RATIO     = 0.66; // 2k / 1k resistor divider from ACS712 5V output
const float OPERATING_VOLTAGE_V       = 5.0;  // Prototype rail voltage (5V DC)

// Calibration offset (zero current voltage at quiescent point)
int zeroCurrentAdcOffset = 1650; // Calibrated dynamically during setup()

// ----------------------------------------------------------------------------
// 4. NETWORK & MQTT CREDENTIALS
// ----------------------------------------------------------------------------
const char* WIFI_SSID         = "DHANYAA";
const char* WIFI_PASSWORD     = "dhanyaa30";
const char* MQTT_BROKER       = "10.144.0.139"; // Local IP or broker domain
const int   MQTT_PORT         = 1883;
const char* MQTT_USER         = "energy_client";
const char* MQTT_PASS         = "dhanyaa2006";

const char* DEVICE_ID         = "esp32-energy-devkit-01";
const char* TOPIC_TELEMETRY   = "energy/esp32-energy-devkit-01/telemetry";
const char* TOPIC_STATE       = "energy/esp32-energy-devkit-01/state";
const char* TOPIC_COMMANDS    = "energy/esp32-energy-devkit-01/commands";
const char* TOPIC_ACK         = "energy/esp32-energy-devkit-01/ack";
const char* TOPIC_STATUS      = "energy/esp32-energy-devkit-01/status";

// ----------------------------------------------------------------------------
// 5. GLOBAL STATE VARIABLES
// ----------------------------------------------------------------------------
WiFiClient espClient;
PubSubClient mqttClient(espClient);

bool lightOn = false;
bool fanOn = false;
int  fanSpeedPercent = 0; // 0 to 100%
String lightMode = "auto"; // "auto" or "manual"

// Smart Automation Parameters
int  ambientLightThreshold = 350;     // Below this is considered dark
unsigned long inactivityTimeoutMs = 45000; // 45 seconds timeout
unsigned long lastMotionTimestamp = 0;
bool motionState = false;

// Energy Accumulation (Integration over time)
double cumulativeEnergyKWh = 0.0;
unsigned long lastTelemetryMillis = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 1500;

// ----------------------------------------------------------------------------
// 6. FUNCTION DECLARATIONS
// ----------------------------------------------------------------------------
void setupWiFi();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
float readCurrentAmperes();
void calibrateACS712();
void setFanSpeed(int percent);
void setLightState(bool on);
void sendAck(const char* commandId, const char* action, const char* status, const char* message);
void publishConfirmedState();
void publishTelemetry();
void checkLocalAutomation();

// ----------------------------------------------------------------------------
// SETUP
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==========================================");
  Serial.println("  ESP32 AI Smart Energy Management Meter  ");
  Serial.println("==========================================");

  // Configure GPIO Pins
  pinMode(PIN_PIR_MOTION, INPUT);
  pinMode(PIN_LDR_ADC, INPUT);
  pinMode(PIN_ACS712_ADC, INPUT);
  pinMode(PIN_RELAY_LIGHT, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);

  // Initial Safe States
  digitalWrite(PIN_RELAY_LIGHT, LOW); // Relay OFF
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_RED, HIGH);    // Booting indicator
  digitalWrite(PIN_LED_GREEN, LOW);

  // Setup Hardware PWM for Fan using LEDC peripheral
  ledcSetup(PWM_CHANNEL, PWM_FREQ_HZ, PWM_RESOLUTION_BITS);
  ledcAttachPin(PIN_FAN_PWM, PWM_CHANNEL);
  ledcWrite(PWM_CHANNEL, 0); // Fan OFF

  // Calibrate ACS712 zero-current quiescent point
  calibrateACS712();

  // Connect to Network & MQTT
  setupWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GREEN, HIGH);
  Serial.println("ESP32 Energy Node is initialized and running.");
}

// ----------------------------------------------------------------------------
// MAIN LOOP
// ----------------------------------------------------------------------------
void loop() {
  if (!mqttClient.connected()) {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
    reconnectMQTT();
  }
  mqttClient.loop();

  // Run local smart automation rules
  checkLocalAutomation();

  // Periodic Telemetry Publishing
  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryMillis >= TELEMETRY_INTERVAL_MS) {
    publishTelemetry();
    lastTelemetryMillis = currentMillis;
  }
}

// ----------------------------------------------------------------------------
// SENSOR ACQUISITION & CALIBRATION
// ----------------------------------------------------------------------------
void calibrateACS712() {
  Serial.println("Calibrating ACS712 zero-point offset (ensure NO load is active)...");
  long sumAdc = 0;
  const int samples = 200;
  for (int i = 0; i < samples; i++) {
    sumAdc += analogRead(PIN_ACS712_ADC);
    delay(2);
  }
  zeroCurrentAdcOffset = sumAdc / samples;
  Serial.printf("Calibration completed. Zero-point ADC Offset: %d\n", zeroCurrentAdcOffset);
}

float readCurrentAmperes() {
  // Take 80 oversampled readings to filter out ADC analog switching noise
  const int numSamples = 80;
  long sumAdc = 0;
  for (int i = 0; i < numSamples; i++) {
    sumAdc += analogRead(PIN_ACS712_ADC);
    delayMicroseconds(100);
  }
  float avgAdc = (float)sumAdc / numSamples;

  // Convert ADC count difference to millivolts
  float deltaAdc = avgAdc - zeroCurrentAdcOffset;
  float deltaMv = (deltaAdc / ADC_RESOLUTION_MAX) * ADC_VOLTAGE_REF_MV;

  // Account for voltage divider between 5V ACS712 and 3.3V ESP32 ADC
  float sensorOutputDeltaMv = deltaMv / VOLTAGE_DIVIDER_RATIO;

  // Current (A) = V_delta (mV) / Sensitivity (mV/A)
  float currentAmps = fabs(sensorOutputDeltaMv / ACS_SENSITIVITY_MV_PER_A);

  // Noise floor suppression: if below 25mA, treat as quiescent noise
  if (currentAmps < 0.025) {
    currentAmps = 0.045; // Quiescent idle power of board circuitry
  }

  return currentAmps;
}

// ----------------------------------------------------------------------------
// ACTUATOR CONTROL
// ----------------------------------------------------------------------------
void setLightState(bool on) {
  lightOn = on;
  digitalWrite(PIN_RELAY_LIGHT, on ? HIGH : LOW);
  Serial.printf("Relay Light set to: %s\n", on ? "ON" : "OFF");
}

void setFanSpeed(int percent) {
  fanSpeedPercent = constrain(percent, 0, 100);
  fanOn = (fanSpeedPercent > 0);

  // Map 0 - 100% to 8-bit PWM (0 - 255)
  // Brushless 5V fans require at least ~25% duty cycle to overcome rotor stall inertia
  int dutyCycle = 0;
  if (fanSpeedPercent > 0) {
    dutyCycle = map(fanSpeedPercent, 1, 100, 60, 255);
  }
  ledcWrite(PWM_CHANNEL, dutyCycle);
  Serial.printf("Fan PWM Duty: %d/255 (Speed: %d%%)\n", dutyCycle, fanSpeedPercent);
}

// ----------------------------------------------------------------------------
// LOCAL AUTOMATION ENGINE
// ----------------------------------------------------------------------------
void checkLocalAutomation() {
  int pirVal = digitalRead(PIN_PIR_MOTION);
  int ldrRaw = analogRead(PIN_LDR_ADC);

  if (pirVal == HIGH) {
    motionState = true;
    lastMotionTimestamp = millis();
  } else {
    motionState = false;
  }

  // Only execute auto rules if lightMode == "auto"
  if (lightMode == "auto") {
    // Rule: Motion detected & room is dark -> Turn ON
    if (motionState && (ldrRaw < ambientLightThreshold) && !lightOn) {
      Serial.println("[Automation] Motion detected in dark environment -> Turning Light ON");
      setLightState(true);
      publishConfirmedState();
    }
    // Rule: No motion detected for timeout period -> Turn OFF
    else if (!motionState && ((millis() - lastMotionTimestamp) > inactivityTimeoutMs) && lightOn) {
      Serial.println("[Automation] Inactivity timeout expired -> Turning Light OFF");
      setLightState(false);
      publishConfirmedState();
    }
  }
}

// ----------------------------------------------------------------------------
// MQTT COMMUNICATION
// ----------------------------------------------------------------------------
void setupWiFi() {
  Serial.printf("Connecting to WiFi: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi Connected! IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi connection failed. Running in standalone autonomous mode.");
  }
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to Mosquitto MQTT Broker... ");
    String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);

    // Last Will and Testament: if ESP32 disconnects unexpectedly, broker posts "offline"
    StaticJsonDocument<128> lwtDoc;
    lwtDoc["deviceId"] = DEVICE_ID;
    lwtDoc["status"] = "offline";
    char lwtBuffer[128];
    serializeJson(lwtDoc, lwtBuffer);

    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, TOPIC_STATUS, 1, true, lwtBuffer)) {
      Serial.println("Connected!");
      digitalWrite(PIN_LED_GREEN, HIGH);
      digitalWrite(PIN_LED_RED, LOW);

      // Publish Online Status
      StaticJsonDocument<128> statusDoc;
      statusDoc["deviceId"] = DEVICE_ID;
      statusDoc["status"] = "online";
      statusDoc["ip"] = WiFi.localIP().toString();
      char statusBuf[128];
      serializeJson(statusDoc, statusBuf);
      mqttClient.publish(TOPIC_STATUS, statusBuf, true);

      // Subscribe to backend command stream
      mqttClient.subscribe(TOPIC_COMMANDS);
      publishConfirmedState();
    } else {
      Serial.printf("Failed, rc=%d. Retrying in 4 seconds...\n", mqttClient.state());
      delay(4000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Parse incoming JSON command
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.printf("Failed to parse JSON command: %s\n", error.c_str());
    return;
  }

  const char* commandId = doc["commandId"] | "unknown";
  const char* action    = doc["action"] | "";
  Serial.printf("Incoming Command [%s]: %s\n", commandId, action);

  if (strcmp(action, "SET_LIGHT") == 0) {
    bool requestedState = doc["value"].as<bool>();
    setLightState(requestedState);
    sendAck(commandId, action, "SUCCESS", requestedState ? "Light turned ON" : "Light turned OFF");
    publishConfirmedState();
  }
  else if (strcmp(action, "SET_FAN_STATE") == 0) {
    bool requestedFan = doc["value"].as<bool>();
    if (requestedFan) {
      setFanSpeed(fanSpeedPercent > 0 ? fanSpeedPercent : 60);
    } else {
      setFanSpeed(0);
    }
    sendAck(commandId, action, "SUCCESS", requestedFan ? "Fan turned ON" : "Fan turned OFF");
    publishConfirmedState();
  }
  else if (strcmp(action, "SET_FAN_SPEED") == 0) {
    int requestedSpeed = doc["value"].as<int>();
    setFanSpeed(requestedSpeed);
    sendAck(commandId, action, "SUCCESS", "Fan PWM speed updated");
    publishConfirmedState();
  }
  else if (strcmp(action, "SET_MODE") == 0) {
    const char* mode = doc["value"]["mode"] | "auto";
    lightMode = String(mode);
    sendAck(commandId, action, "SUCCESS", "Operating mode updated");
    publishConfirmedState();
  }
  else if (strcmp(action, "CALIBRATE_ACS712") == 0) {
    calibrateACS712();
    sendAck(commandId, action, "SUCCESS", "ACS712 zero-current offset recalibrated");
  }
  else if (strcmp(action, "TRIGGER_BUZZER") == 0) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(400);
    digitalWrite(PIN_BUZZER, LOW);
    sendAck(commandId, action, "SUCCESS", "Buzzer alert pulsed");
  }
}

void sendAck(const char* commandId, const char* action, const char* status, const char* message) {
  StaticJsonDocument<256> doc;
  doc["commandId"] = commandId;
  doc["deviceId"]  = DEVICE_ID;
  doc["action"]    = action;
  doc["status"]    = status;
  doc["message"]   = message;
  doc["timestamp"] = millis();

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_ACK, buffer);
}

void publishConfirmedState() {
  StaticJsonDocument<256> doc;
  doc["deviceId"]        = DEVICE_ID;
  doc["lightOn"]         = lightOn;
  doc["fanOn"]           = fanOn;
  doc["fanSpeedPercent"] = fanSpeedPercent;
  doc["lightMode"]       = lightMode;
  doc["timestamp"]       = millis();

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_STATE, buffer, true);
}

void publishTelemetry() {
  float currentA = readCurrentAmperes();
  float powerW   = currentA * OPERATING_VOLTAGE_V;

  // Energy integration (Power * dt_hours / 1000)
  double dtHours = (TELEMETRY_INTERVAL_MS / 1000.0) / 3600.0;
  cumulativeEnergyKWh += (powerW * dtHours) / 1000.0;

  int ldrAdc = analogRead(PIN_LDR_ADC);

  StaticJsonDocument<512> doc;
  doc["deviceId"]        = DEVICE_ID;
  doc["timestamp"]       = millis();
  doc["currentA"]        = serialized(String(currentA, 3));
  doc["voltageV"]        = (char*)NULL; // No physical PT transformer installed
  doc["powerW"]          = serialized(String(powerW, 2));
  doc["energyKWh"]       = serialized(String(cumulativeEnergyKWh, 5));
  doc["motionDetected"]  = motionState;
  doc["ambientLight"]    = ldrAdc;
  doc["lightOn"]         = lightOn;
  doc["fanOn"]           = fanOn;
  doc["fanSpeedPercent"] = fanSpeedPercent;
  doc["rssi"]            = WiFi.RSSI();

  char buffer[512];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_TELEMETRY, buffer);
}
