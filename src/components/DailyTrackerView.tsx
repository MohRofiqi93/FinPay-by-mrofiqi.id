import React, { useState } from 'react';
import {
  Coffee,
  Edit3,
  Plus,
  Save,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import {
  DailyExpenseItem,
  HangoutExpenseItem,
  MonthlyPeriodData,
  PaymentMethod,
  PeriodFinancialSummary,
} from '../types/finance';
import { computeDailyExpenseTotal, formatCompactIDR, formatIDR } from '../utils/calculations';

interface DailyTrackerViewProps {
  period: MonthlyPeriodData;
  summary: PeriodFinancialSummary;
  onAddDailyExpense: (item: Omit<DailyExpenseItem, 'id' | 'updatedAt'>) => void;
  onUpdateDailyExpense: (item: DailyExpenseItem) => void;
  onDeleteDailyExpense: (id: string) => void;
  onAddHangoutExpense: (item: Omit<HangoutExpenseItem, 'id' | 'updatedAt'>) => void;
  onUpdateHangoutExpense: (item: HangoutExpenseItem) => void;
  onDeleteHangoutExpense: (id: string) => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['BRI', 'BCA', 'BSI', 'COD', 'TF', 'GOPAY', 'DANA'];

export const DailyTrackerView: React.FC<DailyTrackerViewProps> = ({
  period,
  summary,
  onAddDailyExpense,
  onUpdateDailyExpense,
  onDeleteDailyExpense,
  onAddHangoutExpense,
  onUpdateHangoutExpense,
  onDeleteHangoutExpense,
}) => {
  // Form State: New Daily Expense
  const [date, setDate] = useState('26/10/26');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState<string>('1');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BRI');
  const [groupTag, setGroupTag] = useState<'OPERASIONAL' | 'AIRA_SAVING'>('OPERASIONAL');
  const [formError, setFormError] = useState<string | null>(null);

  // Inline Edit State: Daily Expense
  const [editingDailyId, setEditingDailyId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQty, setEditQty] = useState('1');
  const [editUnitPrice, setEditUnitPrice] = useState('0');
  const [editMethod, setEditMethod] = useState<PaymentMethod>('BRI');

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<'ALL' | 'OPERASIONAL' | 'AIRA_SAVING'>('ALL');

  // Form State: New Hangout / Nongkrong
  const [hangoutDate, setHangoutDate] = useState('26/10/26');
  const [placeOrEvent, setPlaceOrEvent] = useState('');
  const [hangoutAmount, setHangoutAmount] = useState<string>('');
  const [hangoutMethod, setHangoutMethod] = useState<PaymentMethod>('GOPAY');
  const [hangoutNote, setHangoutNote] = useState('');

  // Inline Edit State: Hangout / Nongkrong
  const [editingHangoutId, setEditingHangoutId] = useState<string | null>(null);
  const [editHangoutDate, setEditHangoutDate] = useState('');
  const [editHangoutPlace, setEditHangoutPlace] = useState('');
  const [editHangoutAmount, setEditHangoutAmount] = useState('0');
  const [editHangoutMethod, setEditHangoutMethod] = useState<PaymentMethod>('GOPAY');
  const [editHangoutNote, setEditHangoutNote] = useState('');

  const computedTotal = computeDailyExpenseTotal(Number(qty) || 0, Number(unitPrice) || 0);
  const computedEditTotal = computeDailyExpenseTotal(Number(editQty) || 0, Number(editUnitPrice) || 0);

  const handleSubmitDaily = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setFormError('Keterangan pengeluaran wajib diisi.');
      return;
    }
    const numericQty = Number(qty);
    const numericPrice = Number(unitPrice);
    if (!Number.isFinite(numericQty) || numericQty <= 0 || !Number.isFinite(numericPrice) || numericPrice < 0) {
      setFormError('Jumlah (Qty) dan Harga Satuan harus berupa angka valid.');
      return;
    }

    setFormError(null);
    onAddDailyExpense({
      date: date.trim() || '26/10/26',
      description: description.trim(),
      qty: numericQty,
      unitPrice: numericPrice,
      total: computeDailyExpenseTotal(numericQty, numericPrice),
      paymentMethod,
      groupTag,
    });

    setDescription('');
    setQty('1');
    setUnitPrice('');
  };

  const startEditDaily = (item: DailyExpenseItem) => {
    setEditingDailyId(item.id);
    setEditDate(item.date);
    setEditDescription(item.description);
    setEditQty(String(item.qty));
    setEditUnitPrice(String(item.unitPrice));
    setEditMethod(item.paymentMethod === 'PILIH' ? 'BSI' : item.paymentMethod);
  };

  const handleSaveEditDaily = (item: DailyExpenseItem) => {
    if (!editDescription.trim()) return;
    const numericQty = Math.max(1, Number(editQty) || 1);
    const numericPrice = Math.max(0, Number(editUnitPrice) || 0);
    const updatedItem: DailyExpenseItem = {
      ...item,
      date: editDate.trim() || item.date,
      description: editDescription.trim(),
      qty: numericQty,
      unitPrice: numericPrice,
      total: computeDailyExpenseTotal(numericQty, numericPrice),
      paymentMethod: editMethod,
      updatedAt: new Date().toISOString(),
    };
    onUpdateDailyExpense(updatedItem);
    setEditingDailyId(null);
  };

  const handleSubmitHangout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeOrEvent.trim()) return;
    const numericAmount = Number(hangoutAmount) || 0;
    onAddHangoutExpense({
      date: hangoutDate.trim() || '26/10/26',
      placeOrEvent: placeOrEvent.trim(),
      amount: numericAmount,
      paymentMethod: hangoutMethod,
      note: hangoutNote.trim() || 'Nongkrong / Sosial',
    });
    setPlaceOrEvent('');
    setHangoutAmount('');
    setHangoutNote('');
  };

  const startEditHangout = (he: HangoutExpenseItem) => {
    setEditingHangoutId(he.id);
    setEditHangoutDate(he.date);
    setEditHangoutPlace(he.placeOrEvent);
    setEditHangoutAmount(String(he.amount));
    setEditHangoutMethod(he.paymentMethod);
    setEditHangoutNote(he.note);
  };

  const handleSaveEditHangout = (he: HangoutExpenseItem) => {
    if (!editHangoutPlace.trim()) return;
    const updated: HangoutExpenseItem = {
      ...he,
      date: editHangoutDate.trim() || he.date,
      placeOrEvent: editHangoutPlace.trim(),
      amount: Math.max(0, Number(editHangoutAmount) || 0),
      paymentMethod: editHangoutMethod,
      note: editHangoutNote.trim() || he.note,
      updatedAt: new Date().toISOString(),
    };
    onUpdateHangoutExpense(updated);
    setEditingHangoutId(null);
  };

  const filteredDaily = period.dailyExpenses.filter((item) => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.date.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMethod = methodFilter === 'ALL' || item.paymentMethod === methodFilter;
    const matchesTag = tagFilter === 'ALL' || item.groupTag === tagFilter;
    return matchesSearch && matchesMethod && matchesTag;
  });

  const filteredDailyTotal = filteredDaily.reduce((acc, i) => acc + i.total, 0);

  return (
    <div className="space-y-6">
      {/* TOP RECAP STRIP: COD, TF, BRI, BSI & FREKUENSI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-3xl liquid-glass-interactive p-4">
          <span className="text-xs text-slate-300">Total Tracker Harian ({summary.dailyTrackerCount}x)</span>
          <p
            data-testid="tracker-daily-total"
            className="mt-1.5 text-xl font-bold font-mono tabular-nums text-emerald-400"
          >
            {formatIDR(summary.dailyTrackerTotal)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Umum: {formatCompactIDR(summary.dailyTrackerOperationalTotal)} · Aira: {formatCompactIDR(summary.dailyTrackerAiraSavingTotal)}
          </p>
        </div>

        <div className="rounded-3xl liquid-glass-interactive p-4">
          <span className="text-xs text-slate-300">Rekap Total COD</span>
          <p
            data-testid="tracker-cod-total"
            className="mt-1.5 text-xl font-bold font-mono tabular-nums text-amber-300"
          >
            {formatIDR(summary.totalCodExpenses)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Pembayaran Tunai / Kurir</p>
        </div>

        <div className="rounded-3xl liquid-glass-interactive p-4">
          <span className="text-xs text-slate-300">Rekap Total Transfer (TF)</span>
          <p
            data-testid="tracker-tf-total"
            className="mt-1.5 text-xl font-bold font-mono tabular-nums text-sky-400"
          >
            {formatIDR(summary.totalTfExpenses)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">BRI: {formatCompactIDR(summary.totalBriExpenses)} · BSI: {formatCompactIDR(summary.totalBsiExpenses)}</p>
        </div>

        <div className="rounded-3xl liquid-glass-interactive p-4">
          <span className="text-xs text-slate-300">Jajan & Nongkrong ({summary.hangoutTrackerCount}x)</span>
          <p
            data-testid="tracker-hangout-total"
            className="mt-1.5 text-xl font-bold font-mono tabular-nums text-rose-400"
          >
            {formatIDR(summary.hangoutTrackerTotal)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Plafon Rencana: Rp 1,5 Jt</p>
        </div>
      </div>

      {/* SECTION 1: TRACKER PENGELUARAN SEHARI-HARI DALAM 1 BULAN */}
      <section className="rounded-3xl liquid-glass-interactive p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-white">
                Tracker Pengeluaran Sehari-hari dalam 1 Bulan ({period.monthLabel})
              </h2>
              <p className="text-xs text-slate-300">
                Kalkulasi otomatis Qty × Harga Satuan · Bisa tambah, revisi/edit, simpan & hapus otomatis ke database
              </p>
            </div>
          </div>
        </div>

        {/* Form Input Pengeluaran Sehari-hari */}
        <form
          onSubmit={handleSubmitDaily}
          className="mt-4 p-4 rounded-2xl liquid-glass-inset space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-2">
              <label htmlFor="daily-date-input" className="block text-xs text-slate-400 mb-1">
                Tanggal (DD/MM/YY)
              </label>
              <input
                id="daily-date-input"
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100"
                placeholder="26/10/26"
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="daily-desc-input" className="block text-xs text-slate-400 mb-1">
                Keterangan Pengeluaran
              </label>
              <input
                id="daily-desc-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                placeholder="Contoh: Belanja Dapur / Mie Gacoan"
              />
            </div>

            <div className="sm:col-span-1">
              <label htmlFor="daily-qty-input" className="block text-xs text-slate-400 mb-1">
                Qty
              </label>
              <input
                id="daily-qty-input"
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 text-center"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="daily-price-input" className="block text-xs text-slate-400 mb-1">
                Harga Satuan (Rp)
              </label>
              <input
                id="daily-price-input"
                type="number"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100"
                placeholder="50000"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="daily-method-select" className="block text-xs text-slate-400 mb-1">
                Metode Bayar
              </label>
              <select
                id="daily-method-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-400">Kelompok Pos:</span>
              <button
                type="button"
                onClick={() => setGroupTag('OPERASIONAL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  groupTag === 'OPERASIONAL'
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Umum / Operasional
              </button>
              <button
                type="button"
                onClick={() => setGroupTag('AIRA_SAVING')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  groupTag === 'AIRA_SAVING'
                    ? 'bg-slate-800 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Jajan De Aira + Nabung
              </button>
            </div>

            <div className="font-mono tabular-nums text-slate-300">
              Total Otomatis (Qty × Harga):{' '}
              <strong className="text-emerald-400">{formatIDR(computedTotal)}</strong>
            </div>
          </div>

          {formError && <p className="text-xs text-rose-400 font-medium">{formError}</p>}
        </form>

        {/* Filter & Search Bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cari transaksi harian"
              placeholder="Cari nama transaksi atau tanggal..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
            {(['ALL', 'OPERASIONAL', 'AIRA_SAVING'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTagFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  tagFilter === t
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'ALL' ? 'Semua Pos' : t === 'OPERASIONAL' ? 'Belanja & Ops' : 'Jajan Aira'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
            {['ALL', ...PAYMENT_METHODS].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  methodFilter === m
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'ALL' ? 'Semua Metode' : m}
              </button>
            ))}
          </div>
        </div>

        {/* Tabel Daftar Pengeluaran Harian (Bisa Direvisi, Disimpan & Dihapus) */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                <th className="py-2.5 pr-3">Tanggal</th>
                <th className="py-2.5 px-3">Keterangan</th>
                <th className="py-2.5 px-3 text-center">Jumlah (Qty)</th>
                <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                <th className="py-2.5 px-3 text-right">Total Otomatis</th>
                <th className="py-2.5 px-3 text-center">Metode</th>
                <th className="py-2.5 pl-3 text-right">Revisi / Hapus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredDaily.map((item) => {
                const isEditing = editingDailyId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isEditing ? 'bg-slate-800/60' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          aria-label={`Edit tanggal ${item.description}`}
                          className="w-24 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-xs text-slate-100"
                        />
                      ) : (
                        item.date
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-100">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          aria-label={`Edit keterangan ${item.description}`}
                          className="w-full min-w-[160px] px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100"
                        />
                      ) : (
                        item.description
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-300">
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          aria-label={`Edit jumlah qty ${item.description}`}
                          className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-center font-mono text-xs text-slate-100"
                        />
                      ) : (
                        item.qty
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          value={editUnitPrice}
                          onChange={(e) => setEditUnitPrice(e.target.value)}
                          aria-label={`Edit harga satuan ${item.description}`}
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-right font-mono text-xs text-amber-300"
                        />
                      ) : (
                        formatIDR(item.unitPrice)
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-400 whitespace-nowrap">
                      {isEditing ? formatIDR(computedEditTotal) : formatIDR(item.total)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-200">
                      {isEditing ? (
                        <select
                          value={editMethod}
                          onChange={(e) => setEditMethod(e.target.value as PaymentMethod)}
                          aria-label={`Edit metode bayar ${item.description}`}
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-xs text-slate-100"
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      ) : (
                        item.paymentMethod
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEditDaily(item)}
                              aria-label={`Simpan revisi ${item.description}`}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Simpan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDailyId(null)}
                              aria-label="Batal revisi"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditDaily(item)}
                              aria-label={`Revisi transaksi ${item.description}`}
                              className="px-2 py-1 rounded-lg text-slate-300 hover:text-emerald-400 hover:bg-slate-800 inline-flex items-center gap-1 text-xs cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Revisi</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteDailyExpense(item.id)}
                              aria-label={`Hapus transaksi ${item.description} ${item.date}`}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-700 font-semibold text-xs">
                <td colSpan={4} className="pt-3 text-slate-300">
                  TOTAL PENGELUARAN TERFILTER ({filteredDaily.length} Transaksi)
                </td>
                <td className="pt-3 px-3 text-right font-mono tabular-nums text-emerald-400 text-sm">
                  {formatIDR(filteredDailyTotal)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* SECTION 2: TRACKER JAJAN / NONGKRONG DALAM 1 BULAN */}
      <section className="rounded-3xl liquid-glass-interactive p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Coffee className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-white">
                Tracker Jajan & Nongkrong dalam 1 Bulan
              </h2>
              <p className="text-xs text-slate-300">
                Pantau frekuensi nongkrong, kondangan & pengeluaran gaya hidup agar tetap di bawah plafon Rp 1.500.000
              </p>
            </div>
          </div>
          <span className="text-xs font-mono tabular-nums text-amber-300 font-semibold">
            Total Dihabiskan: {formatIDR(summary.hangoutTrackerTotal)} ({summary.hangoutTrackerCount}x)
          </span>
        </div>

        <form
          onSubmit={handleSubmitHangout}
          className="mt-4 p-4 rounded-2xl liquid-glass-inset grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
        >
          <div className="sm:col-span-2">
            <label htmlFor="hangout-date" className="block text-xs text-slate-400 mb-1">
              Tanggal
            </label>
            <input
              id="hangout-date"
              type="text"
              value={hangoutDate}
              onChange={(e) => setHangoutDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100"
              placeholder="26/10/26"
            />
          </div>
          <div className="sm:col-span-4">
            <label htmlFor="hangout-place" className="block text-xs text-slate-400 mb-1">
              Nama Tempat / Keterangan Nongkrong
            </label>
            <input
              id="hangout-place"
              type="text"
              value={placeOrEvent}
              onChange={(e) => setPlaceOrEvent(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
              placeholder="Contoh: Kopi Kenangan / Bantu Nikah JHR"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="hangout-amount" className="block text-xs text-slate-400 mb-1">
              Dihabiskan (Rp)
            </label>
            <input
              id="hangout-amount"
              type="number"
              min="0"
              value={hangoutAmount}
              onChange={(e) => setHangoutAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100"
              placeholder="35000"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="hangout-method" className="block text-xs text-slate-400 mb-1">
              Metode
            </label>
            <select
              id="hangout-method"
              value={hangoutMethod}
              onChange={(e) => setHangoutMethod(e.target.value as PaymentMethod)}
              className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Jajan</span>
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                <th className="py-2 pr-3">Tanggal</th>
                <th className="py-2 px-3">Nongkrong / Kegiatan</th>
                <th className="py-2 px-3 text-right">Dihabiskan</th>
                <th className="py-2 px-3 text-center">Metode</th>
                <th className="py-2 px-3">Catatan</th>
                <th className="py-2 pl-3 text-right">Revisi / Hapus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {period.hangoutExpenses.map((he) => {
                const isEditing = editingHangoutId === he.id;
                return (
                  <tr key={he.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 pr-3 font-mono text-slate-400">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editHangoutDate}
                          onChange={(e) => setEditHangoutDate(e.target.value)}
                          className="w-24 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-xs text-slate-100"
                        />
                      ) : (
                        he.date
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-100">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editHangoutPlace}
                          onChange={(e) => setEditHangoutPlace(e.target.value)}
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100"
                        />
                      ) : (
                        he.placeOrEvent
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-amber-300">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          value={editHangoutAmount}
                          onChange={(e) => setEditHangoutAmount(e.target.value)}
                          className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-right font-mono text-xs text-amber-300"
                        />
                      ) : (
                        formatIDR(he.amount)
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-200">
                      {isEditing ? (
                        <select
                          value={editHangoutMethod}
                          onChange={(e) => setEditHangoutMethod(e.target.value as PaymentMethod)}
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-xs text-slate-100"
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      ) : (
                        he.paymentMethod
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editHangoutNote}
                          onChange={(e) => setEditHangoutNote(e.target.value)}
                          className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100"
                        />
                      ) : (
                        he.note
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEditHangout(he)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Simpan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingHangoutId(null)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditHangout(he)}
                              aria-label={`Revisi jajan ${he.placeOrEvent}`}
                              className="px-2 py-1 rounded-lg text-slate-300 hover:text-emerald-400 hover:bg-slate-800 inline-flex items-center gap-1 text-xs cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Revisi</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteHangoutExpense(he.id)}
                              aria-label={`Hapus jajan ${he.placeOrEvent}`}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
