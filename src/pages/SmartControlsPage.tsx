import React, { useState } from 'react';
import {
  Lightbulb,
  Fan,
  Sliders,
  Sparkles,
  Eye,
  Sun,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
} from 'lucide-react';
import { ApplianceState, TelemetryReading } from '../types/energy';
import { iotSimulator } from '../services/iotSimulator';
import { useToast } from '../components/common/ToastContainer';

interface SmartControlsPageProps {
  applianceState: ApplianceState;
  telemetry: TelemetryReading;
}

export const SmartControlsPage: React.FC<SmartControlsPageProps> = ({
  applianceState,
  telemetry,
}) => {
  const { addToast } = useToast();

  const [isLightPending, setIsLightPending] = useState(false);
  const [isFanPending, setIsFanPending] = useState(false);
  const [fanSliderValue, setFanSliderValue] = useState(applianceState.fanSpeedPercent || 65);

  // Automation rule thresholds
  const [ambientThreshold, setAmbientThreshold] = useState(350);
  const [inactivityTimeout, setInactivityTimeout] = useState(45);
  const [autoLightingEnabled, setAutoLightingEnabled] = useState(applianceState.lightMode === 'auto');

  // 1. Light Control Handler
  const handleToggleLight = async (desiredState: boolean) => {
    setIsLightPending(true);
    try {
      const res = await iotSimulator.dispatchCommand('SET_LIGHT', desiredState);
      if (res.success) {
        addToast({
          type: 'success',
          title: `Light ${desiredState ? 'Turned ON' : 'Turned OFF'}`,
          message: res.message,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Command Failed',
          message: res.message,
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Communication Error',
        message: err?.message || 'ESP32 device failed to respond.',
      });
    } finally {
      setIsLightPending(false);
    }
  };

  // 2. Light Mode Toggle (Manual vs Auto)
  const handleToggleAutoMode = async (enabled: boolean) => {
    const mode = enabled ? 'auto' : 'manual';
    setAutoLightingEnabled(enabled);
    try {
      await iotSimulator.dispatchCommand('SET_MODE', { target: 'light', mode });
      addToast({
        type: 'info',
        title: enabled ? 'Automatic Lighting Engaged' : 'Manual Mode Activated',
        message: enabled
          ? 'Light will respond to PIR motion and ambient darkness.'
          : 'Manual user control active.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Mode Switch Failed',
        message: err?.message,
      });
    }
  };

  // 3. Fan Power Toggle
  const handleToggleFan = async (desiredState: boolean) => {
    setIsFanPending(true);
    try {
      const res = await iotSimulator.dispatchCommand('SET_FAN_STATE', desiredState);
      if (res.success) {
        addToast({
          type: 'success',
          title: `Fan ${desiredState ? 'Started' : 'Stopped'}`,
          message: res.message,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Command Failed',
          message: res.message,
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Communication Error',
        message: err?.message || 'ESP32 device failed to respond.',
      });
    } finally {
      setIsFanPending(false);
    }
  };

  // 4. Fan Speed Change (PWM)
  const handleFanSpeedChange = async (speed: number) => {
    setFanSliderValue(speed);
    try {
      const res = await iotSimulator.dispatchCommand('SET_FAN_SPEED', speed);
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Fan Speed Confirmed',
          message: `ESP32 PWM duty set to ${Math.round((speed / 100) * 255)}/255 (${speed}%)`,
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Speed Update Failed',
        message: err?.message,
      });
    }
  };

  // 5. Update Automation Thresholds
  const handleUpdateThresholds = (threshold: number, timeout: number) => {
    setAmbientThreshold(threshold);
    setInactivityTimeout(timeout);
    const rules = iotSimulator.getAutomationRules();
    rules.forEach((r) => {
      if (r.conditionType === 'motion_and_dark') {
        r.lightThreshold = threshold;
        iotSimulator.updateAutomationRule(r);
      } else if (r.conditionType === 'inactivity_timeout') {
        r.inactivityTimeoutSec = timeout;
        iotSimulator.updateAutomationRule(r);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Section Intro */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#5C94ED]" />
            Smart Appliance & Automation Controls
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-3.5 py-1.5 rounded-xl bg-[#8BF0F0]/50 text-[#0F766E] border-2 border-[#A2D8E2] flex items-center gap-1.5 font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#0D9488] animate-pulse"></span>
            ESP32 Synchronized
          </span>
        </div>
      </div>

      {/* Main Grid: Light Control & Fan Control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PANEL 1: LIGHT CONTROL */}
        <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#A2D8E2]/40">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-2xl transition-all ${
                    applianceState.lightOn
                      ? 'bg-gradient-to-tr from-[#5C94ED] via-[#8BF0F0] to-[#CBE5F6] text-[#0F172A] shadow-md shadow-[#5C94ED]/30'
                      : 'bg-[#CBE5F6]/40 text-slate-400 border border-[#A2D8E2]'
                  }`}
                >
                  <Lightbulb className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#0F172A]">Light Appliance</h3>
                  <p className="text-xs text-[#5C94ED] font-mono font-semibold">
                    5V Relay • GPIO 26 • Optocoupled
                  </p>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center bg-[#EBF5FC] rounded-xl p-1 border border-[#A2D8E2] text-xs">
                <button
                  onClick={() => handleToggleAutoMode(true)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    applianceState.lightMode === 'auto'
                      ? 'bg-[#5C94ED] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Auto
                </button>
                <button
                  onClick={() => handleToggleAutoMode(false)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    applianceState.lightMode === 'manual'
                      ? 'bg-[#CBE5F6] text-[#1E3A8A] border border-[#A2D8E2] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

            {/* Confirmed State Box */}
            <div className="my-5 p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-semibold">Hardware Confirmed Status:</span>
                <span
                  className={`font-mono font-bold px-2.5 py-0.5 rounded text-xs border ${
                    applianceState.lightOn
                      ? 'bg-[#8BF0F0]/50 text-[#0F766E] border-[#A2D8E2]'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {applianceState.lightOn ? 'LIGHT IS ON' : 'LIGHT IS OFF'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Operating Mode:</span>
                <span className="font-mono text-[#5C94ED] font-bold capitalize">
                  {applianceState.lightMode === 'auto' ? 'Automatic (Sensor Control)' : 'Manual Override'}
                </span>
              </div>

              {applianceState.lightMode === 'auto' && applianceState.autoLightReason && (
                <div className="pt-2 border-t border-[#A2D8E2]/40">
                  <span className="text-slate-500 block mb-1">Auto Trigger Note:</span>
                  <p className="text-[11px] font-mono text-[#1E40AF] italic bg-[#CBE5F6] p-2 rounded-lg border border-[#A2D8E2]">
                    {applianceState.autoLightReason}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleToggleLight(true)}
              disabled={isLightPending || applianceState.lightOn}
              className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                applianceState.lightOn
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-[#5C94ED] hover:bg-[#4E84D9] text-white shadow-md shadow-[#5C94ED]/20'
              } ${isLightPending ? 'opacity-60 cursor-wait' : ''}`}
            >
              {isLightPending && !applianceState.lightOn ? (
                <span>Sending CMD...</span>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Turn ON Light
                </>
              )}
            </button>

            <button
              onClick={() => handleToggleLight(false)}
              disabled={isLightPending || !applianceState.lightOn}
              className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                !applianceState.lightOn
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-[#FFE4E6] hover:bg-[#FECDD3] text-[#BE123C] border border-[#FDA4AF]'
              } ${isLightPending ? 'opacity-60 cursor-wait' : ''}`}
            >
              {isLightPending && applianceState.lightOn ? (
                <span>Sending CMD...</span>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Turn OFF Light
                </>
              )}
            </button>
          </div>
        </div>

        {/* PANEL 2: FAN SPEED (PWM) CONTROL */}
        <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#A2D8E2]/40">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-2xl transition-all ${
                    applianceState.fanOn
                      ? 'bg-gradient-to-tr from-[#5C94ED] via-[#8BF0F0] to-[#CBE5F6] text-[#0F172A] shadow-md shadow-[#5C94ED]/30'
                      : 'bg-[#CBE5F6]/40 text-slate-400 border border-[#A2D8E2]'
                  }`}
                >
                  <Fan className={`w-6 h-6 ${applianceState.fanOn ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#0F172A]">DC Fan Speed Control</h3>
                  <p className="text-xs text-[#5C94ED] font-mono font-semibold">
                    PWM Hardware Timer • GPIO 27 • BC547 Driver
                  </p>
                </div>
              </div>

              <span
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border-2 ${
                  applianceState.fanOn
                    ? 'bg-[#8BF0F0]/50 text-[#0F766E] border-[#A2D8E2]'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}
              >
                {applianceState.fanOn ? `${applianceState.fanSpeedPercent}% SPEED` : 'STOPPED'}
              </span>
            </div>

            {/* Confirmed State & Slider Box */}
            <div className="my-5 p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-semibold">PWM Register Duty:</span>
                <span className="font-mono text-[#1E3A8A] font-bold">
                  {Math.round((applianceState.fanSpeedPercent / 100) * 255)} / 255 (8-bit)
                </span>
              </div>

              {/* Continuous Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-slate-800 font-bold">Adjust Speed (0% - 100%):</label>
                  <span className="font-mono text-[#5C94ED] font-extrabold text-sm">{fanSliderValue}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={fanSliderValue}
                  disabled={!applianceState.fanOn}
                  onChange={(e) => setFanSliderValue(Number(e.target.value))}
                  onMouseUp={() => handleFanSpeedChange(fanSliderValue)}
                  onTouchEnd={() => handleFanSpeedChange(fanSliderValue)}
                  className={`w-full h-6 bg-transparent cursor-pointer ${
                    !applianceState.fanOn ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              {/* Presets in Ice Blue / Powder Blue / Cornflower */}
              <div className="pt-1">
                <span className="text-slate-600 font-semibold text-[11px] block mb-1.5">Speed Presets:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Low (30%)', value: 30 },
                    { label: 'Medium (65%)', value: 65 },
                    { label: 'High (100%)', value: 100 },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleFanSpeedChange(preset.value)}
                      disabled={!applianceState.fanOn}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                        applianceState.fanSpeedPercent === preset.value && applianceState.fanOn
                          ? 'bg-[#5C94ED] text-white border-[#5C94ED] shadow-xs'
                          : 'bg-white text-slate-700 hover:text-[#5C94ED] hover:bg-[#CBE5F6]/40 border-[#A2D8E2]'
                      } ${!applianceState.fanOn ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Master Fan ON/OFF button */}
          <div className="pt-2">
            <button
              onClick={() => handleToggleFan(!applianceState.fanOn)}
              disabled={isFanPending}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                applianceState.fanOn
                  ? 'bg-[#FFE4E6] hover:bg-[#FECDD3] text-[#BE123C] border border-[#FDA4AF]'
                  : 'bg-[#5C94ED] hover:bg-[#4E84D9] text-white shadow-md shadow-[#5C94ED]/20'
              } ${isFanPending ? 'opacity-60 cursor-wait' : ''}`}
            >
              <Fan className="w-4 h-4" />
              {applianceState.fanOn ? 'Stop DC Fan' : 'Turn ON Fan (Resume Speed)'}
            </button>
          </div>
        </div>
      </div>

      {/* PANEL 3: AUTOMATION RULES & THRESHOLDS */}
      <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)] space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-[#A2D8E2]/40 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#8BF0F0]/50 text-[#0F766E] border-2 border-[#A2D8E2]">
              <Sparkles className="w-5 h-5 text-[#0F766E]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">Automatic Smart Lighting Rules</h3>
              <p className="text-xs text-slate-600">
                Autonomous PIR motion (GPIO 13) and LDR darkness (GPIO 34) execution on ESP32.
              </p>
            </div>
          </div>

          {/* Master Enable / Disable Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-700 font-bold">Automatic Lighting:</span>
            <button
              onClick={() => handleToggleAutoMode(!autoLightingEnabled)}
              className="p-1 text-[#5C94ED] hover:text-[#4E84D9] transition-colors"
            >
              {autoLightingEnabled ? (
                <ToggleRight className="w-9 h-9 text-[#5C94ED]" />
              ) : (
                <ToggleLeft className="w-9 h-9 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Live Sensor Status Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] flex items-center justify-between">
            <span className="text-slate-700 flex items-center gap-2 font-bold">
              <Sun className="w-4 h-4 text-amber-500" />
              Ambient LDR Reading
            </span>
            <span className="font-mono text-[#1E3A8A] font-extrabold">
              {telemetry.ambientLight} ADC (~{telemetry.ambientLux} Lux)
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] flex items-center justify-between">
            <span className="text-slate-700 flex items-center gap-2 font-bold">
              <Eye className="w-4 h-4 text-[#5C94ED]" />
              PIR Motion State
            </span>
            <span
              className={`font-mono font-bold px-2.5 py-0.5 rounded text-[11px] border ${
                telemetry.motionDetected
                  ? 'bg-[#8BF0F0]/50 text-[#0F766E] border-[#A2D8E2]'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {telemetry.motionDetected ? 'MOTION DETECTED' : 'ROOM IDLE'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] flex items-center justify-between">
            <span className="text-slate-700 flex items-center gap-2 font-bold">
              <ShieldCheck className="w-4 h-4 text-[#5C94ED]" />
              Relay Protection
            </span>
            <span className="font-mono text-[#1E40AF] font-extrabold">Hysteresis Active</span>
          </div>
        </div>

        {/* Threshold Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Ambient Darkness Threshold Slider */}
          <div className="p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                Darkness Trigger Threshold:
              </label>
              <span className="font-mono text-[#5C94ED] font-extrabold">{ambientThreshold} ADC</span>
            </div>
            <input
              type="range"
              min="100"
              max="700"
              step="10"
              value={ambientThreshold}
              onChange={(e) => handleUpdateThresholds(Number(e.target.value), inactivityTimeout)}
              className="w-full h-6 bg-transparent cursor-pointer"
            />
            <p className="text-[11px] text-slate-600 leading-tight">
              Turn Light ON automatically when room is darker than this threshold and motion is detected.
            </p>
          </div>

          {/* Inactivity Timeout Slider */}
          <div className="p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#5C94ED]" />
                Inactivity Auto-OFF Timeout:
              </label>
              <span className="font-mono text-[#1E3A8A] font-extrabold">{inactivityTimeout} seconds</span>
            </div>
            <input
              type="range"
              min="15"
              max="180"
              step="5"
              value={inactivityTimeout}
              onChange={(e) => handleUpdateThresholds(ambientThreshold, Number(e.target.value))}
              className="w-full h-6 bg-transparent cursor-pointer"
            />
            <p className="text-[11px] text-slate-600 leading-tight">
              Turn Light OFF automatically when no room motion is detected for this duration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
