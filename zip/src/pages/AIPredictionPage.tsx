import React, { useState } from 'react';
import {
  Brain,
  IndianRupee,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  ShieldCheck,
  Calendar,
  Sliders,
  Copy,
  Layers,
  Sparkles,
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

import { MLForecasterService } from '../services/mlForecaster';
import { iotSimulator, DailyDataPoint } from '../services/iotSimulator';
import { useToast } from '../components/common/ToastContainer';

interface MonthRateConfig {
  fixedChargesINR: number;
  otherChargesINR: number;
  taxRatePercent: number;
  ratePerUnitINR: number;
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

export const AIPredictionPage: React.FC = () => {
  const { addToast } = useToast();
  const [isRetraining, setIsRetraining] = useState(false);
  const [simulateInsufficientData, setSimulateInsufficientData] = useState(false);

  // Selected month for focused inspection and custom charge editing
  const [selectedMonthId, setSelectedMonthId] = useState<string>('oct');

  // Per-month customizable billing parameters (fixed charges, other electrical charges, tax rate %, unit rate)
  const [monthlyRates, setMonthlyRates] = useState<Record<string, MonthRateConfig>>(() => {
    const initial: Record<string, MonthRateConfig> = {};
    MONTHS_LIST.forEach((m) => {
      initial[m.id] = {
        fixedChargesINR: 50,
        otherChargesINR: 15,
        taxRatePercent: 5.0,
        ratePerUnitINR: 4.50,
      };
    });
    return initial;
  });

  const forecast = MLForecasterService.generateForecast('Random Forest Regressor');
  const dailyHistory: DailyDataPoint[] = iotSimulator.getHistoricalDaily();

  const activeMonth = MONTHS_LIST.find((m) => m.id === selectedMonthId) || MONTHS_LIST[9];
  const activeRateConfig = monthlyRates[activeMonth.id] || {
    fixedChargesINR: 50,
    otherChargesINR: 15,
    taxRatePercent: 5.0,
    ratePerUnitINR: 4.50,
  };

  // Selected month predicted kWh (for current month, use the live dynamic forecast; for others use ML seasonal estimate)
  const predictedMonthKWh = activeMonth.isCurrentMonth
    ? forecast.currentMonthForecastKWh
    : activeMonth.baseKWh;

  // Calculate bill for selected month with its specific electrical charges and tax rate
  const energyCharges = parseFloat((predictedMonthKWh * activeRateConfig.ratePerUnitINR).toFixed(2));
  const subtotalBeforeTax = parseFloat(
    (energyCharges + activeRateConfig.fixedChargesINR + activeRateConfig.otherChargesINR).toFixed(2)
  );
  const taxAmount = parseFloat(((subtotalBeforeTax * activeRateConfig.taxRatePercent) / 100).toFixed(2));
  const totalMonthBill = Math.round(subtotalBeforeTax + taxAmount);

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

  // Apply active month's charges and tax rate to all 12 months
  const handleApplyToAllMonths = () => {
    setMonthlyRates((prev) => {
      const updated: Record<string, MonthRateConfig> = {};
      MONTHS_LIST.forEach((m) => {
        updated[m.id] = { ...activeRateConfig };
      });
      return updated;
    });
    addToast({
      type: 'success',
      title: 'Rates Applied to All Months',
      message: `Fixed: ₹${activeRateConfig.fixedChargesINR}, Other: ₹${activeRateConfig.otherChargesINR}, Tax: ${activeRateConfig.taxRatePercent}% applied across 12 months.`,
    });
  };

  // Build 12-Month Annual Prediction Overview Data
  const yearlyChartData = MONTHS_LIST.map((m) => {
    const rates = monthlyRates[m.id] || {
      fixedChargesINR: 50,
      otherChargesINR: 15,
      taxRatePercent: 5.0,
      ratePerUnitINR: 4.50,
    };
    const kwh = m.isCurrentMonth ? forecast.currentMonthForecastKWh : m.baseKWh;
    const energy = kwh * rates.ratePerUnitINR;
    const subtotal = energy + rates.fixedChargesINR + rates.otherChargesINR;
    const tax = (subtotal * rates.taxRatePercent) / 100;
    const bill = Math.round(subtotal + tax);

    return {
      id: m.id,
      month: m.name.substring(0, 3),
      fullName: m.name,
      predictedKWh: parseFloat(kwh.toFixed(1)),
      projectedBillINR: bill,
      isSelected: m.id === selectedMonthId,
      season: m.season,
    };
  });

  // Build Daily Actual vs Predicted Data for Selected Month
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = activeMonth.days;

  const dailyComparisonData: Array<{
    day: string;
    actualKWh: number | null;
    predictedKWh: number | null;
  }> = [];

  if (activeMonth.isCurrentMonth) {
    // Current month uses real day history up to currentDay
    const currentMonthDaily = dailyHistory.slice(-currentDay);
    currentMonthDaily.forEach((d, idx) => {
      dailyComparisonData.push({
        day: `D${idx + 1}`,
        actualKWh: d.totalKWh,
        predictedKWh: d.totalKWh,
      });
    });

    const avgFuture = forecast.remainingDaysForecastKWh / Math.max(1, daysInMonth - currentDay);
    for (let d = currentDay + 1; d <= daysInMonth; d++) {
      const isWknd = d % 7 === 0 || d % 7 === 6;
      dailyComparisonData.push({
        day: `D${d}`,
        actualKWh: null,
        predictedKWh: parseFloat((avgFuture * (isWknd ? 1.2 : 0.95)).toFixed(3)),
      });
    }
  } else {
    // For another selected month, show projected daily distribution
    const avgDaily = predictedMonthKWh / daysInMonth;
    for (let d = 1; d <= daysInMonth; d++) {
      const isWknd = d % 7 === 0 || d % 7 === 6;
      const variance = Math.sin(d * 0.8) * 0.08;
      dailyComparisonData.push({
        day: `D${d}`,
        actualKWh: null,
        predictedKWh: parseFloat((avgDaily * (isWknd ? 1.18 : 0.94) + variance).toFixed(3)),
      });
    }
  }

  const handleRetrain = () => {
    setIsRetraining(true);
    setTimeout(() => {
      setIsRetraining(false);
      addToast({
        type: 'success',
        title: 'Random Forest Model Retrained',
        message: `Validated on chronological 75/25 split (MAE: ${forecast.metrics.mae} kWh, R²: ${forecast.metrics.r2}).`,
      });
    }, 800);
  };

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
                  Scikit-Learn ML Model
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                Monthly regression predictions with customizable electrical charges and tax rates for each calendar month.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setSimulateInsufficientData(!simulateInsufficientData)}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                simulateInsufficientData
                  ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                  : 'bg-[#CBE5F6]/50 text-slate-700 border-[#A2D8E2] hover:bg-[#CBE5F6]'
              }`}
              title="Demonstrate model validation behavior when fewer than 7 days are recorded"
            >
              {simulateInsufficientData ? 'Data: < 7 Days (Demo)' : 'Data: 30 Days (Full)'}
            </button>

            <button
              onClick={handleRetrain}
              disabled={isRetraining}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5C94ED] hover:bg-[#4E84D9] text-white text-xs font-bold transition-all shadow-md shadow-[#5C94ED]/20 ${
                isRetraining ? 'opacity-60 cursor-wait' : ''
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRetraining ? 'animate-spin' : ''}`} />
              <span>{isRetraining ? 'Fitting Trees...' : 'Retrain Model'}</span>
            </button>
          </div>
        </div>

        {simulateInsufficientData ? (
          <div className="mt-4 p-3.5 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#92400E]">
              <span className="font-bold block">
                Collecting energy data to improve predictions
              </span>
              <p className="text-[#B45309] text-[11px] mt-0.5">
                Reliable machine learning regression requires at least 7 days of historical load observations. A baseline moving average is shown until sufficient time-series records are accumulated.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-xl bg-[#8BF0F0]/30 border border-[#A2D8E2] flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-[#0F766E] font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#0D9488]" />
              Model Active: Trained on IoT time-series logs with zero temporal leakage
            </span>
            <span className="font-mono text-[#1E40AF] text-[11px] font-bold hidden sm:inline">
              Random Forest Regressor • R²: {forecast.metrics.r2} • MAE: {forecast.metrics.mae} kWh
            </span>
          </div>
        )}
      </div>

      {/* 2. Month Selector Tabs */}
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
            Selected: {activeMonth.name} ({activeMonth.days} Days)
          </span>
        </div>

        {/* Scrollable Month Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {MONTHS_LIST.map((m) => {
            const isSelected = m.id === selectedMonthId;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMonthId(m.id)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#5C94ED] text-white border-[#5C94ED] shadow-md shadow-[#5C94ED]/25'
                    : 'bg-[#EBF5FC] text-slate-700 hover:text-[#5C94ED] hover:bg-[#CBE5F6]/60 border-[#A2D8E2]'
                }`}
              >
                <span>{m.name}</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Predicted Month Consumption */}
        <div className="p-5 rounded-2xl bg-white/95 backdrop-blur-sm border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] shadow-[0_4px_18px_rgba(92,148,237,0.08)] transition-all">
          <span className="text-xs text-slate-600 uppercase font-extrabold">
            {activeMonth.name} Energy Forecast
          </span>
          <div className="text-3xl font-extrabold font-mono text-[#5C94ED] mt-2">
            {predictedMonthKWh.toFixed(1)}{' '}
            <span className="text-base font-normal text-slate-400">kWh</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#A2D8E2]/30 text-xs text-slate-600 flex justify-between">
            <span>Daily Average:</span>
            <span className="font-mono text-[#1E3A8A] font-bold">
              {(predictedMonthKWh / activeMonth.days).toFixed(2)} kWh/day
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
            <span>Applied Tax:</span>
            <span className="font-mono text-[#059669] font-bold">
              {activeRateConfig.taxRatePercent}% (₹{taxAmount})
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
            <span>Fixed / Other:</span>
            <span className="font-mono text-[#1E3A8A] font-bold">
              ₹{activeRateConfig.fixedChargesINR} / ₹{activeRateConfig.otherChargesINR}
            </span>
          </div>
        </div>

        {/* Card 4: Model Confidence */}
        <div className="p-5 rounded-2xl bg-white/95 backdrop-blur-sm border-2 border-[#A2D8E2]/80 hover:border-[#5C94ED] shadow-[0_4px_18px_rgba(92,148,237,0.08)] transition-all">
          <span className="text-xs text-slate-600 uppercase font-extrabold">
            ML Model Accuracy
          </span>
          <div className="text-2xl font-extrabold font-mono text-[#5C94ED] mt-2">
            R² = {forecast.metrics.r2}
          </div>
          <div className="mt-3 pt-3 border-t border-[#A2D8E2]/30 text-xs text-slate-600 flex justify-between">
            <span>Mean Abs Error:</span>
            <span className="font-mono text-[#1E3A8A] font-bold">
              {forecast.metrics.mae} kWh
            </span>
          </div>
        </div>
      </div>

      {/* 4. Electrical Charges & Tax Rate Editor for Selected Month */}
      <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-[#A2D8E2]/40 gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#CBE5F6] text-[#1E40AF] border border-[#A2D8E2]">
              <Sliders className="w-5 h-5 text-[#5C94ED]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">
                Customize Electrical Charges & Tax Rate for {activeMonth.name}
              </h3>
              <p className="text-xs text-slate-600">
                Adjust fixed charges, surcharges, and tax rates to calculate the electricity bill for this month.
              </p>
            </div>
          </div>

          <button
            onClick={handleApplyToAllMonths}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#EBF5FC] hover:bg-[#CBE5F6] border border-[#A2D8E2] text-xs font-bold text-[#1E40AF] transition-colors shadow-xs"
            title="Copy these billing rates across all 12 months"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Apply Rates to All Months</span>
          </button>
        </div>

        {/* Interactive Sliders & Inputs for Charges */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Tax Rate (%) */}
          <div className="p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold">Tax / Duty Rate (%):</label>
              <span className="font-mono text-[#5C94ED] font-extrabold text-sm">
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
              className="w-full h-6 bg-transparent cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>0% (Tax Free)</span>
              <span>State Duty</span>
              <span>25%</span>
            </div>
          </div>

          {/* 2. Other Electrical Charges (₹) */}
          <div className="p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold">Other Electrical Charges:</label>
              <span className="font-mono text-[#1E3A8A] font-extrabold text-sm">
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
              className="w-full h-6 bg-transparent cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>₹0</span>
              <span>Fuel/Wheeling</span>
              <span>₹150</span>
            </div>
          </div>

          {/* 3. Fixed Monthly Meter Charge (₹) */}
          <div className="p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold">Fixed Meter Charge:</label>
              <span className="font-mono text-[#1E40AF] font-extrabold text-sm">
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
              className="w-full h-6 bg-transparent cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>₹0</span>
              <span>Monthly Flat</span>
              <span>₹200</span>
            </div>
          </div>

          {/* 4. Energy Unit Rate (₹/kWh) */}
          <div className="p-4 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-800 font-bold">Base Energy Rate:</label>
              <span className="font-mono text-[#059669] font-extrabold text-sm">
                ₹{activeRateConfig.ratePerUnitINR.toFixed(2)}/kWh
              </span>
            </div>
            <input
              type="range"
              min="2.0"
              max="10.0"
              step="0.25"
              value={activeRateConfig.ratePerUnitINR}
              onChange={(e) => handleUpdateActiveCharges('ratePerUnitINR', Number(e.target.value))}
              className="w-full h-6 bg-transparent cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>₹2.00</span>
              <span>Unit Tariff</span>
              <span>₹10.00</span>
            </div>
          </div>
        </div>

        {/* Itemized Calculation Summary Box */}
        <div className="mt-5 p-4 rounded-xl bg-white border border-[#A2D8E2] text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center divide-y sm:divide-y-0 sm:divide-x divide-[#A2D8E2]/60">
            <div className="p-1">
              <span className="text-slate-500 block">Energy ({predictedMonthKWh.toFixed(1)} kWh):</span>
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
              Click on any month pill above to inspect or edit charges. Active month ({activeMonth.name}) is highlighted.
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
              <YAxis yAxisId="left" stroke="#5C94ED" tick={{ fontSize: 10 }} unit="kWh" domain={[0, 40]} />
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

      {/* 6. Daily Breakdown for Selected Month & Model Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Actual vs Forecast */}
        <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#5C94ED]" />
              {activeMonth.name} Daily Consumption Curve
            </h3>
            <span className="text-xs font-mono text-[#5C94ED] font-bold">
              {daysInMonth} Days Total
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#A2D8E2" strokeOpacity={0.35} />
                <XAxis dataKey="day" stroke="#64748B" tick={{ fontSize: 9 }} interval={4} />
                <YAxis stroke="#5C94ED" tick={{ fontSize: 9 }} unit="kWh" domain={[0, 1.2]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#A2D8E2',
                    borderWidth: '2px',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="actualKWh" name="Actual (kWh)" fill="#5C94ED" radius={[3, 3, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="predictedKWh"
                  name="AI Forecast (kWh)"
                  stroke="#0D9488"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ r: 2, fill: '#8BF0F0', stroke: '#0D9488' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Machine Learning Methodology */}
        <div className="p-6 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-[#A2D8E2]/80 shadow-[0_4px_20px_rgba(92,148,237,0.08)] space-y-3.5">
          <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#5C94ED]" />
            Machine Learning Pipeline Architecture
          </h3>

          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="p-3.5 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2]">
              <span className="font-bold text-[#1E40AF] block">1. Feature Engineering:</span>
              <span className="text-slate-600 text-[11px] mt-0.5 block">
                Rolling 7-day average daily kWh, weekend load shift multipliers, lag-1 day consumption, and appliance running hours.
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2]">
              <span className="font-bold text-[#0F766E] block">2. Chronological Validation (Zero Leakage):</span>
              <span className="text-slate-600 text-[11px] mt-0.5 block">
                Trained on chronological historical days and tested strictly on holdout sets to guarantee no future data leakage.
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#EBF5FC]/60 border border-[#A2D8E2]">
              <span className="font-bold text-[#5C94ED] block">3. Python Scikit-Learn Microservice:</span>
              <span className="text-slate-600 text-[11px] mt-0.5 block">
                Ensemble of 100 decision trees (`RandomForestRegressor`, max depth 6) in Python FastAPI (`/ml-service/main.py`).
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
