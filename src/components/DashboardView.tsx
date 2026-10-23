import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Edit3,
  Plus,
  Sparkles,
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
  const isSurplus = summary.closingBalance >= 0;

  // Bar Chart Categories: Rencana vs Aktual
  const barCategories = [
    {
      label: 'Operasional / Fixed',
      planned: summary.fixedCostPlanned,
      actual: summary.fixedCostActual,
    },
    {
      label: 'Langganan & Hutang',
      planned: summary.subDebtPlanned,
      actual: summary.subDebtActual,
    },
    {
      label: 'Variable / Harian',
      planned: summary.variablePlanned,
      actual: summary.variableActual,
    },
    {
      label: 'Tabungan Masa Depan',
      planned: summary.savingPlanned,
      actual: summary.savingActual,
    },
  ];

  const maxBarValue = Math.max(
    1,
    ...barCategories.flatMap((c) => [c.planned, c.actual])
  );

  // Donut Chart Segments based on active view
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
            color: '#3b82f6',
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
            color: '#3b82f6',
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

  // Group daily expenses by date for the Daily Trend Area Chart
  const dateGroupMap = new Map<string, number>();
  period.dailyExpenses.forEach((item) => {
    const prev = dateGroupMap.get(item.date) || 0;
    dateGroupMap.set(item.date, prev + item.total);
  });
  const dailyTrendPoints = Array.from(dateGroupMap.entries())
    .slice(0, 12)
    .map(([date, total]) => ({ date, total }));

  const maxTrendVal = Math.max(1, ...dailyTrendPoints.map((p) => p.total));

  return (
    <div className="space-y-6">
      {/* SECTION A: HERO WEALTH & SALDO AKHIR / SALDO AWAL BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Dominant Focal Anchor: Sisa Uang Bulan Ini & Saldo Awal Rollover */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400">
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
                <span className="text-xs font-medium text-slate-400">
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
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Transaksi Harian</span>
            </button>
          </div>

          {/* Sub-strip: Saldo Awal / Akumulasi Bulan Lalu + Tombol Edit/Revisi Manual */}
          <div className="mt-6 pt-5 border-t border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Saldo Awal / Akumulasi Bulan Lalu</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 font-medium">
                  {summary.isOpeningBalanceRevised ? 'Direvisi Manual' : 'Rollover Otomatis'}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  data-testid="opening-balance-value"
                  className="text-xl font-bold font-mono tabular-nums text-slate-100 whitespace-nowrap"
                >
                  {formatIDR(summary.openingBalance)}
                </span>
                {summary.isOpeningBalanceRevised && (
                  <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
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
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit / Revisi Saldo</span>
            </button>
          </div>
        </div>

        {/* Right Column: Rencana vs Aktual Master Summary Card (Matches CSV Lines 17-19) */}
        <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-400">
                Rekapitulasi Master Spreadsheet · Rencana vs Aktual
              </p>
              <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                <span className="text-xs text-slate-300">Total Rencana (Pengeluaran + Tabungan)</span>
                <span className="text-sm font-semibold font-mono tabular-nums text-slate-200">
                  {formatIDR(summary.totalAllocationPlanned)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                <span className="text-xs text-slate-300">Total Aktual (Pengeluaran + Tabungan)</span>
                <span className="text-sm font-semibold font-mono tabular-nums text-amber-300">
                  {formatIDR(summary.totalAllocationActual)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
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

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Status Tagihan Operasional Rumah</span>
            <span className="font-mono tabular-nums text-emerald-400 font-medium">
              {summary.paidFixedCount} / {summary.totalFixedCount} Lunas
            </span>
          </div>
        </div>
      </div>

      {/* SECTION A2: 4-COLUMN KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pendapatan Bulanan */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pendapatan Bulanan</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p
            data-testid="kpi-income"
            className="mt-3 text-2xl font-bold font-mono tabular-nums text-slate-100"
          >
            {formatIDR(summary.totalIncome)}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Utama: {formatCompactIDR(summary.primaryIncome)}</span>
            <span>·</span>
            <span>Sampingan: {formatCompactIDR(summary.sideIncome)}</span>
          </div>
        </div>

        {/* Card 2: Total Pengeluaran Bulan Ini */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Pengeluaran Bulan Ini</span>
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          </div>
          <p
            data-testid="kpi-expense"
            className="mt-3 text-2xl font-bold font-mono tabular-nums text-slate-100"
          >
            {formatIDR(summary.totalExpenseActual)}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Fixed: {formatCompactIDR(summary.fixedCostActual)}</span>
            <span>·</span>
            <span>Harian: {formatCompactIDR(summary.variableActual)}</span>
          </div>
        </div>

        {/* Card 3: Uang yang Ditabung Bulan Ini */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Uang Ditabung Bulan Ini</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p
            data-testid="kpi-saving"
            className="mt-3 text-2xl font-bold font-mono tabular-nums text-amber-300"
          >
            {formatIDR(summary.savingActual)}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Rasio Tabungan: {summary.totalIncome > 0 ? Math.round((summary.savingActual / summary.totalIncome) * 100) : 0}%</span>
            <span>·</span>
            <span>Rencana: {formatCompactIDR(summary.savingPlanned)}</span>
          </div>
        </div>

        {/* Card 4: Ringkasan Pengeluaran Harian & Jajan */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Tracker Harian & Nongkrong</span>
            <TrendingDown className="w-4 h-4 text-sky-400" />
          </div>
          <p
            data-testid="kpi-daily-tracker"
            className="mt-3 text-2xl font-bold font-mono tabular-nums text-slate-100"
          >
            {formatIDR(summary.dailyTrackerTotal)}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>{summary.dailyTrackerCount} Transaksi Harian</span>
            <span>·</span>
            <span>Jajan: {formatCompactIDR(summary.hangoutTrackerTotal)} ({summary.hangoutTrackerCount}x)</span>
          </div>
        </div>
      </div>

      {/* SECTION B: VISUALISASI GRAFIK INTERAKTIF (BAR CHART + DONUT CHART) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Bar Chart: Rencana vs Aktual */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Perbandingan Rencana vs Aktual Bulanan
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluasi deviasi anggaran pada 4 pilar keuangan ({period.monthLabel})
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-600 inline-block" />
                <span>Rencana</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                <span>Aktual</span>
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {barCategories.map((cat) => {
              const plannedPct = Math.min(100, Math.round((cat.planned / maxBarValue) * 100));
              const actualPct = Math.min(100, Math.round((cat.actual / maxBarValue) * 100));
              const isOverBudget = cat.actual > cat.planned && cat.planned > 0;

              return (
                <div key={cat.label} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{cat.label}</span>
                    <div className="font-mono tabular-nums text-slate-400 flex items-center gap-2">
                      <span>Rencana: {formatCompactIDR(cat.planned)}</span>
                      <span>·</span>
                      <span className={isOverBudget ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                        Aktual: {formatCompactIDR(cat.actual)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(4, plannedPct)}%` }}
                      />
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOverBudget ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(4, actualPct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              Total Rencana: <strong className="font-mono text-slate-200">{formatIDR(summary.totalAllocationPlanned)}</strong>
            </span>
            <span>
              Selisih Total: <strong className="font-mono text-rose-400">{formatIDR(summary.totalAllocationActual - summary.totalAllocationPlanned, true)}</strong>
            </span>
          </div>
        </div>

        {/* Donut Chart: Proporsi Pengeluaran, Pendapatan, & Tabungan */}
        <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-slate-100">Proporsi Alokasi Dana</h3>
              <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDonutTab('EXPENSE')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedDonutTab === 'EXPENSE'
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDonutTab('INCOME')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedDonutTab === 'INCOME'
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pendapatan
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDonutTab('SAVING')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedDonutTab === 'SAVING'
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tabungan
                </button>
              </div>
            </div>

            {/* SVG Donut Chart */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {(() => {
                    let accumulatedPercent = 0;
                    const radius = 38;
                    const circumference = 2 * Math.PI * radius;
                    return donutSegments.map((seg) => {
                      const pct = seg.value / donutTotal;
                      const strokeDasharray = `${pct * circumference} ${circumference}`;
                      const strokeDashoffset = -accumulatedPercent * circumference;
                      accumulatedPercent += pct;
                      return (
                        <circle
                          key={seg.label}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="12"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                  <span className="text-[10px] text-slate-400">Total</span>
                  <span className="text-xs font-bold font-mono tabular-nums text-slate-100">
                    {formatCompactIDR(donutTotal)}
                  </span>
                </div>
              </div>

              <div className="w-full space-y-2.5">
                {donutSegments.map((seg) => {
                  const pct = Math.round((seg.value / donutTotal) * 100);
                  return (
                    <div key={seg.label} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="text-slate-300 truncate">{seg.label}</span>
                      </div>
                      <div className="font-mono tabular-nums text-slate-200 shrink-0">
                        {formatCompactIDR(seg.value)} <span className="text-slate-500">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Rekap Metode Harian: COD {formatCompactIDR(summary.totalCodExpenses)} · TF {formatCompactIDR(summary.totalTfExpenses)}</span>
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

      {/* SECTION B2: TREN PENGELUARAN SEHARI-HARI & RINGKASAN REKENING CEPAT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Area/Bar Trend Chart */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Tren Pengeluaran Sehari-hari dalam 1 Bulan
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Visualisasi aktivitas pengeluaran harian & alokasi rutin harian Aira
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('tracker')}
              className="text-xs text-emerald-400 hover:underline font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              Buka Tracker Harian →
            </button>
          </div>

          {dailyTrendPoints.length === 0 ? (
            <div className="my-8 text-center py-8 border border-dashed border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Belum ada transaksi harian pada periode ini.</p>
            </div>
          ) : (
            <div className="mt-6">
              <div className="h-40 flex items-end gap-2 pt-4 pb-2 border-b border-slate-800">
                {dailyTrendPoints.map((pt) => {
                  const heightPct = Math.max(10, Math.round((pt.total / maxTrendVal) * 100));
                  return (
                    <div
                      key={pt.date}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative"
                    >
                      <div
                        className="w-full max-w-[32px] rounded-t-md bg-emerald-500/80 group-hover:bg-emerald-400 transition-all"
                        style={{ height: `${heightPct}%` }}
                        title={`${pt.date}: ${formatIDR(pt.total)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between gap-1 text-[10px] font-mono text-slate-400 overflow-x-auto">
                {dailyTrendPoints.map((pt) => (
                  <span key={pt.date} className="truncate">
                    {pt.date.slice(0, 5)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              Operasional & Belanja: <strong className="font-mono text-slate-200">{formatIDR(summary.dailyTrackerOperationalTotal)}</strong>
            </span>
            <span>
              Jajan & Nabung Aira (20 Hari): <strong className="font-mono text-amber-300">{formatIDR(summary.dailyTrackerAiraSavingTotal)}</strong>
            </span>
          </div>
        </div>

        {/* Quick Account Balances & Kewajiban Khusus */}
        <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-100">
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
                  className="flex items-center justify-between py-2 border-b border-slate-800/70 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{acc.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{acc.holderNote}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs font-bold font-mono tabular-nums text-slate-100">
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

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
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
