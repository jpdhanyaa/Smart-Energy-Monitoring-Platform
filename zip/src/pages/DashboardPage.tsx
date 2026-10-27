import React, { useState, useEffect } from 'react';
import {
  Zap,
  Activity,
  Gauge,
  Calendar,
  IndianRupee,
  Cpu,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
} from 'recharts';

import { MetricCard } from '../components/common/MetricCard';
import { TelemetryReading, ApplianceState } from '../types/energy';
import { MLForecasterService } from '../services/mlForecaster';

interface DashboardPageProps {
  telemetry: TelemetryReading;
  applianceState: ApplianceState;
  onNavigatePage: (page: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  telemetry,
  applianceState,
  onNavigatePage,
}) => {
  // 10-Minute Interval Waveform data stream
  const [tenMinuteWindow, setTenMinuteWindow] = useState<
    Array<{ time: string; currentA: number; powerW: number; intervalLabel: string }>
  >(() => {
    // Initialize with 18 historical 10-minute slots leading up to now (3 hours of 10-min bins)
    const points: Array<{ time: string; currentA: number; powerW: number; intervalLabel: string }> = [];
    const now = new Date();
    for (let i = 17; i >= 0; i--) {
      const slotTime = new Date(now.getTime() - i * 10 * 60 * 1000);
      const minutes = Math.floor(slotTime.getMinutes() / 10) * 10;
      slotTime.setMinutes(minutes, 0, 0);
      const timeStr = slotTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const variance = Math.sin(i * 0.7) * 0.35;
      const basePower = Math.max(0.3, parseFloat((telemetry.powerW * (0.88 + variance * 0.25)).toFixed(2)));
      const baseCurrent = Math.max(0.06, parseFloat((basePower / 5.0).toFixed(3)));

      points.push({
        time: timeStr,
        intervalLabel: i === 0 ? `${timeStr} (Active)` : timeStr,
        currentA: i === 0 ? telemetry.currentA : baseCurrent,
        powerW: i === 0 ? telemetry.powerW : basePower,
      });
    }
    return points;
  });

  // Dynamically update the current 10-minute slot with live ESP32 telemetry
  useEffect(() => {
    setTenMinuteWindow((prev) => {
      const now = new Date();
      const currentMinuteBlock = Math.floor(now.getMinutes() / 10) * 10;
      const currentSlotTime = new Date(now);
      currentSlotTime.setMinutes(currentMinuteBlock, 0, 0);
      const currentSlotStr = currentSlotTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (prev.length === 0) return prev;

      const lastPoint = prev[prev.length - 1];

      if (lastPoint && lastPoint.time === currentSlotStr) {
        // Update current 10-min interval live
        const updated = [...prev];
        updated[updated.length - 1] = {
          time: currentSlotStr,
          intervalLabel: `${currentSlotStr} (Live)`,
          currentA: telemetry.currentA,
          powerW: telemetry.powerW,
        };
        return updated;
      } else {
        // Transition into a new 10-min interval bin
        const next = [
          ...prev,
          {
            time: currentSlotStr,
            intervalLabel: `${currentSlotStr} (Live)`,
            currentA: telemetry.currentA,
            powerW: telemetry.powerW,
          },
        ];
        return next.length > 18 ? next.slice(next.length - 18) : next;
      }
    });
  }, [telemetry]);

  const mlForecast = MLForecasterService.generateForecast('Random Forest Regressor');

  return (
    <div className="space-y-6">
      {/* 1. Header with Hardware Connection Status (Clean without color palette circles) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#5C94ED]" />
            <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A]">
              Live Energy Dashboard
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Real-time electricity monitoring via ESP32 DevKit V1 and ACS712 Hall-effect sensor.
          </p>
        </div>

        {/* ESP32 Hardware Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#CBE5F6]/70 border-2 border-[#A2D8E2] text-xs font-mono shadow-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5C94ED] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#5C94ED]"></span>
            </span>
            <span className="text-[#1E293B] font-extrabold">ESP32 Online</span>
            <span className="text-[#A2D8E2]">•</span>
            <span className="text-slate-600 text-[11px] font-semibold">
              Sync: {new Date(telemetry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Core 6 Live Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Metric 1: Live Current */}
        <MetricCard
          title="Current Consumption"
          value={telemetry.currentA.toFixed(3)}
          unit="A"
          icon={Activity}
          iconColor="text-[#5C94ED]"
          glowColor="blue"
          isMeasured={true}
          subLabel="ACS712 Sensor"
          subValue="Analog Sampling"
        />

        {/* Metric 2: Estimated Power */}
        <MetricCard
          title="Power Consumption"
          value={telemetry.powerW.toFixed(2)}
          unit="W"
          icon={Zap}
          iconColor="text-[#0284C7]"
          glowColor="cyan"
          isEstimated={true}
          subLabel="Reference Rail"
          subValue={`${telemetry.voltageEstimated.toFixed(1)}V DC`}
        />

        {/* Metric 3: Accumulated Energy */}
        <MetricCard
          title="Accumulated Energy"
          value={telemetry.energyKWh.toFixed(3)}
          unit="kWh"
          icon={Gauge}
          iconColor="text-[#0D9488]"
          glowColor="emerald"
          subLabel="Total Integrated"
          subValue="Time Integration"
        />

        {/* Metric 4: Today's Consumption */}
        <MetricCard
          title="Today's Consumption"
          value={telemetry.todayKWh.toFixed(3)}
          unit="kWh"
          icon={Calendar}
          iconColor="text-[#2563EB]"
          glowColor="blue"
          subLabel="Since 00:00 UTC"
          subValue={`₹${(telemetry.todayKWh * 4.5).toFixed(2)} est.`}
        />

        {/* Metric 5: Current Month's Consumption */}
        <MetricCard
          title="Current Month Usage"
          value={telemetry.monthKWh.toFixed(2)}
          unit="kWh"
          icon={Calendar}
          iconColor="text-[#7C3AED]"
          glowColor="purple"
          subLabel="Month to Date"
          subValue="Calendar Cycle"
        />

        {/* Metric 6: Estimated Monthly Electricity Bill */}
        <MetricCard
          title="Est. Monthly Bill"
          value={`₹${mlForecast.estimatedBillINR}`}
          icon={IndianRupee}
          iconColor="text-[#059669]"
          glowColor="emerald"
          subLabel="Projected Total"
          subValue={`${mlForecast.currentMonthForecastKWh.toFixed(1)} kWh`}
        />
      </div>

      {/* 3. Live Energy Graph with Cornflower & Soft Cyan Palette */}
      <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#5C94ED]" />
              10-Minute Interval Consumption Waveform
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Energy and power profile recorded in 10-minute intervals with active ESP32 load tracking.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-[#8BF0F0]/50 text-[#0F766E] border border-[#A2D8E2] font-bold">
              Interval: 10 mins
            </span>
            <span className="flex items-center gap-1.5 text-[#1E40AF] font-bold bg-[#CBE5F6]/60 px-2.5 py-1 rounded-lg border border-[#A2D8E2]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#5C94ED]"></span>
              Power: {telemetry.powerW.toFixed(2)} W
            </span>
            <span className="flex items-center gap-1.5 text-[#0F766E] font-bold bg-[#8BF0F0]/40 px-2.5 py-1 rounded-lg border border-[#A2D8E2]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#8BF0F0]"></span>
              Current: {telemetry.currentA.toFixed(3)} A
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tenMinuteWindow}>
              <defs>
                <linearGradient id="dashboardPowerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5C94ED" stopOpacity={0.45} />
                  <stop offset="60%" stopColor="#8BF0F0" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#CBE5F6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#A2D8E2" strokeOpacity={0.35} />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" stroke="#5C94ED" tick={{ fontSize: 10 }} unit="W" />
              <YAxis yAxisId="right" orientation="right" stroke="#0D9488" tick={{ fontSize: 10 }} unit="A" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#A2D8E2',
                  borderWidth: '2px',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  boxShadow: '0 10px 25px -5px rgba(92, 148, 237, 0.15)',
                }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="powerW"
                name="Power (W)"
                stroke="#5C94ED"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#dashboardPowerGrad)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="currentA"
                name="Current (A)"
                stroke="#0D9488"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Quick Navigation Bar to Smart Controls & AI Prediction */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Quick link to Smart Controls */}
        <div
          onClick={() => onNavigatePage('controls')}
          className="p-5 rounded-2xl bg-white/95 hover:bg-[#EBF5FC] border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] cursor-pointer transition-all flex items-center justify-between group shadow-xs"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-[#CBE5F6] text-[#1E40AF] group-hover:bg-[#A2D8E2] border border-[#A2D8E2] transition-colors">
              <Sliders className="w-5 h-5 text-[#5C94ED]" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-800">Smart Appliance Controls</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Light: <strong className={applianceState.lightOn ? 'text-[#5C94ED]' : 'text-slate-400'}>{applianceState.lightOn ? 'ON' : 'OFF'}</strong> • Fan: <strong className="text-[#0D9488]">{applianceState.fanOn ? `${applianceState.fanSpeedPercent}%` : 'OFF'}</strong>
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#5C94ED] group-hover:translate-x-1 transition-all" />
        </div>

        {/* Quick link to AI Prediction */}
        <div
          onClick={() => onNavigatePage('predictions')}
          className="p-5 rounded-2xl bg-white/95 hover:bg-[#EBF5FC] border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] cursor-pointer transition-all flex items-center justify-between group shadow-xs"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-[#8BF0F0]/40 text-[#0F766E] group-hover:bg-[#8BF0F0]/60 border border-[#A2D8E2] transition-colors">
              <Zap className="w-5 h-5 text-[#0F766E]" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-800">AI Monthly Energy Prediction</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Projected: <strong className="text-[#1E40AF]">{mlForecast.currentMonthForecastKWh} kWh</strong> • Bill: <strong className="text-[#059669]">₹{mlForecast.estimatedBillINR}</strong>
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#5C94ED] group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  );
};
