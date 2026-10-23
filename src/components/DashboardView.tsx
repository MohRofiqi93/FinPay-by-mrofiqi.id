import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Edit3,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { MonthlyPeriodData, PeriodFinancialSummary } from '../types/finance';
import { formatCompactIDR, formatIDR } from '../utils/calculations';

interface DashboardViewProps {
  period: MonthlyPeriodData;
  summary: PeriodFinancialSummary;
  onOpenReviseOpeningBalance: () => void;
  onNavigateTab: (tab: 'dashboard' | 'budget' | 'tracker' | 'accounts') => void;
  onQuickAddDailyExpense: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  period,
  summary,
  onOpenReviseOpeningBalance,
  onNavigateTab,
  onQuickAddDailyExpense,
}) => {
  const [selectedDonutTab, setSelectedDonutTab] = useState<'EXPENSE' | 'INCOME' | 'SAVING'>('EXPENSE');
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [activeTrendIndex, setActiveTrendIndex] = useState<number | null>(null);
  const [animateReady, setAnimateReady] = useState(false);

  // Trigger smooth entry & nominal change animation
  useEffect(() => {
    setAnimateReady(false);
    const frame = requestAnimationFrame(() => {
      const timer = setTimeout(() => setAnimateReady(true), 40);
      return () => clearTimeout(timer);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    period.periodId,
    summary.totalAllocationActual,
    summary.totalAllocationPlanned,
    summary.dailyTrackerTotal,
    selectedDonutTab,
  ]);

  const isSurplus = summary.closingBalance >= 0;

  // 1. Bar Chart Categories: Rencana vs Aktual Bulanan
  const barCategories = [
    {
      label: 'Operasional / Fixed Cost',
      planned: summary.fixedCostPlanned,
      actual: summary.fixedCostActual,
      accent: 'from-emerald-500 to-teal-400',
    },
    {
      label: 'Langganan & Hutang',
      planned: summary.subDebtPlanned,
      actual: summary.subDebtActual,
      accent: 'from-sky-500 to-cyan-400',
    },
    {
      label: 'Variable / Tracker Harian',
      planned: summary.variablePlanned,
      actual: summary.variableActual,
      accent: 'from-amber-500 to-yellow-400',
    },
    {
      label: 'Tabungan Masa Depan',
      planned: summary.savingPlanned,
      actual: summary.savingActual,
      accent: 'from-emerald-400 to-emerald-300',
    },
  ];

  const maxBarValue = Math.max(
    1,
    ...barCategories.flatMap((c) => [c.planned, c.actual])
  );

  // 2. Donut Chart Segments based on active view
  const donutSegments =
    selectedDonutTab === 'EXPENSE'
      ? [
          {
            label: 'Pengeluaran Sehari-hari',
            value: summary.dailyTrackerOperationalTotal,
            color: '#10b981',
          },
          {
            label: 'Jajan & Tabungan Aira',
            value: summary.dailyTrackerAiraSavingTotal,
            color: '#f59e0b',
          },
          {
            label: 'Fixed Cost / Rumah',
            value: summary.fixedCostActual,
            color: '#38bdf8',
          },
          {
            label: 'Langganan & SPP/Hutang',
            value: summary.subDebtActual,
            color: '#a855f7',
          },
          {
            label: 'Jajan & Nongkrong',
            value: summary.hangoutTrackerTotal,
            color: '#ec4899',
          },
        ]
      : selectedDonutTab === 'INCOME'
      ? [
          {
            label: 'Pendapatan Utama (Pekerjaan)',
            value: summary.primaryIncome,
            color: '#10b981',
          },
          {
            label: 'Pendapatan Sampingan (Freelance)',
            value: summary.sideIncome,
            color: '#f59e0b',
          },
        ]
      : [
          {
            label: 'Investasi Saham',
            value:
              period.savings.find((s) => s.title.toLowerCase().includes('saham'))?.actual ||
              3_000_000,
            color: '#10b981',
          },
          {
            label: 'Dana Darurat',
            value:
              period.savings.find((s) => s.title.toLowerCase().includes('darurat'))?.actual ||
              1_441_000,
            color: '#38bdf8',
          },
          {
            label: 'Saldo Bank BSI (Aira)',
            value: period.accounts.find((a) => a.code === 'BSI')?.balance || 0,
            color: '#f59e0b',
          },
        ];

  const donutTotal = Math.max(
    1,
    donutSegments.reduce((acc, s) => acc + s.value, 0)
  );

  const focusedSegment =
    activeDonutIndex !== null && donutSegments[activeDonutIndex]
      ? donutSegments[activeDonutIndex]
      : null;

  // 3. Group daily expenses by date for the Animated Daily Trend Chart
  const dateGroupMap = new Map<string, number>();
  period.dailyExpenses.forEach((item) => {
    const prev = dateGroupMap.get(item.date) || 0;
    dateGroupMap.set(item.date, prev + item.total);
  });
  const dailyTrendPoints = Array.from(dateGroupMap.entries())
    .slice(0, 12)
    .map(([date, total]) => ({ date, total }));

  const maxTrendVal = Math.max(1, ...dailyTrendPoints.map((p) => p.total));
  const activeTrendPoint =
    activeTrendIndex !== null && dailyTrendPoints[activeTrendIndex]
      ? dailyTrendPoints[activeTrendIndex]
      : dailyTrendPoints[0] || null;

  // Build smooth SVG Area & Polyline coordinates for Tren Pengeluaran Sehari-hari
  const svgWidth = 520;
  const svgHeight = 140;
  const trendCoords = dailyTrendPoints.map((pt, idx) => {
    const x =
      dailyTrendPoints.length === 1
        ? svgWidth / 2
        : (idx / (dailyTrendPoints.length - 1)) * (svgWidth - 36) + 18;
    const ratio = animateReady ? pt.total / maxTrendVal : 0.05;
    const y = svgHeight - 18 - ratio * (svgHeight - 38);
    return { x, y, date: pt.date, total: pt.total };
  });

  const linePath =
    trendCoords.length > 0
      ? trendCoords
          .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
          .join(' ')
      : '';

  const areaPath =
    trendCoords.length > 1
      ? `${linePath} L ${trendCoords[trendCoords.length - 1].x.toFixed(1)} ${svgHeight} L ${trendCoords[0].x.toFixed(1)} ${svgHeight} Z`
      : '';

  return (
    <div className="space-y-6">
      {/* SECTION A: HERO WEALTH & SALDO AKHIR / SALDO AWAL BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Dominant Focal Anchor: Sisa Uang Bulan Ini & Saldo Awal Rollover */}
        <div className="lg:col-span-7 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-300">
                Sisa Uang Bulan Ini · Saldo Akhir ({period.monthLabel})
              </p>
              <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                <h2
                  data-testid="closing-balance-value"
                  className={`text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight ${
                    isSurplus ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatIDR(summary.closingBalance, true)}
                </h2>
                <span className="text-xs font-medium text-slate-300">
                  {isSurplus ? 'Surplus Anggaran' : 'Defisit terhadap Alokasi Tabungan & Harian'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400 max-w-xl">
                Rumus Dinamis: Saldo Awal ({formatCompactIDR(summary.openingBalance)}) + Pendapatan (
                {formatCompactIDR(summary.totalIncome)}) − Total Pengeluaran (
                {formatCompactIDR(summary.totalExpenseActual)}) − Tabungan (
                {formatCompactIDR(summary.savingActual)})
              </p>
            </div>

            <button
              type="button"
              onClick={onQuickAddDailyExpense}
              className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-2 liquid-btn whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Transaksi Harian</span>
            </button>
          </div>

          {/* Sub-strip: Saldo Awal / Akumulasi Bulan Lalu + Tombol Edit/Revisi Manual */}
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>Saldo Awal / Akumulasi Bulan Lalu</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300 font-medium">
                  {summary.isOpeningBalanceRevised ? 'Direvisi Manual' : 'Rollover Otomatis'}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  data-testid="opening-balance-value"
                  className="text-xl font-bold font-mono tabular-nums text-white whitespace-nowrap"
                >
                  {formatIDR(summary.openingBalance)}
                </span>
                {summary.isOpeningBalanceRevised && (
                  <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
                    (Carry-over asli: {formatIDR(period.openingBalanceCarryOver)})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                Catatan: {period.openingBalanceRevisionNote}
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenReviseOpeningBalance}
              className="px-3.5 py-2 rounded-2xl liquid-glass-inset hover:border-amber-400/50 text-amber-300 text-xs font-medium flex items-center gap-2 liquid-btn whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit / Revisi Saldo</span>
            </button>
          </div>
        </div>

        {/* Right Column: Rencana vs Aktual Master Summary Card */}
        <div className="lg:col-span-5 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-300">
                Rekapitulasi Master Spreadsheet · Rencana vs Aktual
              </p>
              <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-xs text-slate-300">Total Rencana (Pengeluaran + Tabungan)</span>
                <span className="text-sm font-semibold font-mono tabular-nums text-slate-100">
                  {formatIDR(summary.totalAllocationPlanned)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-xs text-slate-300">Total Aktual (Pengeluaran + Tabungan)</span>
                <span className="text-sm font-semibold font-mono tabular-nums text-amber-300">
                  {formatIDR(summary.totalAllocationActual)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/10">
                <span className="text-xs text-slate-300">Total Saldo Bank (BCA + BRI + BSI)</span>
                <span className="text-sm font-semibold font-mono tabular-nums text-emerald-400">
                  {formatIDR(summary.totalBankBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-slate-300">Total Saldo E-Wallet (GoPay + DANA)</span>
                <span className="text-sm font-semibold font-mono tabular-nums text-sky-400">
                  {formatIDR(summary.totalEwalletBalance)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span>Status Tagihan Operasional Rumah</span>
            <span className="font-mono tabular-nums text-emerald-400 font-medium">
              {summary.paidFixedCount} / {summary.totalFixedCount} Lunas
            </span>
          </div>
        </div>
      </div>

      {/* SECTION A2: 4-COLUMN LIQUID GLASS KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigateTab('budget')}
          className="rounded-3xl liquid-glass-interactive p-5 flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Pendapatan Bulanan</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p
            data-testid="kpi-income"
            className="mt-3 text-2xl font-bold font-mono tabular-nums text-white"
          >
            {formatIDR(summary.totalIncome)}
          </p>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>Utama: {formatCompactIDR(summary.primaryIncome)}</span>
            <span>·</span>
            <span>Sampingan: {formatCompactIDR(summary.sideIncome)}</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('budget')}
          className="rounded-3xl liquid-glass-interactive p-5 flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Total Pengeluaran Bulan Ini</span>
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          </div>
          <p
            data-testid="kpi-expense"
            className="mt-3 text-2xl font-bold font-mono tabular-nums text-white"
          >
            {formatIDR(summary.totalExpenseActual)}
          </p>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>Fixed: {formatCompactIDR(summary.fixedCostActual)}</span>
            <span>·</span>
            <span>Harian: {formatCompactIDR(summary.variableActual)}</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('budget')}
          className="rounded-3xl liquid-glass-interactive p-5 flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Uang Ditabung Bulan Ini</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p
            data-testid="kpi-saving"
            className="mt-3 text-2xl font-bold font-mono tabular-nums text-amber-300"
          >
            {formatIDR(summary.savingActual)}
          </p>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>
              Rasio Tabungan:{' '}
              {summary.totalIncome > 0
                ? Math.round((summary.savingActual / summary.totalIncome) * 100)
                : 0}
              %
            </span>
            <span>·</span>
            <span>Rencana: {formatCompactIDR(summary.savingPlanned)}</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('tracker')}
          className="rounded-3xl liquid-glass-interactive p-5 flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Tracker Harian & Nongkrong</span>
            <TrendingDown className="w-4 h-4 text-sky-400" />
          </div>
          <p
            data-testid="kpi-daily-tracker"
            className="mt-3 text-2xl font-bold font-mono tabular-nums text-white"
          >
            {formatIDR(summary.dailyTrackerTotal)}
          </p>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>{summary.dailyTrackerCount} Transaksi Harian</span>
            <span>·</span>
            <span>
              Jajan: {formatCompactIDR(summary.hangoutTrackerTotal)} ({summary.hangoutTrackerCount}x)
            </span>
          </div>
        </div>
      </div>

      {/* SECTION B: VISUALISASI GRAFIK BERGERAK & INTERAKTIF (ANIMATED BAR + ANIMATED DONUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Animated Bar Chart: Perbandingan Rencana vs Aktual Bulanan */}
        <div className="lg:col-span-7 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                Perbandingan Rencana vs Aktual Bulanan
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Grafik bar bergerak otomatis menyesuaikan proporsi nominal Rupiah ({period.monthLabel})
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block" />
                <span>Rencana</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
                <span>Aktual</span>
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {barCategories.map((cat, idx) => {
              const plannedPct = animateReady
                ? Math.min(100, Math.max(4, Math.round((cat.planned / maxBarValue) * 100)))
                : 0;
              const actualPct = animateReady
                ? Math.min(100, Math.max(4, Math.round((cat.actual / maxBarValue) * 100)))
                : 0;
              const isOverBudget = cat.actual > cat.planned && cat.planned > 0;
              const ratioToPlanned =
                cat.planned > 0 ? Math.round((cat.actual / cat.planned) * 100) : 0;
              const isHovered = hoveredBarIndex === idx;

              return (
                <div
                  key={cat.label}
                  onMouseEnter={() => setHoveredBarIndex(idx)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                  onClick={() => setHoveredBarIndex(isHovered ? null : idx)}
                  className={`p-3 rounded-2xl transition-all cursor-pointer ${
                    isHovered ? 'liquid-glass-inset border-emerald-400/35' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{cat.label}</span>
                      <span
                        className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                          isOverBudget
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {ratioToPlanned}%
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-slate-300 flex items-center gap-2 text-[11px] sm:text-xs">
                      <span>Rencana: {formatIDR(cat.planned)}</span>
                      <span>·</span>
                      <span
                        className={
                          isOverBudget
                            ? 'text-rose-400 font-semibold'
                            : 'text-emerald-400 font-semibold'
                        }
                      >
                        Aktual: {formatIDR(cat.actual)}
                      </span>
                    </div>
                  </div>

                  {/* Animated Dual Liquid Bars */}
                  <div className="space-y-1.5">
                    <div className="w-full h-2.5 bg-slate-950/80 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-slate-500 to-slate-400 rounded-full liquid-bar-fill"
                        style={{ width: `${plannedPct}%` }}
                      />
                    </div>
                    <div className="w-full h-3 bg-slate-950/80 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full liquid-bar-fill bg-gradient-to-r ${
                          isOverBudget ? 'from-rose-500 via-rose-400 to-amber-400' : cat.accent
                        }`}
                        style={{ width: `${actualPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span>
              Total Rencana:{' '}
              <strong className="font-mono text-white">
                {formatIDR(summary.totalAllocationPlanned)}
              </strong>
            </span>
            <span>
              Selisih Total:{' '}
              <strong className="font-mono text-rose-400">
                {formatIDR(summary.totalAllocationActual - summary.totalAllocationPlanned, true)}
              </strong>
            </span>
          </div>
        </div>

        {/* Animated Interactive Donut Chart: Proporsi Alokasi Dana */}
        <div className="lg:col-span-5 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-base font-semibold text-white">Proporsi Alokasi Dana</h3>
                <p className="text-[11px] text-slate-400">
                  Klik atau arahkan kursor pada cincin untuk rincian hidup
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 liquid-glass-inset rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDonutTab('EXPENSE');
                    setActiveDonutIndex(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedDonutTab === 'EXPENSE'
                      ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDonutTab('INCOME');
                    setActiveDonutIndex(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedDonutTab === 'INCOME'
                      ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Pendapatan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDonutTab('SAVING');
                    setActiveDonutIndex(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedDonutTab === 'SAVING'
                      ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Tabungan
                </button>
              </div>
            </div>

            {/* Animated SVG Donut Chart */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 overflow-visible">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="12"
                  />
                  {(() => {
                    let accumulatedPercent = 0;
                    const radius = 38;
                    const circumference = 2 * Math.PI * radius;
                    return donutSegments.map((seg, idx) => {
                      const pct = animateReady ? seg.value / donutTotal : 0;
                      const strokeDasharray = `${Math.max(0, pct * circumference - 1.5)} ${circumference}`;
                      const strokeDashoffset = -accumulatedPercent * circumference;
                      accumulatedPercent += seg.value / donutTotal;
                      const isSelected = activeDonutIndex === idx;

                      return (
                        <circle
                          key={seg.label}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth={isSelected ? '15' : '12'}
                          strokeLinecap="round"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          onMouseEnter={() => setActiveDonutIndex(idx)}
                          onMouseLeave={() => setActiveDonutIndex(null)}
                          onClick={() => setActiveDonutIndex(isSelected ? null : idx)}
                          className="cursor-pointer transition-all duration-700 ease-out"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none">
                  <span className="text-[10px] text-slate-300 truncate max-w-[95px]">
                    {focusedSegment ? focusedSegment.label : 'Total Alokasi'}
                  </span>
                  <span className="text-xs font-bold font-mono tabular-nums text-white mt-0.5">
                    {formatCompactIDR(focusedSegment ? focusedSegment.value : donutTotal)}
                  </span>
                  {focusedSegment && (
                    <span className="text-[10px] font-mono text-emerald-400">
                      {Math.round((focusedSegment.value / donutTotal) * 100)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="w-full space-y-2">
                {donutSegments.map((seg, idx) => {
                  const pct = Math.round((seg.value / donutTotal) * 100);
                  const isSelected = activeDonutIndex === idx;
                  return (
                    <button
                      type="button"
                      key={seg.label}
                      onMouseEnter={() => setActiveDonutIndex(idx)}
                      onMouseLeave={() => setActiveDonutIndex(null)}
                      onClick={() => setActiveDonutIndex(isSelected ? null : idx)}
                      className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs gap-2 transition-all cursor-pointer ${
                        isSelected ? 'liquid-glass-inset scale-[1.02]' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="text-slate-200 truncate">{seg.label}</span>
                      </div>
                      <div className="font-mono tabular-nums text-white shrink-0">
                        {formatCompactIDR(seg.value)}{' '}
                        <span className="text-slate-400">({pct}%)</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span>
              Metode Harian: COD {formatCompactIDR(summary.totalCodExpenses)} · TF{' '}
              {formatCompactIDR(summary.totalTfExpenses)}
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('budget')}
              className="text-emerald-400 hover:underline font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              Kelola Anggaran →
            </button>
          </div>
        </div>
      </div>

      {/* SECTION B2: ANIMATED TREN PENGELUARAN SEHARI-HARI & DISTRIBUSI REKENING */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Animated Area Spline + Interactive Bar Chart */}
        <div className="lg:col-span-7 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                Tren Pengeluaran Sehari-hari dalam 1 Bulan
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Kurva gelombang & bar interaktif berdasarkan nominal harian ({period.monthLabel})
              </p>
            </div>
            <div className="flex items-center gap-3">
              {activeTrendPoint && (
                <div className="px-3 py-1.5 rounded-xl liquid-glass-inset text-xs font-mono tabular-nums flex items-center gap-2">
                  <span className="text-slate-400">{activeTrendPoint.date}:</span>
                  <strong className="text-emerald-400">{formatIDR(activeTrendPoint.total)}</strong>
                </div>
              )}
              <button
                type="button"
                onClick={() => onNavigateTab('tracker')}
                className="text-xs text-emerald-400 hover:underline font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                Buka Tracker Harian →
              </button>
            </div>
          </div>

          {dailyTrendPoints.length === 0 ? (
            <div className="my-8 text-center py-8 border border-dashed border-white/15 rounded-2xl">
              <p className="text-xs text-slate-300">Belum ada transaksi harian pada periode ini.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {/* Animated SVG Spline Area Wave */}
              <div className="relative w-full h-36 rounded-2xl liquid-glass-inset p-3 overflow-hidden">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="liquidTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {areaPath && (
                    <path
                      d={areaPath}
                      fill="url(#liquidTrendGrad)"
                      className="transition-all duration-700 ease-out"
                    />
                  )}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-700 ease-out"
                    />
                  )}
                  {trendCoords.map((pt, idx) => {
                    const isFocused = activeTrendIndex === idx;
                    return (
                      <g
                        key={pt.date}
                        onMouseEnter={() => setActiveTrendIndex(idx)}
                        onClick={() => setActiveTrendIndex(idx)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isFocused ? 6 : 4}
                          fill={isFocused ? '#fbbf24' : '#10b981'}
                          stroke="#030712"
                          strokeWidth="2"
                          className="transition-all duration-500"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Animated Interactive Vertical Bars */}
              <div className="h-24 flex items-end gap-2 pt-2 pb-1 px-2 border-b border-white/10">
                {dailyTrendPoints.map((pt, idx) => {
                  const heightPct = animateReady
                    ? Math.max(12, Math.round((pt.total / maxTrendVal) * 100))
                    : 8;
                  const isFocused = activeTrendIndex === idx;
                  return (
                    <button
                      type="button"
                      key={pt.date}
                      onMouseEnter={() => setActiveTrendIndex(idx)}
                      onClick={() => setActiveTrendIndex(idx)}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                      title={`${pt.date}: ${formatIDR(pt.total)}`}
                    >
                      <div
                        className={`w-full max-w-[30px] rounded-t-lg transition-all duration-700 ease-out ${
                          isFocused
                            ? 'bg-gradient-to-t from-emerald-500 to-amber-300 shadow-lg shadow-emerald-500/30'
                            : 'bg-gradient-to-t from-emerald-600/70 to-emerald-400/90 group-hover:from-emerald-500 group-hover:to-teal-300'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-300 overflow-x-auto px-1">
                {dailyTrendPoints.map((pt, idx) => (
                  <button
                    type="button"
                    key={pt.date}
                    onClick={() => setActiveTrendIndex(idx)}
                    className={`truncate cursor-pointer px-1 py-0.5 rounded ${
                      activeTrendIndex === idx
                        ? 'text-emerald-300 font-bold bg-emerald-500/15'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pt.date.slice(0, 5)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span>
              Operasional & Belanja:{' '}
              <strong className="font-mono text-white">
                {formatIDR(summary.dailyTrackerOperationalTotal)}
              </strong>
            </span>
            <span>
              Jajan & Nabung Aira (20 Hari):{' '}
              <strong className="font-mono text-amber-300">
                {formatIDR(summary.dailyTrackerAiraSavingTotal)}
              </strong>
            </span>
          </div>
        </div>

        {/* Quick Account Balances & Kewajiban Khusus */}
        <div className="lg:col-span-5 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">
                Distribusi Rekening & E-Wallet
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('accounts')}
                className="text-xs text-emerald-400 hover:underline font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sesuaikan Saldo →
              </button>
            </div>
            <div className="mt-4 space-y-2.5">
              {period.accounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => onNavigateTab('accounts')}
                  className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/[0.04] border border-transparent hover:border-white/10 transition-all cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{acc.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{acc.holderNote}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs font-bold font-mono tabular-nums text-emerald-300">
                      {formatIDR(acc.balance)}
                    </p>
                    <p className="text-[10px] font-mono tabular-nums text-slate-400">
                      Rencana: {formatCompactIDR(acc.plannedAllocation)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span>Catatan Hutang Khusus (Masjid & PLN)</span>
            <span className="font-mono tabular-nums text-rose-400 font-semibold">
              {formatIDR(summary.totalSpecialLiabilities)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
