import React, { useEffect, useState } from 'react';
import { CalendarPlus, Edit3, X } from 'lucide-react';
import { MonthlyPeriodData, PeriodFinancialSummary } from '../types/finance';
import { formatIDR } from '../utils/calculations';

interface ReviseBalanceModalProps {
  isOpen: boolean;
  period: MonthlyPeriodData;
  summary: PeriodFinancialSummary;
  onClose: () => void;
  onSaveRevision: (newBalance: number, reason: string) => void;
}

export const ReviseBalanceModal: React.FC<ReviseBalanceModalProps> = ({
  isOpen,
  period,
  summary,
  onClose,
  onSaveRevision,
}) => {
  const [balanceInput, setBalanceInput] = useState<string>(String(summary.openingBalance));
  const [reasonInput, setReasonInput] = useState<string>(period.openingBalanceRevisionNote || '');

  useEffect(() => {
    if (isOpen) {
      setBalanceInput(String(summary.openingBalance));
      setReasonInput(period.openingBalanceRevisionNote || '');
    }
  }, [isOpen, period.periodId, summary.openingBalance, period.openingBalanceRevisionNote]);

  if (!isOpen) return null;

  const previewNewOpening = Number(balanceInput) || 0;
  const previewClosing = previewNewOpening + summary.netMonthlyCashflow;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRevision(
      previewNewOpening,
      reasonInput.trim() || 'Rekonsiliasi saldo awal manual via aplikasi'
    );
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revise-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Edit3 className="w-5 h-5 text-amber-400" />
            <h2 id="revise-modal-title" className="text-base font-semibold text-slate-100">
              Edit / Revisi Saldo Awal & Rekonsiliasi ({period.monthLabel})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal revisi saldo"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Saldo Carry-Over Bulan Lalu:</span>
              <span className="font-mono tabular-nums text-slate-200">
                {formatIDR(period.openingBalanceCarryOver)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Total Kas Bank Saat Ini (BCA+BRI+BSI):</span>
              <span className="font-mono tabular-nums text-emerald-400">
                {formatIDR(summary.totalBankBalance)}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="revise-balance-input" className="block text-xs font-medium text-slate-300 mb-1.5">
              Nominal Saldo Awal / Akumulasi Baru (Rp)
            </label>
            <input
              id="revise-balance-input"
              type="number"
              required
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-amber-300"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setBalanceInput(String(summary.totalBankBalance));
                  setReasonInput('Disamakan dengan total kas riil Bank BCA + BRI + BSI');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-mono cursor-pointer"
              >
                Gunakan Kas Bank ({formatIDR(summary.totalBankBalance)})
              </button>
              <button
                type="button"
                onClick={() => {
                  setBalanceInput(String(period.openingBalanceCarryOver));
                  setReasonInput('Kembali ke nilai rollover otomatis');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono cursor-pointer"
              >
                Reset ke Rollover ({formatIDR(period.openingBalanceCarryOver)})
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="revise-reason-input" className="block text-xs font-medium text-slate-300 mb-1.5">
              Catatan Revisi / Alasan Rekonsiliasi
            </label>
            <input
              id="revise-reason-input"
              type="text"
              required
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Contoh: Penyesuaian selisih kas tunai & rekening BRI"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
            <span className="text-slate-300">Proyeksi Sisa Uang Bulan Ini setelah revisi:</span>
            <strong
              className={`font-mono tabular-nums text-sm ${
                previewClosing >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatIDR(previewClosing, true)}
            </strong>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              Simpan Revisi Saldo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CreateNewMonthModalProps {
  isOpen: boolean;
  sourcePeriod: MonthlyPeriodData;
  sourceSummary: PeriodFinancialSummary;
  existingPeriods: MonthlyPeriodData[];
  onClose: () => void;
  onCreateMonth: (newPeriodId: string, newMonthLabel: string) => void;
}

const SUGGESTED_MONTHS = [
  { id: '2026-12', label: 'Desember 2026' },
  { id: '2027-01', label: 'Januari 2027' },
  { id: '2027-02', label: 'Februari 2027' },
  { id: '2027-03', label: 'Maret 2027' },
];

export const CreateNewMonthModal: React.FC<CreateNewMonthModalProps> = ({
  isOpen,
  sourcePeriod,
  sourceSummary,
  existingPeriods,
  onClose,
  onCreateMonth,
}) => {
  const existingIds = new Set(existingPeriods.map((p) => p.periodId));
  const nextDefault =
    SUGGESTED_MONTHS.find((m) => !existingIds.has(m.id)) || {
      id: `2027-0${existingPeriods.length}`,
      label: `Bulan Baru ${existingPeriods.length + 1}`,
    };

  const [periodId, setPeriodId] = useState(nextDefault.id);
  const [monthLabel, setMonthLabel] = useState(nextDefault.label);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodId.trim() || !monthLabel.trim()) return;
    onCreateMonth(periodId.trim(), monthLabel.trim());
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-month-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <CalendarPlus className="w-5 h-5 text-emerald-400" />
            <h2 id="new-month-modal-title" className="text-base font-semibold text-slate-100">
              Buat Periode Bulan Baru & Auto-Generate Sheet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal bulan baru"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <p className="text-slate-300 font-medium">
              Rollover Otomatis dari <strong className="text-emerald-400">{sourcePeriod.monthLabel}</strong>:
            </p>
            <ul className="space-y-1 text-slate-400 list-disc list-inside">
              <li>
                Saldo Akhir <strong>{formatIDR(sourceSummary.closingBalance)}</strong> otomatis menjadi Saldo Awal bulan baru.
              </li>
              <li>
                Seluruh kategori rutin ({sourcePeriod.fixedCosts.length} Fixed Cost, {sourcePeriod.subscriptionsAndDebts.length} Langganan/Hutang, {sourcePeriod.savings.length} Tabungan) disalin otomatis.
              </li>
              <li>Nilai realisasi aktual dan Tracker Harian di-reset ke Rp 0.</li>
              <li>Sheet baru otomatis dibuat di Google Sheets saat terhubung ke internet.</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-month-id" className="block text-xs text-slate-300 mb-1">
                Kode Periode (YYYY-MM)
              </label>
              <input
                id="new-month-id"
                type="text"
                required
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="new-month-label" className="block text-xs text-slate-300 mb-1">
                Nama Sheet di Google Drive
              </label>
              <input
                id="new-month-label"
                type="text"
                required
                value={monthLabel}
                onChange={(e) => setMonthLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              + Buat Sheet Bulan Baru
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
