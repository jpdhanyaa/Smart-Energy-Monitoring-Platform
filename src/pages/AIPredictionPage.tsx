import React, { useState } from 'react';
import {
  Brain,
  IndianRupee,
  TrendingUp,
  Calendar,
  Sliders,
  Layers,
  Edit3,
  RotateCcw,
  Check,
  Zap,
} from 'lucide-react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Cell,
} from 'recharts';

import { useToast } from '../components/common/ToastContainer';

interface MonthRateConfig {
  fixedChargesINR: number;
  otherChargesINR: number;
  taxRatePercent: number;
}

interface MonthData {
  id: string;
  name: string;
  days: number;
  baseKWh: number;
  season: string;
  isCurrentMonth?: boolean;
}

const MONTHS_LIST: MonthData[] = [
  { id: 'jan', name: 'January', days: 31, baseKWh: 18.4, season: 'Winter' },
  { id: 'feb', name: 'February', days: 28, baseKWh: 19.2, season: 'Late Winter' },
  { id: 'mar', name: 'March', days: 31, baseKWh: 22.8, season: 'Spring' },
  { id: 'apr', name: 'April', days: 30, baseKWh: 26.5, season: 'Early Summer' },
  { id: 'may', name: 'May', days: 31, baseKWh: 30.8, season: 'Peak Summer' },
  { id: 'jun', name: 'June', days: 30, baseKWh: 28.2, season: 'Monsoon' },
  { id: 'jul', name: 'July', days: 31, baseKWh: 24.6, season: 'Monsoon' },
  { id: 'aug', name: 'August', days: 31, baseKWh: 23.9, season: 'Monsoon' },
  { id: 'sep', name: 'September', days: 30, baseKWh: 22.1, season: 'Post-Monsoon' },
  { id: 'oct', name: 'October', days: 31, baseKWh: 20.8, season: 'Autumn', isCurrentMonth: true },
  { id: 'nov', name: 'November', days: 30, baseKWh: 19.8, season: 'Late Autumn' },
  { id: 'dec', name: 'December', days: 31, baseKWh: 18.0, season: 'Winter' },
];

// Helper to generate realistic daily values for all days of a month
function generateDefaultDailyValues(daysCount: number, baseTotalKWh: number): number[] {
  const avg = baseTotalKWh / daysCount;
  const values: number[] = [];
  for (let d = 1; d <= daysCount; d++) {
    const isWknd = d % 7 === 0 || d % 7 === 6;
    const sineVariation = Math.sin(d * 0.75) * 0.08;
    const val = Math.max(0.2, parseFloat((avg * (isWknd ? 1.18 : 0.94) + sineVariation).toFixed(3)));
    values.push(val);
  }
  return values;
}

export const AIPredictionPage: React.FC = () => {
  const { addToast } = useToast();

  // Selected month for focused inspection and custom charge editing
  const [selectedMonthId, setSelectedMonthId] = useState<string>('oct');

  // Base "Set Price" in ₹/kWh (e.g. ₹5.00)
  const [baseSetPrice, setBaseSetPrice] = useState<number>(5.0);

  // Per-month sliding price adjustment offset (-10 to +10)
  const [priceOffsets, setPriceOffsets] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    MONTHS_LIST.forEach((m) => {
      // Default offset: 0 (or slight seasonal tweak like +0.5 for summer, 0 for others)
      initial[m.id] = m.id === 'may' ? 1.0 : m.id === 'jun' ? 0.5 : 0;
    });
    return initial;
  });

  // Per-month customizable billing parameters (fixed charges, other electrical charges, tax rate %)
  const [monthlyRates, setMonthlyRates] = useState<Record<string, MonthRateConfig>>(() => {
    const initial: Record<string, MonthRateConfig> = {};
    MONTHS_LIST.forEach((m) => {
      initial[m.id] = {
        fixedChargesINR: 50,
        otherChargesINR: 15,
        taxRatePercent: 5.0,
      };
    });
    return initial;
  });

  // Daily values for EVERY day in each month (365 days fully accounted for)
  const [monthlyDailyValues, setMonthlyDailyValues] = useState<Record<string, number[]>>(() => {
    const initial: Record<string, number[]> = {};
    MONTHS_LIST.forEach((m) => {
      initial[m.id] = generateDefaultDailyValues(m.days, m.baseKWh);
    });
    return initial;
  });

  // Daily entry form state (which day to edit and value)
  const [entryDayIndex, setEntryDayIndex] = useState<number>(1);
  const [entryKWhInput, setEntryKWhInput] = useState<string>('');

  const activeMonth = MONTHS_LIST.find((m) => m.id === selectedMonthId) || MONTHS_LIST[9];
  const activeRateConfig = monthlyRates[activeMonth.id] || {
    fixedChargesINR: 50,
    otherChargesINR: 15,
    taxRatePercent: 5.0,
  };

  // Active month's sliding offset (-10 to +10)
  const activeOffset = priceOffsets[activeMonth.id] ?? 0;

  // Effective unit price based on Base Set Price + sliding offset (clamped to min ₹0.50)
  const activeEffectiveRate = Math.max(0.5, parseFloat((baseSetPrice + activeOffset).toFixed(2)));

  // Active month daily values array
  const activeDailyValues = monthlyDailyValues[activeMonth.id] || generateDefaultDailyValues(activeMonth.days, activeMonth.baseKWh);

  // Month total energy (sum of every day's entered value)
  const totalMonthKWh = parseFloat(
    activeDailyValues.reduce((acc, curr) => acc + curr, 0).toFixed(2)
  );

  // Bill calculations based on effective price and month charges
  const energyCharges = parseFloat((totalMonthKWh * activeEffectiveRate).toFixed(2));
  const subtotalBeforeTax = parseFloat(
    (energyCharges + activeRateConfig.fixedChargesINR + activeRateConfig.otherChargesINR).toFixed(2)
  );
  const taxAmount = parseFloat(((subtotalBeforeTax * activeRateConfig.taxRatePercent) / 100).toFixed(2));
  const totalMonthBill = Math.round(subtotalBeforeTax + taxAmount);

  // Update offset for a specific month
  const handleOffsetChange = (monthId: string, offset: number) => {
    setPriceOffsets((prev) => ({
      ...prev,
      [monthId]: offset,
    }));
  };

  // Update charges or tax rate for the active month
  const handleUpdateActiveCharges = (field: keyof MonthRateConfig, value: number) => {
    setMonthlyRates((prev) => ({
      ...prev,
      [activeMonth.id]: {
        ...prev[activeMonth.id],
        [field]: value,
      },
    }));
  };

  // Handle manual entry of a daily value
  const handleSaveDailyValue = (dayNumber: number, valueKWh: number) => {
    if (isNaN(valueKWh) || valueKWh < 0) return;
    const clampedVal = parseFloat(Math.max(0.01, Math.min(15.0, valueKWh)).toFixed(3));
    setMonthlyDailyValues((prev) => {
      const currentList = [...(prev[activeMonth.id] || generateDefaultDailyValues(activeMonth.days, activeMonth.baseKWh))];
      currentList[dayNumber - 1] = clampedVal;
      return {
        ...prev,
        [activeMonth.id]: currentList,
      };
    });

    addToast({
      type: 'success',
      title: `Day ${dayNumber} Updated`,
      message: `${activeMonth.name} Day ${dayNumber} set to ${clampedVal} kWh (₹${(clampedVal * activeEffectiveRate).toFixed(2)})`,
    });
  };

  // Reset active month daily values to baseline
  const handleResetMonthDays = () => {
    const defaults = generateDefaultDailyValues(activeMonth.days, activeMonth.baseKWh);
    setMonthlyDailyValues((prev) => ({
      ...prev,
      [activeMonth.id]: defaults,
    }));
    addToast({
      type: 'info',
      title: `${activeMonth.name} Values Reset`,
      message: 'All daily values have been restored to baseline ML forecast.',
    });
  };

  // Build 12-Month Annual Overview Data
  const yearlyChartData = MONTHS_LIST.map((m) => {
    const rates = monthlyRates[m.id] || {
      fixedChargesINR: 50,
      otherChargesINR: 15,
      taxRatePercent: 5.0,
    };
    const offset = priceOffsets[m.id] ?? 0;
    const effRate = Math.max(0.5, parseFloat((baseSetPrice + offset).toFixed(2)));
    const monthDays = monthlyDailyValues[m.id] || generateDefaultDailyValues(m.days, m.baseKWh);
    const kwh = parseFloat(monthDays.reduce((a, b) => a + b, 0).toFixed(1));
    const energy = kwh * effRate;
    const subtotal = energy + rates.fixedChargesINR + rates.otherChargesINR;
    const tax = (subtotal * rates.taxRatePercent) / 100;
    const bill = Math.round(subtotal + tax);

    return {
      id: m.id,
      month: m.name.substring(0, 3),
      fullName: m.name,
      predictedKWh: kwh,
      projectedBillINR: bill,
      effectiveRate: effRate,
      offset,
      isSelected: m.id === selectedMonthId,
      season: m.season,
    };
  });

  // Build complete daily data structure for EVERY day of the active month
  const dailyChartData = activeDailyValues.map((kwh, idx) => {
    const dayNum = idx + 1;
    const isWeekend = dayNum % 7 === 0 || dayNum % 7 === 6;
    const cost = parseFloat((kwh * activeEffectiveRate).toFixed(2));
    return {
      day: `D${dayNum}`,
      dayNum,
      dayLabel: `Day ${dayNum}`,
      consumptionKWh: kwh,
      costINR: cost,
      isWeekend,
    };
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-[#CBE5F6] text-[#1E40AF] border border-[#A2D8E2]">
              <Brain className="w-7 h-7 text-[#5C94ED]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A]">
                  AI Monthly Energy & Electricity Bill Prediction
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#8BF0F0]/50 text-[#0F766E] border border-[#A2D8E2] font-bold">
                  Predictive Engine
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                Monthly forecasting with interactive price setting, sliding +/-10 adjustment, and daily consumption logging.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="px-3.5 py-1.5 rounded-xl bg-[#8BF0F0]/40 text-[#0F766E] border-2 border-[#A2D8E2] font-mono text-xs font-bold">
              Base Price: ₹{baseSetPrice.toFixed(2)}/kWh
            </span>
          </div>
        </div>
      </div>

      {/* 2. Month Selector Tabs with Blinking Current Month Indicator */}
      <div className="p-4 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#0F172A]">
            <Calendar className="w-4 h-4 text-[#5C94ED]" />
            <span>Select Month for Prediction & Billing:</span>
          </div>
          <span className="text-xs font-mono font-bold text-[#5C94ED] bg-[#CBE5F6]/60 px-2.5 py-1 rounded-lg border border-[#A2D8E2] flex items-center gap-1.5">
            {activeMonth.isCurrentMonth && (
              <span className="relative flex h-2 w-2 mr-0.5" title="Current Active Month">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            Selected: {activeMonth.name} ({activeMonth.days} Days) • Rate: ₹{activeEffectiveRate.toFixed(2)}/kWh
          </span>
        </div>

        {/* Scrollable Month Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {MONTHS_LIST.map((m) => {
            const isSelected = m.id === selectedMonthId;
            const offset = priceOffsets[m.id] ?? 0;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedMonthId(m.id);
                  setEntryDayIndex(1);
                  setEntryKWhInput('');
                }}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#5C94ED] text-white border-[#5C94ED] shadow-md shadow-[#5C94ED]/25'
                    : 'bg-[#EBF5FC] text-slate-700 hover:text-[#5C94ED] hover:bg-[#CBE5F6]/60 border-[#A2D8E2]'
                }`}
              >
                <span>{m.name}</span>
                {offset !== 0 && (
                  <span
                    className={`text-[10px] font-mono px-1 rounded ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-[#CBE5F6] text-[#1E40AF]'
                    }`}
                  >
                    {offset > 0 ? `+${offset}` : offset}
                  </span>
                )}
                {m.isCurrentMonth && (
                  <span className="relative flex h-2 w-2 ml-0.5 items-center justify-center" title="Current Month">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-xs"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Key Summary Cards for Selected Month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Month Energy */}
        <div className="p-5 rounded-2xl bg-white/95 backdrop-blur-sm border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] shadow-[0_4px_18px_rgba(92,148,237,0.08)] transition-all">
          <span className="text-xs text-slate-600 uppercase font-extrabold">
            {activeMonth.name} Energy Total
          </span>
          <div className="text-3xl font-extrabold font-mono text-[#5C94ED] mt-2">
            {totalMonthKWh.toFixed(1)}{' '}
            <span className="text-base font-normal text-slate-400">kWh</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#A2D8E2]/30 text-xs text-slate-600 flex justify-between">
            <span>Daily Average:</span>
            <span className="font-mono text-[#1E3A8A] font-bold">
              {(totalMonthKWh / activeMonth.days).toFixed(2)} kWh/day
            </span>
          </div>
        </div>

        {/* Card 2: Projected Monthly Bill */}
        <div className="p-5 rounded-2xl bg-white/95 backdrop-blur-sm border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] shadow-[0_4px_18px_rgba(92,148,237,0.08)] transition-all">
          <span className="text-xs text-slate-600 uppercase font-extrabold">
            {activeMonth.name} Total Bill
          </span>
          <div className="text-3xl font-extrabold font-mono text-[#059669] mt-2">
            ₹{totalMonthBill}
          </div>
          <div className="mt-3 pt-3 border-t border-[#A2D8E2]/30 text-xs text-slate-600 flex justify-between">
            <span>Unit Rate:</span>
            <span className="font-mono text-[#059669] font-bold">
              ₹{activeEffectiveRate.toFixed(2)}/kWh ({activeOffset >= 0 ? `+${activeOffset}` : activeOffset})
            </span>
          </div>
        </div>

        {/* Card 3: Fixed + Other Charges */}
        <div className="p-5 rounded-2xl bg-white/95 backdrop-blur-sm border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] shadow-[0_4px_18px_rgba(92,148,237,0.08)] transition-all">
          <span className="text-xs text-slate-600 uppercase font-extrabold">
            Fixed & Other Levies
          </span>
          <div className="text-3xl font-extrabold font-mono text-[#0F172A] mt-2">
            ₹{activeRateConfig.fixedChargesINR + activeRateConfig.otherChargesINR}
          </div>
          <div className="mt-3 pt-3 border-t border-[#A2D8E2]/30 text-xs text-slate-600 flex justify-between">
            <span>Fixed / Other / Tax:</span>
            <span className="font-mono text-[#1E3A8A] font-bold">
              ₹{activeRateConfig.fixedChargesINR} / ₹{activeRateConfig.otherChargesINR} / {activeRateConfig.taxRatePercent}%
            </span>
          </div>
        </div>
      </div>

      {/* 4. Customize Box: Set Price & -10 to +10 Sliding Option */}
      <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)] space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-[#A2D8E2]/40 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#CBE5F6] text-[#1E40AF] border border-[#A2D8E2]">
              <Sliders className="w-5 h-5 text-[#5C94ED]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">
                Customize Electricity Tariff & Price Slider
              </h3>
              <p className="text-xs text-slate-600">
                Set base price, then use the -10 to +10 slider to dynamically offset rates for {activeMonth.name}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-600">Active Month:</span>
            <span className="px-3 py-1 rounded-xl bg-[#8BF0F0]/50 text-[#0F766E] border border-[#A2D8E2] text-xs font-bold">
              {activeMonth.name}
            </span>
          </div>
        </div>

        {/* Set Price and -10 to +10 Slider Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2]">
          {/* Base Set Price Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-extrabold flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-[#5C94ED]" />
                Set Price (Base Tariff):
              </label>
              <span className="font-mono text-[#5C94ED] font-extrabold text-sm">
                ₹{baseSetPrice.toFixed(2)} / kWh
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">₹</span>
                <input
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.25"
                  value={baseSetPrice}
                  onChange={(e) => setBaseSetPrice(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-[#A2D8E2] bg-white font-mono font-bold text-sm text-[#0F172A] focus:outline-none focus:border-[#5C94ED]"
                  placeholder="5.00"
                />
              </div>

              {/* Quick Preset Buttons for Base Set Price */}
              <div className="flex items-center gap-1">
                {[3.5, 4.5, 5.0, 6.5, 8.0].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setBaseSetPrice(preset)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                      baseSetPrice === preset
                        ? 'bg-[#5C94ED] text-white border-[#5C94ED]'
                        : 'bg-white text-slate-700 hover:bg-[#CBE5F6]/60 border-[#A2D8E2]'
                    }`}
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-600">
              Primary base tariff rate applied across the energy calculation engine.
            </p>
          </div>

          {/* Based on Price: -10 to +10 Sliding Option */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-extrabold flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#0D9488]" />
                Rate Adjustment (-10 to +10 Slider):
              </label>
              <div className="flex items-center gap-1.5 font-mono font-extrabold text-xs">
                <span
                  className={`px-2 py-0.5 rounded text-xs border ${
                    activeOffset > 0
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : activeOffset < 0
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {activeOffset >= 0 ? `+${activeOffset}` : activeOffset}
                </span>
                <span className="text-[#059669] font-bold">
                  ➔ ₹{activeEffectiveRate.toFixed(2)}/kWh
                </span>
              </div>
            </div>

            <input
              type="range"
              min="-10"
              max="10"
              step="0.5"
              value={activeOffset}
              onChange={(e) => handleOffsetChange(activeMonth.id, parseFloat(e.target.value))}
              className="w-full h-6 bg-transparent cursor-pointer"
            />

            <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
              <span>-10 (Discount)</span>
              <div className="flex items-center gap-1">
                {[-10, -5, 0, 5, 10].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleOffsetChange(activeMonth.id, val)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${
                      activeOffset === val
                        ? 'bg-[#5C94ED] text-white border-[#5C94ED]'
                        : 'bg-white text-slate-600 hover:bg-[#CBE5F6]/50 border-[#A2D8E2]'
                    }`}
                  >
                    {val > 0 ? `+${val}` : val}
                  </button>
                ))}
              </div>
              <span>+10 (Surcharge)</span>
            </div>
          </div>
        </div>

        {/* Secondary Electrical Charges Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* 1. Tax Rate (%) */}
          <div className="p-3.5 rounded-xl bg-[#EBF5FC]/40 border border-[#A2D8E2] space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold">Tax / Duty Rate (%):</label>
              <span className="font-mono text-[#5C94ED] font-extrabold text-xs">
                {activeRateConfig.taxRatePercent}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              step="0.5"
              value={activeRateConfig.taxRatePercent}
              onChange={(e) => handleUpdateActiveCharges('taxRatePercent', Number(e.target.value))}
              className="w-full h-5 bg-transparent cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0%</span>
              <span>State Duty</span>
              <span>25%</span>
            </div>
          </div>

          {/* 2. Other Electrical Charges (₹) */}
          <div className="p-3.5 rounded-xl bg-[#EBF5FC]/40 border border-[#A2D8E2] space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold">Other Electrical Charges:</label>
              <span className="font-mono text-[#1E3A8A] font-extrabold text-xs">
                ₹{activeRateConfig.otherChargesINR}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              step="5"
              value={activeRateConfig.otherChargesINR}
              onChange={(e) => handleUpdateActiveCharges('otherChargesINR', Number(e.target.value))}
              className="w-full h-5 bg-transparent cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>₹0</span>
              <span>Wheeling/Fuel</span>
              <span>₹150</span>
            </div>
          </div>

          {/* 3. Fixed Monthly Meter Charge (₹) */}
          <div className="p-3.5 rounded-xl bg-[#EBF5FC]/40 border border-[#A2D8E2] space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold">Fixed Meter Charge:</label>
              <span className="font-mono text-[#1E40AF] font-extrabold text-xs">
                ₹{activeRateConfig.fixedChargesINR}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="5"
              value={activeRateConfig.fixedChargesINR}
              onChange={(e) => handleUpdateActiveCharges('fixedChargesINR', Number(e.target.value))}
              className="w-full h-5 bg-transparent cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>₹0</span>
              <span>Monthly Flat</span>
              <span>₹200</span>
            </div>
          </div>
        </div>

        {/* Itemized Calculation Summary Box */}
        <div className="p-4 rounded-xl bg-white border border-[#A2D8E2] text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center divide-y sm:divide-y-0 sm:divide-x divide-[#A2D8E2]/60">
            <div className="p-1">
              <span className="text-slate-500 block">Energy ({totalMonthKWh.toFixed(1)} kWh):</span>
              <span className="font-mono font-bold text-[#1E3A8A]">₹{energyCharges}</span>
            </div>
            <div className="p-1">
              <span className="text-slate-500 block">Fixed Charges:</span>
              <span className="font-mono font-bold text-[#1E3A8A]">₹{activeRateConfig.fixedChargesINR}</span>
            </div>
            <div className="p-1">
              <span className="text-slate-500 block">Other Charges:</span>
              <span className="font-mono font-bold text-[#1E3A8A]">₹{activeRateConfig.otherChargesINR}</span>
            </div>
            <div className="p-1">
              <span className="text-slate-500 block">Tax ({activeRateConfig.taxRatePercent}%):</span>
              <span className="font-mono font-bold text-[#059669]">₹{taxAmount}</span>
            </div>
            <div className="p-1 col-span-2 sm:col-span-1">
              <span className="text-slate-800 font-extrabold block">Total {activeMonth.name} Bill:</span>
              <span className="font-mono font-extrabold text-[#059669] text-base">₹{totalMonthBill}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. 12-Month Annual Prediction Overview Chart */}
      <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#5C94ED]" />
              12-Month Annual Consumption & Bill Forecast
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Click any month pill above to inspect and edit daily values. Active month ({activeMonth.name}) is highlighted.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[#1E40AF] font-bold bg-[#CBE5F6]/60 px-2.5 py-1 rounded-lg border border-[#A2D8E2]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#5C94ED]"></span>
              Predicted Energy (kWh)
            </span>
            <span className="flex items-center gap-1.5 text-[#0F766E] font-bold bg-[#8BF0F0]/40 px-2.5 py-1 rounded-lg border border-[#A2D8E2]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#059669]"></span>
              Projected Bill (₹)
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={yearlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#A2D8E2" strokeOpacity={0.35} />
              <XAxis dataKey="month" stroke="#64748B" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#5C94ED" tick={{ fontSize: 10 }} unit="kWh" domain={[0, 'auto']} />
              <YAxis yAxisId="right" orientation="right" stroke="#059669" tick={{ fontSize: 10 }} unit="₹" />
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
              <Bar yAxisId="left" dataKey="predictedKWh" name="Predicted Energy (kWh)" radius={[4, 4, 0, 0]}>
                {yearlyChartData.map((entry) => (
                  <Cell
                    key={`cell-${entry.id}`}
                    fill={entry.isSelected ? '#8BF0F0' : '#5C94ED'}
                    stroke={entry.isSelected ? '#0D9488' : '#3B82F6'}
                    strokeWidth={entry.isSelected ? 2 : 1}
                  />
                ))}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="projectedBillINR"
                name="Projected Bill (₹)"
                stroke="#059669"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#FFFFFF', stroke: '#059669', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Daily Consumption Curve & Option to Enter Values for Every Day */}
      <div className="space-y-6">
        {/* Daily Curve Chart with all days plotted */}
        <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#5C94ED]" />
                {activeMonth.name} Daily Consumption Curve (All {activeMonth.days} Days)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Every day has a defined load value. Click any day bar below or use the entry tools to modify.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-[#1E40AF] bg-[#CBE5F6]/60 px-2.5 py-1 rounded-lg border border-[#A2D8E2]">
                Total: {totalMonthKWh.toFixed(2)} kWh
              </span>
              <button
                onClick={handleResetMonthDays}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
                title="Reset all days of this month to baseline forecast"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#A2D8E2" strokeOpacity={0.35} />
                <XAxis dataKey="day" stroke="#64748B" tick={{ fontSize: 9 }} interval={1} />
                <YAxis yAxisId="kwh" stroke="#5C94ED" tick={{ fontSize: 9 }} unit="kWh" domain={[0, 'auto']} />
                <YAxis yAxisId="cost" orientation="right" stroke="#059669" tick={{ fontSize: 9 }} unit="₹" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#A2D8E2',
                    borderWidth: '2px',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                  }}
                  formatter={(value: any, name?: any) => [
                    name === 'Consumption (kWh)' ? `${value} kWh` : `₹${value}`,
                    name || '',
                  ]}
                />
                <Bar
                  yAxisId="kwh"
                  dataKey="consumptionKWh"
                  name="Consumption (kWh)"
                  fill="#5C94ED"
                  radius={[3, 3, 0, 0]}
                  onClick={(data: any) => {
                    if (data && data.dayNum) {
                      setEntryDayIndex(data.dayNum);
                      setEntryKWhInput(String(data.consumptionKWh));
                    }
                  }}
                >
                  {dailyChartData.map((entry) => (
                    <Cell
                      key={`day-bar-${entry.dayNum}`}
                      fill={entry.dayNum === entryDayIndex ? '#8BF0F0' : '#5C94ED'}
                      stroke={entry.dayNum === entryDayIndex ? '#0D9488' : '#3B82F6'}
                      strokeWidth={entry.dayNum === entryDayIndex ? 2 : 1}
                      cursor="pointer"
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="cost"
                  type="monotone"
                  dataKey="costINR"
                  name="Daily Cost (₹)"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#8BF0F0', stroke: '#059669' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Option to Enter / Edit Values for Every Day */}
        <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)] space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-[#A2D8E2]/40 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#8BF0F0]/50 text-[#0F766E] border-2 border-[#A2D8E2]">
                <Edit3 className="w-5 h-5 text-[#0F766E]" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A]">
                  Enter & Edit Daily Values for {activeMonth.name}
                </h3>
                <p className="text-xs text-slate-600">
                  Every day has a registered value. Enter custom meter reading or edit any day in the table.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-600">
                Rate Applied: ₹{activeEffectiveRate.toFixed(2)} / kWh
              </span>
            </div>
          </div>

          {/* Quick Single Day Entry Box */}
          <div className="p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2]">
            <h4 className="text-xs font-extrabold text-[#0F172A] mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#5C94ED]" />
              Quick Enter Daily Consumption (kWh):
            </h4>

            <div className="flex flex-wrap items-center gap-3">
              {/* Select Day */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">Select Day:</label>
                <select
                  value={entryDayIndex}
                  onChange={(e) => {
                    const d = Number(e.target.value);
                    setEntryDayIndex(d);
                    setEntryKWhInput(String(activeDailyValues[d - 1] ?? 0.7));
                  }}
                  className="px-3 py-2 rounded-xl border border-[#A2D8E2] bg-white font-mono font-bold text-xs text-[#0F172A] focus:outline-none focus:border-[#5C94ED]"
                >
                  {Array.from({ length: activeMonth.days }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Day {d} (Current: {activeDailyValues[d - 1] ?? 0} kWh)
                    </option>
                  ))}
                </select>
              </div>

              {/* Enter Value Input */}
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <label className="text-xs font-bold text-slate-700">Value (kWh):</label>
                <input
                  type="number"
                  min="0.01"
                  max="15.0"
                  step="0.05"
                  value={entryKWhInput !== '' ? entryKWhInput : activeDailyValues[entryDayIndex - 1] ?? ''}
                  onChange={(e) => setEntryKWhInput(e.target.value)}
                  placeholder="e.g. 0.850"
                  className="flex-1 px-3 py-2 rounded-xl border border-[#A2D8E2] bg-white font-mono font-bold text-xs text-[#0F172A] focus:outline-none focus:border-[#5C94ED]"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={() => {
                  const val = parseFloat(entryKWhInput);
                  if (!isNaN(val)) {
                    handleSaveDailyValue(entryDayIndex, val);
                  } else {
                    const fallback = activeDailyValues[entryDayIndex - 1];
                    handleSaveDailyValue(entryDayIndex, fallback);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5C94ED] hover:bg-[#4E84D9] text-white text-xs font-bold transition-all shadow-md shadow-[#5C94ED]/20"
              >
                <Check className="w-4 h-4" />
                Save Day {entryDayIndex} Value
              </button>
            </div>
          </div>

          {/* Complete 31-Day Interactive Grid: Direct Inline Value Inputs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">
                All Days in {activeMonth.name} ({activeMonth.days} Days Schedule):
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Directly edit any box to update day consumption & recalculated bill
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-80 overflow-y-auto p-1 scrollbar-thin">
              {Array.from({ length: activeMonth.days }, (_, i) => i + 1).map((dayNum) => {
                const currentVal = activeDailyValues[dayNum - 1] ?? 0.65;
                const isSelected = dayNum === entryDayIndex;
                const dayCost = (currentVal * activeEffectiveRate).toFixed(1);

                return (
                  <div
                    key={dayNum}
                    onClick={() => {
                      setEntryDayIndex(dayNum);
                      setEntryKWhInput(String(currentVal));
                    }}
                    className={`p-2.5 rounded-xl border transition-all text-xs cursor-pointer ${
                      isSelected
                        ? 'bg-[#CBE5F6]/70 border-[#5C94ED] ring-2 ring-[#5C94ED]/30 shadow-xs'
                        : 'bg-white hover:bg-[#EBF5FC] border-[#A2D8E2]'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-800">Day {dayNum}</span>
                      <span className="font-mono text-[10px] text-[#059669] font-bold">₹{dayCost}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="15"
                        step="0.05"
                        value={currentVal}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            handleSaveDailyValue(dayNum, val);
                          }
                        }}
                        className="w-full px-1.5 py-1 rounded-lg border border-[#A2D8E2] text-xs font-mono font-bold text-[#1E40AF] text-center focus:outline-none focus:border-[#5C94ED]"
                      />
                      <span className="text-[10px] text-slate-500 font-mono">kWh</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
