/**
 * IoT Simulation & Real-time Hardware Telemetry Engine
 * Simulates physical ESP32 sensor acquisition, PWM fan control, relay switching,
 * energy accumulation, and network command cycles.
 */

import {
  TelemetryReading,
  ApplianceState,
  DeviceCommand,
  AutomationRule,
  MQTTLogMessage,
  GPIOPinConfig,
} from '../types/energy';

export interface HistoricalDataPoint {
  time: string;
  hour?: number;
  currentA: number;
  powerW: number;
  energyKWh: number;
  cumulativeKWh: number;
  fanUsageMinutes?: number;
  lightUsageMinutes?: number;
}

export interface DailyDataPoint {
  date: string;
  dayOfMonth: number;
  dayOfWeek: string;
  isWeekend: boolean;
  totalKWh: number;
  peakPowerW: number;
  lightKWh: number;
  fanKWh: number;
  idleKWh: number;
  costINR: number;
}

export interface MonthlyDataPoint {
  month: string;
  year: number;
  totalKWh: number;
  billINR: number;
  avgDailyKWh: number;
  isCurrent: boolean;
}

// Default hardware pin configuration
export const DEFAULT_GPIO_CONFIG: GPIOPinConfig = {
  pirPin: 13,
  ldrPin: 34,
  acs712Pin: 35,
  relayLightPin: 26,
  fanPwmPin: 27,
  buzzerPin: 25,
  redLedPin: 32,
  greenLedPin: 33,
  acsSensitivityMvPerA: 185,
  zeroCurrentAdcValue: 2048,
  circuitOperatingVoltage: 5.0,
};

// Initial automation rules
export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'rule-pir-dark-light',
    name: 'Smart Night Lighting',
    description: 'Turn light ON automatically when motion is detected and room is dim (LDR < 350).',
    enabled: true,
    conditionType: 'motion_and_dark',
    motionRequired: true,
    lightThreshold: 350,
    actionTarget: 'light',
    actionValue: true,
    lastTriggered: '10 mins ago',
    triggerCount: 24,
  },
  {
    id: 'rule-inactivity-off',
    name: 'Auto-Off Inactivity Timer',
    description: 'Turn light OFF when no motion is detected for more than 45 seconds to conserve power.',
    enabled: true,
    conditionType: 'inactivity_timeout',
    inactivityTimeoutSec: 45,
    actionTarget: 'light',
    actionValue: false,
    lastTriggered: '14 mins ago',
    triggerCount: 19,
  },
  {
    id: 'rule-overcurrent-trip',
    name: 'Hardware Overcurrent Alert',
    description: 'Sound buzzer warning and log safety event if current exceeds 1.8A on the 5V rail.',
    enabled: true,
    conditionType: 'overcurrent_protection',
    currentThresholdA: 1.8,
    actionTarget: 'buzzer',
    actionValue: true,
    triggerCount: 0,
  },
];

class IoTSimulator {
  private applianceState: ApplianceState = {
    lightOn: true,
    fanOn: true,
    fanSpeedPercent: 65,
    lightMode: 'auto',
    autoLightReason: 'Smart Night Lighting rule active',
    fanMode: 'manual',
    lastStateChange: new Date().toISOString(),
  };

  private gpioConfig: GPIOPinConfig = { ...DEFAULT_GPIO_CONFIG };
  private automationRules: AutomationRule[] = [...DEFAULT_AUTOMATION_RULES];
  private isSimulatedMode = true;
  private esp32Connected = true;
  private mqttConnected = true;
  private simulatePacketLoss = false;

  private cumulativeEnergyKWh = 14.85;
  private todayEnergyKWh = 0.485;
  private monthEnergyKWh = 12.64;

  private motionDetected = true;
  private lastMotionTimestamp = Date.now();
  private baseAmbientLight = 240; // LDR ADC (lower = darker)
  private buzzerActive = false;

  private listeners: Array<(reading: TelemetryReading) => void> = [];
  private stateListeners: Array<(state: ApplianceState) => void> = [];
  private logListeners: Array<(msg: MQTTLogMessage) => void> = [];
  private intervalTimer: number | null = null;
  private logs: MQTTLogMessage[] = [];

  // Seeded historical daily data for analytics and ML
  private historicalDaily: DailyDataPoint[] = [];
  private historicalHourly: HistoricalDataPoint[] = [];
  private historicalMonthly: MonthlyDataPoint[] = [];

  constructor() {
    this.initHistory();
    this.startTelemetryLoop();
  }

  private initHistory() {
    // Generate realistic 30-day daily profile
    const days: DailyDataPoint[] = [];
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      // Weekend has higher usage (+25%)
      const baseKWh = isWeekend ? 0.85 : 0.62;
      const variation = (Math.sin(i * 0.7) * 0.12) + ((Math.random() - 0.5) * 0.08);
      const totalKWh = Math.max(0.35, parseFloat((baseKWh + variation).toFixed(3)));
      const lightKWh = parseFloat((totalKWh * 0.38).toFixed(3));
      const fanKWh = parseFloat((totalKWh * 0.44).toFixed(3));
      const idleKWh = parseFloat((totalKWh - lightKWh - fanKWh).toFixed(3));
      const peakPowerW = parseFloat((totalKWh * 3.8 + 2.5 + Math.random()).toFixed(1));
      const costINR = parseFloat((totalKWh * 4.5).toFixed(2));

      days.push({
        date: d.toISOString().split('T')[0],
        dayOfMonth: d.getDate(),
        dayOfWeek: dayNames[d.getDay()],
        isWeekend,
        totalKWh,
        peakPowerW,
        lightKWh,
        fanKWh,
        idleKWh,
        costINR,
      });
    }
    this.historicalDaily = days;

    // Generate 24-hour profile for today
    const hourly: HistoricalDataPoint[] = [];
    const currentHour = now.getHours();
    let rollingCumKWh = 0;

    for (let h = 0; h < 24; h++) {
      // Load profile: morning peak 7-10 AM, evening peak 18-23 PM
      let baseWatts = 0.4;
      if (h >= 7 && h <= 10) baseWatts = 2.4;
      else if (h >= 11 && h <= 17) baseWatts = 1.6;
      else if (h >= 18 && h <= 23) baseWatts = 3.2;
      else baseWatts = 0.35; // Night idle

      const jitter = (Math.random() - 0.5) * 0.3;
      const powerW = Math.max(0.2, parseFloat((baseWatts + jitter).toFixed(2)));
      const currentA = parseFloat((powerW / 5.0).toFixed(3));
      const energyKWh = parseFloat((powerW / 1000).toFixed(4));
      
      if (h <= currentHour) {
        rollingCumKWh += energyKWh;
      }

      hourly.push({
        time: `${String(h).padStart(2, '0')}:00`,
        hour: h,
        currentA: h <= currentHour ? currentA : 0,
        powerW: h <= currentHour ? powerW : 0,
        energyKWh: h <= currentHour ? energyKWh : 0,
        cumulativeKWh: h <= currentHour ? parseFloat(rollingCumKWh.toFixed(4)) : 0,
        fanUsageMinutes: h <= currentHour ? (h >= 12 && h <= 22 ? 45 : 15) : 0,
        lightUsageMinutes: h <= currentHour ? (h >= 18 ? 55 : 10) : 0,
      });
    }
    this.historicalHourly = hourly;

    // Generate last 6 months
    const monthNames = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const monthlyKWhVals = [22.4, 25.1, 26.8, 23.9, 21.5, 24.8];
    this.historicalMonthly = monthNames.map((m, idx) => ({
      month: m,
      year: 2026,
      totalKWh: monthlyKWhVals[idx],
      billINR: Math.round(monthlyKWhVals[idx] * 4.8 + 80),
      avgDailyKWh: parseFloat((monthlyKWhVals[idx] / 30).toFixed(2)),
      isCurrent: idx === monthNames.length - 1,
    }));
  }

  private startTelemetryLoop() {
    if (this.intervalTimer) clearInterval(this.intervalTimer);

    this.intervalTimer = window.setInterval(() => {
      this.evaluateAutomation();
      this.generateAndEmitTelemetry();
    }, 1500);
  }

  private evaluateAutomation() {
    const now = Date.now();
    const timeSinceMotion = (now - this.lastMotionTimestamp) / 1000;

    // Periodic motion simulator: occasionally flip motion to create dynamic life
    if (Math.random() < 0.08) {
      this.motionDetected = true;
      this.lastMotionTimestamp = now;
    } else if (timeSinceMotion > 30) {
      this.motionDetected = false;
    }

    // Evaluate active automation rules
    this.automationRules.forEach((rule) => {
      if (!rule.enabled) return;

      if (rule.conditionType === 'motion_and_dark') {
        const isDark = this.baseAmbientLight < (rule.lightThreshold || 350);
        if (this.motionDetected && isDark && this.applianceState.lightMode === 'auto') {
          if (!this.applianceState.lightOn) {
            this.applianceState.lightOn = true;
            this.applianceState.autoLightReason = `Motion detected in dim room (LDR: ${this.baseAmbientLight} < ${rule.lightThreshold})`;
            rule.lastTriggered = 'Just now';
            rule.triggerCount++;
            this.logMQTT('state', { lightOn: true, reason: this.applianceState.autoLightReason }, 'inbound');
            this.emitState();
          }
        }
      }

      if (rule.conditionType === 'inactivity_timeout') {
        const timeout = rule.inactivityTimeoutSec || 45;
        if (!this.motionDetected && timeSinceMotion > timeout && this.applianceState.lightMode === 'auto') {
          if (this.applianceState.lightOn) {
            this.applianceState.lightOn = false;
            this.applianceState.autoLightReason = `No motion for ${Math.round(timeSinceMotion)}s (Timeout: ${timeout}s)`;
            rule.lastTriggered = 'Just now';
            rule.triggerCount++;
            this.logMQTT('state', { lightOn: false, reason: this.applianceState.autoLightReason }, 'inbound');
            this.emitState();
          }
        }
      }
    });
  }

  private generateAndEmitTelemetry() {
    if (!this.esp32Connected) return;

    // Realistic current calculation
    // Base idle (ESP32 + sensors) = 0.045A
    let current = 0.045;
    if (this.applianceState.lightOn) {
      current += 0.22; // 5V LED lamp
    }
    if (this.applianceState.fanOn) {
      // Fan speed PWM 0 - 100%: 0.12A to 0.48A
      const fanRatio = this.applianceState.fanSpeedPercent / 100;
      current += 0.12 + 0.36 * fanRatio;
    }

    // Add realistic analog noise (+/- 0.012A)
    const noise = (Math.random() - 0.5) * 0.024;
    current = Math.max(0.01, parseFloat((current + noise).toFixed(3)));

    const voltage = this.gpioConfig.circuitOperatingVoltage;
    const powerW = parseFloat((current * voltage).toFixed(3));

    // Time delta for integration (1.5 seconds)
    const dtHours = 1.5 / 3600;
    const deltaKWh = (powerW * dtHours) / 1000;
    this.cumulativeEnergyKWh = parseFloat((this.cumulativeEnergyKWh + deltaKWh).toFixed(5));
    this.todayEnergyKWh = parseFloat((this.todayEnergyKWh + deltaKWh).toFixed(5));
    this.monthEnergyKWh = parseFloat((this.monthEnergyKWh + deltaKWh).toFixed(5));

    // Ambient light calculation: if light is on, lux goes up!
    let effectiveAmbient = this.baseAmbientLight;
    if (this.applianceState.lightOn) {
      effectiveAmbient = Math.min(1023, effectiveAmbient + 280);
    }
    const ambientLux = Math.round((effectiveAmbient / 1023) * 650);

    const reading: TelemetryReading = {
      deviceId: 'esp32-energy-devkit-01',
      timestamp: new Date().toISOString(),
      currentA: current,
      voltageV: null, // Note: ACS712 measures current only; voltage is circuit reference
      voltageEstimated: voltage,
      powerW,
      isPowerEstimated: true,
      energyKWh: this.cumulativeEnergyKWh,
      todayKWh: this.todayEnergyKWh,
      monthKWh: this.monthEnergyKWh,
      motionDetected: this.motionDetected,
      ambientLight: effectiveAmbient,
      ambientLux,
      lightOn: this.applianceState.lightOn,
      fanOn: this.applianceState.fanOn,
      fanSpeedPercent: this.applianceState.fanSpeedPercent,
      deviceMode: this.isSimulatedMode ? 'simulated' : 'physical',
      rssi: -58 + Math.floor((Math.random() - 0.5) * 4),
      uptimeSeconds: Math.floor(performance.now() / 1000) + 7240,
    };

    // Broadcast reading
    this.listeners.forEach((cb) => cb(reading));

    // Every ~6 seconds log telemetry to MQTT stream
    if (Math.random() < 0.25) {
      this.logMQTT('telemetry', {
        deviceId: reading.deviceId,
        timestamp: reading.timestamp,
        currentA: reading.currentA,
        voltageV: reading.voltageV,
        powerW: reading.powerW,
        energyKWh: reading.energyKWh,
        motionDetected: reading.motionDetected,
        ambientLight: reading.ambientLight,
        lightOn: reading.lightOn,
        fanOn: reading.fanOn,
        fanSpeedPercent: reading.fanSpeedPercent,
      }, 'inbound');
    }
  }

  /**
   * Dispatches a command to ESP32 with full lifecycle:
   * 1. Validate
   * 2. Send via MQTT
   * 3. Await ESP32 Acknowledgement
   * 4. Confirm State
   */
  public async dispatchCommand(
    action: DeviceCommand['action'],
    value: DeviceCommand['value']
  ): Promise<{ success: boolean; message: string; command: DeviceCommand }> {
    const commandId = 'cmd-' + Math.random().toString(36).substring(2, 9);
    const timestamp = new Date().toISOString();

    const cmd: DeviceCommand = {
      commandId,
      deviceId: 'esp32-energy-devkit-01',
      action,
      value,
      timestamp,
      status: 'pending',
    };

    this.logMQTT('command', {
      commandId,
      deviceId: cmd.deviceId,
      action,
      value,
      timestamp,
    }, 'outbound');

    // Simulate network packet loss test mode
    if (this.simulatePacketLoss) {
      await new Promise((r) => setTimeout(r, 2200));
      cmd.status = 'timeout';
      cmd.errorMessage = 'ESP32 device failed to acknowledge within 2000ms window.';
      return {
        success: false,
        message: 'Command timeout: No ACK received from ESP32 hardware.',
        command: cmd,
      };
    }

    // Realistic round-trip time (280ms - 450ms)
    const latency = 280 + Math.floor(Math.random() * 170);
    await new Promise((r) => setTimeout(r, latency));

    // Execute on virtual ESP32
    if (action === 'SET_LIGHT') {
      this.applianceState.lightOn = Boolean(value);
      this.applianceState.lastStateChange = new Date().toISOString();
      if (this.applianceState.lightMode === 'auto') {
        this.applianceState.autoLightReason = 'Manual override activated by user';
      }
    } else if (action === 'SET_FAN_STATE') {
      this.applianceState.fanOn = Boolean(value);
      this.applianceState.lastStateChange = new Date().toISOString();
    } else if (action === 'SET_FAN_SPEED') {
      const speed = Math.max(0, Math.min(100, Number(value)));
      this.applianceState.fanSpeedPercent = speed;
      if (speed > 0 && !this.applianceState.fanOn) {
        this.applianceState.fanOn = true;
      } else if (speed === 0) {
        this.applianceState.fanOn = false;
      }
      this.applianceState.lastStateChange = new Date().toISOString();
    } else if (action === 'SET_MODE') {
      const { target, mode } = value as unknown as { target: 'light' | 'fan'; mode: 'manual' | 'auto' };
      if (target === 'light') {
        this.applianceState.lightMode = mode;
        if (mode === 'auto') {
          this.applianceState.autoLightReason = 'Automatic PIR + LDR sensor control engaged';
        }
      } else {
        this.applianceState.fanMode = mode;
      }
    } else if (action === 'TRIGGER_BUZZER') {
      this.buzzerActive = true;
      setTimeout(() => {
        this.buzzerActive = false;
      }, 1200);
    } else if (action === 'CALIBRATE_ACS712') {
      this.gpioConfig.zeroCurrentAdcValue = 2048 + Math.floor((Math.random() - 0.5) * 10);
    }

    cmd.status = 'acknowledged';
    cmd.responseTimeMs = latency;

    // ESP32 sends ACK and confirmed state
    this.logMQTT('ack', {
      commandId,
      status: 'SUCCESS',
      deviceId: cmd.deviceId,
      action,
      responseTimeMs: latency,
    }, 'inbound');

    this.logMQTT('state', {
      deviceId: cmd.deviceId,
      lightOn: this.applianceState.lightOn,
      fanOn: this.applianceState.fanOn,
      fanSpeedPercent: this.applianceState.fanSpeedPercent,
      lightMode: this.applianceState.lightMode,
      updatedAt: new Date().toISOString(),
    }, 'inbound');

    this.emitState();

    return {
      success: true,
      message: `ESP32 successfully executed ${action} (${latency}ms roundtrip)`,
      command: cmd,
    };
  }

  private logMQTT(
    type: MQTTLogMessage['type'],
    payload: Record<string, unknown> | string,
    direction: MQTTLogMessage['direction']
  ) {
    const topic = `energy/esp32-energy-devkit-01/${type === 'command' ? 'commands' : type}`;
    const logItem: MQTTLogMessage = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      topic,
      type,
      payload,
      direction,
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 80) this.logs.pop();
    this.logListeners.forEach((cb) => cb(logItem));
  }

  // State emitters
  private emitState() {
    const copy = { ...this.applianceState };
    this.stateListeners.forEach((cb) => cb(copy));
  }

  // Public getters and setters
  public subscribeTelemetry(cb: (reading: TelemetryReading) => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public subscribeState(cb: (state: ApplianceState) => void) {
    this.stateListeners.push(cb);
    cb({ ...this.applianceState });
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== cb);
    };
  }

  public subscribeLogs(cb: (msg: MQTTLogMessage) => void) {
    this.logListeners.push(cb);
    return () => {
      this.logListeners = this.logListeners.filter((l) => l !== cb);
    };
  }

  public getApplianceState(): ApplianceState {
    return { ...this.applianceState };
  }

  public getGPIOConfig(): GPIOPinConfig {
    return { ...this.gpioConfig };
  }

  public setGPIOConfig(cfg: GPIOPinConfig) {
    this.gpioConfig = { ...cfg };
  }

  public getAutomationRules(): AutomationRule[] {
    return [...this.automationRules];
  }

  public updateAutomationRule(rule: AutomationRule) {
    const idx = this.automationRules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.automationRules[idx] = { ...rule };
    } else {
      this.automationRules.push(rule);
    }
  }

  public deleteAutomationRule(ruleId: string) {
    this.automationRules = this.automationRules.filter((r) => r.id !== ruleId);
  }

  public triggerMotionPulse() {
    this.motionDetected = true;
    this.lastMotionTimestamp = Date.now();
    this.evaluateAutomation();
  }

  public setAmbientLight(adcVal: number) {
    this.baseAmbientLight = Math.max(0, Math.min(1023, adcVal));
  }

  public setSimulatedMode(sim: boolean) {
    this.isSimulatedMode = sim;
  }

  public getIsSimulatedMode(): boolean {
    return this.isSimulatedMode;
  }

  public setSimulatePacketLoss(loss: boolean) {
    this.simulatePacketLoss = loss;
  }

  public getSimulatePacketLoss(): boolean {
    return this.simulatePacketLoss;
  }

  public setESP32Connected(conn: boolean) {
    this.esp32Connected = conn;
  }

  public getESP32Connected(): boolean {
    return this.esp32Connected;
  }

  public setMQTTConnected(conn: boolean) {
    this.mqttConnected = conn;
  }

  public getMQTTConnected(): boolean {
    return this.mqttConnected;
  }

  public getHistoricalDaily(): DailyDataPoint[] {
    return [...this.historicalDaily];
  }

  public getHistoricalHourly(): HistoricalDataPoint[] {
    return [...this.historicalHourly];
  }

  public getHistoricalMonthly(): MonthlyDataPoint[] {
    return [...this.historicalMonthly];
  }

  public getLogs(): MQTTLogMessage[] {
    return [...this.logs];
  }

  public isBuzzerSounding(): boolean {
    return this.buzzerActive;
  }
}

export const iotSimulator = new IoTSimulator();
