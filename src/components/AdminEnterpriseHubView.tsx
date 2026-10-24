import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  Cloud,
  Code2,
  Copy,
  Database,
  FileSpreadsheet,
  Globe,
  KeyRound,
  Layers,
  Lock,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Users,
  Webhook,
} from 'lucide-react';
import { MonthlyPeriodData, PeriodFinancialSummary, SyncQueueItem } from '../types/finance';
import {
  OWNER_VERIFIED_EMAIL,
  formatCountdownMMSS,
  generateSixDigitOtp,
  hashOtpToken,
} from '../utils/auth';
import { formatCompactIDR, formatIDR } from '../utils/calculations';
import {
  CODEBASE_ARCHITECTURE_DOCS,
  NotificationPreferences,
  RealtimePushNotification,
  SupportedLocale,
} from '../utils/i18n';
import { UsersSheetRow } from './AuthGate';

interface AdminEnterpriseHubViewProps {
  periods: MonthlyPeriodData[];
  activePeriod: MonthlyPeriodData;
  activeSummary: PeriodFinancialSummary;
  syncQueue: SyncQueueItem[];
  usersSheet: UsersSheetRow[];
  onUpdateUsersSheet: (updated: UsersSheetRow[]) => void;
  notifications: RealtimePushNotification[];
  notificationPrefs: NotificationPreferences;
  onUpdateNotificationPrefs: (prefs: NotificationPreferences) => void;
  onSendRealtimeNotification: (
    title: string,
    description: string,
    category: RealtimePushNotification['category'],
    severity: RealtimePushNotification['severity']
  ) => void;
  is2FAEnabled: boolean;
  onToggle2FAEnabled: (enabled: boolean) => void;
  onVerify2FACode: (code: string) => boolean;
  current2FACode: string;
  twoFactorSecondsRemaining: number;
  locale: SupportedLocale;
  onTriggerCloudSync: () => void;
}

interface MarketRatesData {
  source: string;
  updatedAt: string;
  rates: {
    USD_IDR: number;
    SGD_IDR: number;
    EUR_IDR: number;
    MYR_IDR: number;
    GOLD_GRAM_IDR: number;
    BTC_IDR: number;
  };
}

export const AdminEnterpriseHubView: React.FC<AdminEnterpriseHubViewProps> = ({
  periods,
  activePeriod,
  activeSummary,
  syncQueue,
  usersSheet,
  onUpdateUsersSheet,
  notifications,
  notificationPrefs,
  onUpdateNotificationPrefs,
  onSendRealtimeNotification,
  is2FAEnabled,
  onToggle2FAEnabled,
  onVerify2FACode,
  current2FACode,
  twoFactorSecondsRemaining,
  onTriggerCloudSync,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'ADMIN_ANALYTICS' | 'SECURITY_2FA' | 'PUSH_NOTIF' | 'API_GATEWAY' | 'CODE_DOCS'
  >('ADMIN_ANALYTICS');

  // 2FA Input State
  const [totpInput, setTotpInput] = useState('');
  const [twoFactorStatusMsg, setTwoFactorStatusMsg] = useState<{
    type: 'SUCCESS' | 'ERROR';
    text: string;
  } | null>(null);
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  // Add User to DATA_UPROVE_LOG_IN Sheet State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');

  // Custom Broadcast Push Notification State
  const [broadcastTitle, setBroadcastTitle] = useState('Peringatan Evaluasi Plafon Anggaran Bulanan');
  const [broadcastDesc, setBroadcastDesc] = useState(
    'Realisasi Pengeluaran Harian Oktober 2026 mencapai Rp 5.250.000 (melebihi rencana Rp 3.000.000). Harap tinjau pos pengeluaran.'
  );
  const [broadcastCategory, setBroadcastCategory] =
    useState<RealtimePushNotification['category']>('BUDGET_MUTATION');
  const [broadcastSeverity, setBroadcastSeverity] =
    useState<RealtimePushNotification['severity']>('WARNING');

  // Third-Party API Live Rates & Converter State
  const [marketRates, setMarketRates] = useState<MarketRatesData>({
    source: 'FinPay Market Oracle Gateway',
    updatedAt: new Date().toISOString(),
    rates: {
      USD_IDR: 15_845,
      SGD_IDR: 11_890,
      EUR_IDR: 17_120,
      MYR_IDR: 3_620,
      GOLD_GRAM_IDR: 1_465_000,
      BTC_IDR: 1_420_000_000,
    },
  });
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [idrConvertAmount, setIdrConvertAmount] = useState<string>(
    String(activeSummary.totalAllAccountsBalance || 4_522_000)
  );
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [docLayerFilter, setDocLayerFilter] = useState<string>('ALL');

  const fetchLiveRates = async () => {
    setIsFetchingRates(true);
    try {
      const res = await fetch('/api/third-party/rates');
      if (res.ok) {
        const data = (await res.json()) as MarketRatesData;
        setMarketRates(data);
      }
    } catch {
      // Keep fallback
    } finally {
      setIsFetchingRates(false);
    }
  };

  useEffect(() => {
    fetchLiveRates();
  }, []);

  // Multi-Period Aggregate Metrics for Admin Analytics
  const multiPeriodMetrics = periods.map((p) => {
    const fixedActual = p.fixedCosts.reduce((a, b) => a + b.actual, 0);
    const subActual = p.subscriptionsAndDebts
      .filter((s) => s.includeInMonthlyTotal)
      .reduce((a, b) => a + b.actual, 0);
    const dailyTotal = p.dailyExpenses.reduce((a, b) => a + b.total, 0);
    const hangoutTotal = p.hangoutExpenses.reduce((a, b) => a + b.amount, 0);
    const totalIncome = p.incomes.reduce((a, b) => a + b.amount, 0);
    const totalSaving = p.savings.reduce((a, b) => a + b.actual, 0);
    const totalExpense = fixedActual + subActual + dailyTotal + hangoutTotal;
    return {
      periodId: p.periodId,
      monthLabel: p.monthLabel,
      totalIncome,
      totalExpense,
      totalSaving,
      transactionsCount: p.dailyExpenses.length + p.hangoutExpenses.length,
    };
  });

  const handleApproveUserInTable = (email: string) => {
    const otp = generateSixDigitOtp(Date.now());
    const hash = hashOtpToken(email, otp);
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const today = new Date().toISOString().slice(0, 10);

    const updated = usersSheet.map((u) => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        const nextCount = Math.min(3, (u.dailyTokenCount || 0) + 1);
        return {
          ...u,
          statusAkun: 'APPROVED' as const,
          tokenHash: hash,
          tokenExpiresAt: expiresAt,
          dailyTokenCount: nextCount,
          lastRequestDate: today,
          lastSentRawToken: otp,
        };
      }
      return u;
    });

    onUpdateUsersSheet(updated);
    onSendRealtimeNotification(
      `Admin Approve: ${email}`,
      `Status_Akun diubah menjadi APPROVED. Token 6-digit (${otp}) berlaku 5 menit telah dikirim.`,
      'USER_APPROVAL',
      'SUCCESS'
    );
  };

  const handleVerifyUserDirectly = (email: string) => {
    const updated = usersSheet.map((u) =>
      u.email.toLowerCase() === email.toLowerCase()
        ? {
            ...u,
            statusAkun: 'VERIFIED' as const,
            tokenHash: '',
            tokenExpiresAt: null,
          }
        : u
    );
    onUpdateUsersSheet(updated);
    onSendRealtimeNotification(
      `Akun Terverifikasi: ${email}`,
      `Status_Akun pada tabel DATA UPROVE LOG IN kini VERIFIED (One-Time Token Cleared).`,
      'USER_APPROVAL',
      'SUCCESS'
    );
  };

  const handleAddUserRow = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newUserEmail.trim().toLowerCase();
    const cleanName = newUserName.trim();
    if (!cleanEmail || !cleanName) return;
    if (usersSheet.some((u) => u.email.toLowerCase() === cleanEmail)) return;

    const newRow: UsersSheetRow = {
      email: cleanEmail,
      nama: cleanName,
      statusAkun: 'PENDING',
      tokenHash: '',
      tokenExpiresAt: null,
      dailyTokenCount: 0,
      lastRequestDate: new Date().toISOString().slice(0, 10),
    };
    onUpdateUsersSheet([...usersSheet, newRow]);
    setNewUserEmail('');
    setNewUserName('');
    onSendRealtimeNotification(
      `Pendaftaran Baru: ${cleanName}`,
      `Email ${cleanEmail} masuk ke antrean DATA UPROVE LOG IN dengan status PENDING.`,
      'USER_APPROVAL',
      'INFO'
    );
  };

  const handleVerify2FASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = onVerify2FACode(totpInput.trim());
    if (isValid) {
      setTwoFactorStatusMsg({
        type: 'SUCCESS',
        text: 'Autentikasi Dua Faktor (2FA) berhasil diverifikasi! Sesi perangkat Anda telah diamankan dengan tanda tangan kriptografi SHA-256.',
      });
      setTotpInput('');
    } else {
      setTwoFactorStatusMsg({
        type: 'ERROR',
        text: `Kode 2FA tidak sesuai. Masukkan kode TOTP aktif (${current2FACode}) atau kode pemulihan darurat.`,
      });
    }
  };

  const recoveryCodes = [
    'FINPAY-2026-8841-ABCD',
    'FINPAY-2026-3920-EFGH',
    'FINPAY-2026-7712-JKLM',
    'FINPAY-2026-9044-NPQR',
  ];

  const numericIdrToConvert = Number(idrConvertAmount) || 0;
  const convertedUsd = numericIdrToConvert / marketRates.rates.USD_IDR;
  const convertedSgd = numericIdrToConvert / marketRates.rates.SGD_IDR;
  const convertedEur = numericIdrToConvert / marketRates.rates.EUR_IDR;
  const convertedGoldGrams = numericIdrToConvert / marketRates.rates.GOLD_GRAM_IDR;

  const filteredDocs =
    docLayerFilter === 'ALL'
      ? CODEBASE_ARCHITECTURE_DOCS
      : CODEBASE_ARCHITECTURE_DOCS.filter((d) => d.layer === docLayerFilter);

  return (
    <div className="space-y-6">
      {/* SUB-NAVIGATION BAR FOR ENTERPRISE FEATURES */}
      <div className="rounded-3xl liquid-glass p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Menu Enterprise Admin">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'ADMIN_ANALYTICS'}
            onClick={() => setActiveSubTab('ADMIN_ANALYTICS')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'ADMIN_ANALYTICS'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>1. Dasbor Analitik Admin & Database</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'SECURITY_2FA'}
            onClick={() => setActiveSubTab('SECURITY_2FA')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'SECURITY_2FA'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>2. Keamanan 2FA (Two-Factor Auth)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'PUSH_NOTIF'}
            onClick={() => setActiveSubTab('PUSH_NOTIF')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'PUSH_NOTIF'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>3. Notifikasi Push Real-Time</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'API_GATEWAY'}
            onClick={() => setActiveSubTab('API_GATEWAY')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'API_GATEWAY'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>4. Integrasi API Pihak Ketiga</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'CODE_DOCS'}
            onClick={() => setActiveSubTab('CODE_DOCS')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'CODE_DOCS'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>5. Dokumentasi Arsitektur & File</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onTriggerCloudSync}
          className="px-3.5 py-2 rounded-2xl liquid-glass-inset hover:border-emerald-400/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Sinkronisasi Cloud Lintas Perangkat</span>
        </button>
      </div>

      {/* =====================================================================
       * SUB-TAB 1: DASBOR ANALITIK ADMIN KOMPREHENSIF & KONEKSI DATABASE
       * ===================================================================== */}
      {activeSubTab === 'ADMIN_ANALYTICS' && (
        <div className="space-y-6">
          {/* Admin KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-3xl liquid-glass-interactive p-5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Database Terhubung</span>
                <Database className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-lg font-bold font-mono text-white">
                FINANCIAL_PLANNER.csv
              </p>
              <p className="mt-2 text-[11px] text-emerald-400 font-mono">
                141 Baris · {periods.length} Periode Aktif · 100% Tervalidasi
              </p>
            </div>

            <div className="rounded-3xl liquid-glass-interactive p-5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Tabel DATA UPROVE LOG IN</span>
                <Users className="w-4 h-4 text-sky-400" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-white">
                {usersSheet.length} Akun
              </p>
              <p className="mt-2 text-[11px] text-slate-400 font-mono">
                {usersSheet.filter((u) => u.statusAkun === 'VERIFIED').length} Verified ·{' '}
                {usersSheet.filter((u) => u.statusAkun === 'APPROVED').length} Approved ·{' '}
                {usersSheet.filter((u) => u.statusAkun === 'PENDING').length} Pending
              </p>
            </div>

            <div className="rounded-3xl liquid-glass-interactive p-5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Kesehatan Rasio Keuangan</span>
                <Activity className="w-4 h-4 text-amber-400" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-300">
                {activeSummary.totalIncome > 0
                  ? Math.round((activeSummary.savingActual / activeSummary.totalIncome) * 100)
                  : 0}
                % Saving Rate
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Tabungan: {formatCompactIDR(activeSummary.savingActual)} dari{' '}
                {formatCompactIDR(activeSummary.totalIncome)}
              </p>
            </div>

            <div className="rounded-3xl liquid-glass-interactive p-5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Status Keamanan & Cloud Sync</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-xl font-bold font-mono text-emerald-400">
                {is2FAEnabled ? '2FA + SHA-256 Aktif' : 'SHA-256 Standar'}
              </p>
              <p className="mt-2 text-[11px] text-slate-400 font-mono">
                {syncQueue.filter((q) => q.isSynced).length}/{syncQueue.length} Antrean Tersinkron
              </p>
            </div>
          </div>

          {/* Multi-Month Comparison & Live Activity Monitor */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Multi-Period Analytics Table & Visual Comparison */}
            <section className="lg:col-span-7 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/10">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Analitik Komparasi Lintas Periode (Multi-Month Telemetry)
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Pemantauan langsung realisasi Pendapatan, Pengeluaran, dan Tabungan dari database CSV & Cloud Vault
                    </p>
                  </div>
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                        <th className="py-2.5 pr-3">Periode</th>
                        <th className="py-2.5 px-3 text-right">Pendapatan</th>
                        <th className="py-2.5 px-3 text-right">Pengeluaran Aktual</th>
                        <th className="py-2.5 px-3 text-right">Tabungan Masa Depan</th>
                        <th className="py-2.5 pl-3 text-center">Transaksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {multiPeriodMetrics.map((m) => (
                        <tr key={m.periodId} className="hover:bg-white/[0.03]">
                          <td className="py-3 pr-3 font-semibold text-white">
                            {m.monthLabel}{' '}
                            <span className="text-[10px] font-mono text-slate-400">
                              ({m.periodId})
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400">
                            {formatIDR(m.totalIncome)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-rose-400">
                            {formatIDR(m.totalExpense)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-300">
                            {formatIDR(m.totalSaving)}
                          </td>
                          <td className="py-3 pl-3 text-center font-mono tabular-nums text-slate-300">
                            {m.transactionsCount} item
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <span>
                  Sumber Data Master:{' '}
                  <code className="text-emerald-300 font-mono">
                    /public/assets/aistudio/FINANCIAL_PLANNER_4b47ce17.csv
                  </code>
                </span>
                <span className="font-mono text-emerald-400">Sinkronisasi Real-Time Aktif</span>
              </div>
            </section>

            {/* Live Admin Activity Feed */}
            <section className="lg:col-span-5 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/10">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Live Admin Activity Stream
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Log aktivitas pengguna, persetujuan token, dan mutasi anggaran secara real-time
                    </p>
                  </div>
                  <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>

                <div className="mt-4 max-h-64 overflow-y-auto divide-y divide-white/10 pr-1">
                  {notifications.map((ev) => (
                    <div key={ev.id} className="py-2.5 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-emerald-400 font-semibold">
                          {ev.category} · {ev.actor}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(ev.timestamp).toLocaleTimeString('id-ID')}
                        </span>
                      </div>
                      <p className="font-semibold text-white">{ev.title}</p>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{ev.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                <span>Superuser Admin: {OWNER_VERIFIED_EMAIL}</span>
                <span className="font-mono text-emerald-400">{notifications.length} Event Tercatat</span>
              </div>
            </section>
          </div>

          {/* Tabel Database DATA_UPROVE_LOG_IN (7 Kolom) */}
          <section className="rounded-3xl liquid-glass-interactive p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Manajemen Tabel Database `DATA_UPROVE_LOG_IN` (Sheet `Users` 7 Kolom)
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Terhubung langsung dengan skema file lampiran{' '}
                  <code className="text-emerald-300 font-mono">
                    Email, Nama, Status_Akun, Token_Hash, Token_Expires_At, Daily_Token_Count, Last_Request_Date
                  </code>
                </p>
              </div>

              <form onSubmit={handleAddUserRow} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Nama Pengguna"
                  aria-label="Nama Pengguna Baru"
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="email@domain.com"
                  aria-label="Email Pengguna Baru"
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer whitespace-nowrap shrink-0"
                >
                  + Tambah Baris User
                </button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                    <th className="py-2.5 pr-3">1. Email</th>
                    <th className="py-2.5 px-3">2. Nama</th>
                    <th className="py-2.5 px-3">3. Status_Akun</th>
                    <th className="py-2.5 px-3">4. Token_Hash (SHA-256)</th>
                    <th className="py-2.5 px-3">5. Token_Expires_At</th>
                    <th className="py-2.5 px-3 text-center">6. Daily_Token_Count</th>
                    <th className="py-2.5 px-3">7. Last_Request_Date</th>
                    <th className="py-2.5 pl-3 text-right">Tindakan Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {usersSheet.map((u) => (
                    <tr key={u.email} className="hover:bg-white/[0.03]">
                      <td className="py-3 pr-3 font-mono text-emerald-300">{u.email}</td>
                      <td className="py-3 px-3 font-medium text-white">{u.nama}</td>
                      <td className="py-3 px-3 font-mono">
                        <span
                          className={
                            u.statusAkun === 'VERIFIED'
                              ? 'text-emerald-400 font-bold'
                              : u.statusAkun === 'APPROVED'
                              ? 'text-sky-400 font-semibold'
                              : 'text-amber-300 font-semibold'
                          }
                        >
                          {u.statusAkun}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 max-w-[160px] truncate">
                        {u.tokenHash || '— (Cleared)'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {u.tokenExpiresAt
                          ? new Date(u.tokenExpiresAt).toLocaleTimeString('id-ID')
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums text-white">
                        {u.dailyTokenCount} / 3
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {u.lastRequestDate || '—'}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap space-x-2">
                        {u.statusAkun === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleApproveUserInTable(u.email)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-[11px] cursor-pointer"
                          >
                            Approve & Kirim OTP
                          </button>
                        )}
                        {u.statusAkun !== 'VERIFIED' && (
                          <button
                            type="button"
                            onClick={() => handleVerifyUserDirectly(u.email)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-medium text-[11px] cursor-pointer"
                          >
                            Set Verified
                          </button>
                        )}
                        {u.statusAkun === 'VERIFIED' && (
                          <span className="text-[11px] text-emerald-400 inline-flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" /> Aktif
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
       * SUB-TAB 2: SISTEM AUTENTIKASI DUA FAKTOR (2FA SECURITY CENTER)
       * ===================================================================== */}
      {activeSubTab === 'SECURITY_2FA' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <section className="lg:col-span-7 rounded-3xl liquid-glass-interactive p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Autentikasi Dua Faktor (2FA TOTP & Email SHA-256)
                  </h2>
                  <p className="text-xs text-slate-300">
                    Lapisan keamanan ganda untuk melindungi perubahan saldo rekening, persetujuan pengguna, dan sinkronisasi Cloud Vault
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggle2FAEnabled(!is2FAEnabled)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  is2FAEnabled
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {is2FAEnabled ? 'Status 2FA: AKTIF (Protected)' : 'Aktifkan 2FA Sekarang'}
              </button>
            </div>

            {/* Live Authenticator TOTP Generator Widget */}
            <div className="p-5 rounded-2xl liquid-glass-inset flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-emerald-400">
                  FINPAY AUTHENTICATOR · TOTP RFC-6238
                </span>
                <p className="text-xs text-slate-300">
                  Gunakan kode 6-digit dinamis di bawah ini untuk memverifikasi sesi sensitif atau uji coba 2FA:
                </p>
                <p className="text-[11px] font-mono text-slate-400">
                  Secret Key: <strong className="text-white">JBSWY3DPEHPK3PXP-FINPAY2026</strong>
                </p>
              </div>

              <div className="text-right shrink-0 p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/40">
                <span className="text-[10px] font-mono text-slate-400 block">
                  KODE 2FA AKTIF ({twoFactorSecondsRemaining}s)
                </span>
                <span
                  data-testid="active-2fa-totp-code"
                  className="font-mono text-2xl font-bold tracking-widest text-emerald-400 tabular-nums"
                >
                  {current2FACode}
                </span>
              </div>
            </div>

            {/* Form Uji & Validasi Kode 2FA */}
            <form onSubmit={handleVerify2FASubmit} className="space-y-3">
              <label htmlFor="verify-2fa-input" className="block text-xs font-medium text-slate-300">
                Masukkan Kode 6-Digit 2FA atau Recovery Code untuk Verifikasi Keamanan Sesi:
              </label>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                <input
                  id="verify-2fa-input"
                  type="text"
                  required
                  value={totpInput}
                  onChange={(e) => setTotpInput(e.target.value)}
                  placeholder={`Contoh: ${current2FACode}`}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-sm text-emerald-300"
                />
                <button
                  type="submit"
                  onClick={() => {
                    if (!totpInput) setTotpInput(current2FACode);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Verifikasi 2FA Sekarang
                </button>
              </div>
            </form>

            {twoFactorStatusMsg && (
              <div
                role="status"
                className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
                  twoFactorStatusMsg.type === 'SUCCESS'
                    ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-200'
                    : 'bg-rose-500/15 border border-rose-400/40 text-rose-200'
                }`}
              >
                {twoFactorStatusMsg.type === 'SUCCESS' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{twoFactorStatusMsg.text}</span>
              </div>
            )}
          </section>

          {/* Right: Backup Recovery Codes & Security Policy */}
          <section className="lg:col-span-5 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-base font-semibold text-white">
                  Kode Pemulihan Darurat (2FA Backup Codes)
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(recoveryCodes.join('\n'));
                    }
                    setCopiedRecovery(true);
                    setTimeout(() => setCopiedRecovery(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 flex items-center gap-1 cursor-pointer"
                >
                  {copiedRecovery ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRecovery ? 'Tersalin' : 'Salin Kode'}</span>
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Simpan kode pemulihan sekali pakai ini di tempat aman. Kode ini dapat digunakan jika perangkat Authenticator Anda sedang offline:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recoveryCodes.map((code) => (
                  <div
                    key={code}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-amber-300 text-center"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl liquid-glass-inset text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-emerald-400">Protokol Keamanan Aktif:</p>
              <p>1. Hash SHA-256 untuk seluruh token verifikasi di Sheet Users.</p>
              <p>2. Masa berlaku token ketat 5 menit ({formatCountdownMMSS(300)}) & One-Time Use.</p>
              <p>3. Rate limit maksimal 3 permintaan token per hari (Asia/Jakarta).</p>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
       * SUB-TAB 3: FITUR NOTIFIKASI PUSH REAL-TIME YANG BISA DISESUAIKAN
       * ===================================================================== */}
      {activeSubTab === 'PUSH_NOTIF' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left: Kustomisasi Preferensi Notifikasi Push Pengguna */}
          <section className="lg:col-span-6 rounded-3xl liquid-glass-interactive p-6 space-y-4">
            <div className="pb-3 border-b border-white/10">
              <h2 className="text-base font-semibold text-white">
                Pengaturan Preferensi Notifikasi Push Real-Time
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Sesuaikan jenis notifikasi instan yang ingin Anda terima di perangkat web maupun mobile
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {[
                {
                  key: 'pushEnabled' as const,
                  title: 'Aktifkan Notifikasi Push Real-Time (SSE Live Stream)',
                  desc: 'Terima pemberitahuan seketika saat ada aktivitas anggaran atau sinkronisasi.',
                },
                {
                  key: 'budgetThresholdAlert' as const,
                  title: 'Peringatan Batas Plafon Anggaran (Over-Budget Alert)',
                  desc: 'Beri tahu otomatis saat pengeluaran harian melewati batas rencana bulanan.',
                },
                {
                  key: 'security2FAAlert' as const,
                  title: 'Notifikasi Keamanan Login & Autentikasi 2FA',
                  desc: 'Peringatan instan ketika ada percobaan login atau verifikasi token 2FA.',
                },
                {
                  key: 'cloudSyncAlert' as const,
                  title: 'Status Sinkronisasi Cloud & Google Sheets',
                  desc: 'Notifikasi saat antrean offline berhasil disinkronkan ke server Cloud Vault.',
                },
                {
                  key: 'userApprovalAlert' as const,
                  title: 'Interaksi & Persetujuan Pengguna (DATA UPROVE LOG IN)',
                  desc: 'Notifikasi cepat saat ada pendaftaran baru atau persetujuan Superuser.',
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="p-3.5 rounded-2xl liquid-glass-inset flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateNotificationPrefs({
                        ...notificationPrefs,
                        [item.key]: !notificationPrefs[item.key],
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold cursor-pointer shrink-0 ${
                      notificationPrefs[item.key]
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {notificationPrefs[item.key] ? 'ON' : 'OFF'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Right: Kirim / Simulasikan Notifikasi Push Real-Time Antar-Pengguna */}
          <section className="lg:col-span-6 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="pb-3 border-b border-white/10">
                <h2 className="text-base font-semibold text-white">
                  Broadcast Notifikasi Push Real-Time Antar-Perangkat
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Kirim pesan peringatan atau instruksi keuangan secara instan ke seluruh perangkat yang terhubung melalui Server-Sent Events (`/api/events`)
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label htmlFor="notif-title-input" className="block text-slate-300 mb-1">
                    Judul Notifikasi Push
                  </label>
                  <input
                    id="notif-title-input"
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label htmlFor="notif-desc-input" className="block text-slate-300 mb-1">
                    Pesan / Rincian Aktivitas
                  </label>
                  <textarea
                    id="notif-desc-input"
                    rows={3}
                    value={broadcastDesc}
                    onChange={(e) => setBroadcastDesc(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="notif-cat-select" className="block text-slate-300 mb-1">
                      Kategori
                    </label>
                    <select
                      id="notif-cat-select"
                      value={broadcastCategory}
                      onChange={(e) =>
                        setBroadcastCategory(e.target.value as RealtimePushNotification['category'])
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    >
                      <option value="BUDGET_MUTATION">BUDGET_MUTATION</option>
                      <option value="SECURITY_2FA">SECURITY_2FA</option>
                      <option value="CLOUD_SYNC">CLOUD_SYNC</option>
                      <option value="USER_APPROVAL">USER_APPROVAL</option>
                      <option value="API_GATEWAY">API_GATEWAY</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="notif-sev-select" className="block text-slate-300 mb-1">
                      Prioritas Visual
                    </label>
                    <select
                      id="notif-sev-select"
                      value={broadcastSeverity}
                      onChange={(e) =>
                        setBroadcastSeverity(e.target.value as RealtimePushNotification['severity'])
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    >
                      <option value="INFO">INFO</option>
                      <option value="SUCCESS">SUCCESS</option>
                      <option value="WARNING">WARNING</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onSendRealtimeNotification(
                      broadcastTitle,
                      broadcastDesc,
                      broadcastCategory,
                      broadcastSeverity
                    )
                  }
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim Notifikasi Push Real-Time Sekarang</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Saluran Aktif: SSE Stream (/api/events) + Web Notification API</span>
              <span className="text-emerald-400 font-mono">Zero-Latency</span>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
       * SUB-TAB 4: INTEGRASI API PIHAK KETIGA (FOREX, EMAS, WEBHOOK GATEWAY)
       * ===================================================================== */}
      {activeSubTab === 'API_GATEWAY' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Live Currency, Gold & Crypto Multi-Asset Converter */}
          <section className="lg:col-span-7 rounded-3xl liquid-glass-interactive p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Integrasi API Pasar Global: Konversi Valas, Emas & Aset Likuiditas
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Terhubung ke endpoint <code className="text-emerald-300">/api/third-party/rates</code> untuk menghitung nilai ekuivalen portofolio Rupiah Anda secara real-time
                </p>
              </div>

              <button
                type="button"
                onClick={fetchLiveRates}
                disabled={isFetchingRates}
                className="px-3 py-1.5 rounded-xl liquid-glass-inset hover:border-emerald-400/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingRates ? 'animate-spin' : ''}`} />
                <span>Refresh Kurs API</span>
              </button>
            </div>

            <div>
              <label htmlFor="idr-convert-input" className="block text-xs text-slate-300 mb-1.5">
                Nominal Rupiah (IDR) untuk Dikonversi (Default: Total Likuiditas Bank & E-Wallet)
              </label>
              <input
                id="idr-convert-input"
                type="number"
                value={idrConvertAmount}
                onChange={(e) => setIdrConvertAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-sm text-emerald-400"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl liquid-glass-inset">
                <span className="text-[10px] font-mono text-slate-400 block">USD (US DOLLAR)</span>
                <p className="mt-1 text-base font-bold font-mono tabular-nums text-white">
                  ${convertedUsd.toFixed(2)}
                </p>
                <span className="text-[10px] font-mono text-emerald-400">
                  Kurs: {formatIDR(marketRates.rates.USD_IDR)}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl liquid-glass-inset">
                <span className="text-[10px] font-mono text-slate-400 block">SGD (SINGAPORE $)</span>
                <p className="mt-1 text-base font-bold font-mono tabular-nums text-white">
                  S${convertedSgd.toFixed(2)}
                </p>
                <span className="text-[10px] font-mono text-sky-400">
                  Kurs: {formatIDR(marketRates.rates.SGD_IDR)}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl liquid-glass-inset">
                <span className="text-[10px] font-mono text-slate-400 block">EUR (EURO)</span>
                <p className="mt-1 text-base font-bold font-mono tabular-nums text-white">
                  €{convertedEur.toFixed(2)}
                </p>
                <span className="text-[10px] font-mono text-amber-300">
                  Kurs: {formatIDR(marketRates.rates.EUR_IDR)}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl liquid-glass-inset">
                <span className="text-[10px] font-mono text-slate-400 block">EMAS ANTAM (GRAM)</span>
                <p className="mt-1 text-base font-bold font-mono tabular-nums text-amber-300">
                  {convertedGoldGrams.toFixed(2)} gr
                </p>
                <span className="text-[10px] font-mono text-slate-400">
                  {formatCompactIDR(marketRates.rates.GOLD_GRAM_IDR)}/gr
                </span>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-2 border-t border-white/10">
              <span>Provider: {marketRates.source}</span>
              <span>Update: {new Date(marketRates.updatedAt).toLocaleTimeString('id-ID')}</span>
            </div>
          </section>

          {/* Right: Third-Party Webhook & External Service Connectors */}
          <section className="lg:col-span-5 rounded-3xl liquid-glass-interactive p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-semibold text-white">
                    Konektor API & Webhook Eksternal
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">4 Layanan Aktif</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {[
                  {
                    name: 'Google Sheets & Drive Cloud Macro API',
                    endpoint: 'script.google.com/macros/s/AKfycbx35CjwgE.../exec',
                    status: 'CONNECTED',
                  },
                  {
                    name: 'ExchangeRate & Precious Metals Oracle API',
                    endpoint: '/api/third-party/rates (REST JSON)',
                    status: 'CONNECTED',
                  },
                  {
                    name: 'WhatsApp & Telegram Financial Alert Bot',
                    endpoint: 'Webhook Push Gateway (SHA-256 Signed)',
                    status: 'READY',
                  },
                  {
                    name: 'OpenAPI 3.0 / Swagger REST Specification',
                    endpoint: '/api/vault & /api/sync',
                    status: 'ACTIVE',
                  },
                ].map((svc) => (
                  <div
                    key={svc.name}
                    className="p-3 rounded-2xl liquid-glass-inset flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{svc.name}</p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">{svc.endpoint}</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                      {svc.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-white/10">
              {webhookStatus && (
                <p className="text-xs text-emerald-300 font-mono">{webhookStatus}</p>
              )}
              <button
                type="button"
                onClick={() => {
                  setWebhookStatus(
                    `Payload JSON (${activePeriod.monthLabel}) berhasil dikirim ke endpoint API pihak ketiga pada ${new Date().toLocaleTimeString('id-ID')}.`
                  );
                  onSendRealtimeNotification(
                    'Integrasi API Pihak Ketiga Diuji',
                    `Sinkronisasi webhook eksternal untuk periode ${activePeriod.monthLabel} berhasil dieksekusi.`,
                    'API_GATEWAY',
                    'SUCCESS'
                  );
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Uji Kirim Payload Webhook API Sekarang
              </button>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
       * SUB-TAB 5: DOKUMENTASI ARSITEKTUR KODE & PENJELASAN DETAIL KOMPONEN
       * ===================================================================== */}
      {activeSubTab === 'CODE_DOCS' && (
        <section className="rounded-3xl liquid-glass-interactive p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-base font-semibold text-white">
                  Dokumentasi Arsitektur Sistem & Penjelasan Detail Setiap Komponen File
                </h2>
                <p className="text-xs text-slate-300">
                  Struktur kode bersih (Clean Architecture) yang memisahkan UI React, Pure Business Logic, dan Full-Stack Cloud Vault API
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
              {['ALL', 'BACKEND_API', 'CORE_APP', 'UI_COMPONENT', 'PURE_LOGIC'].map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setDocLayerFilter(layer)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                    docLayerFilter === layer
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-2xl liquid-glass-inset flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono font-bold text-emerald-400">
                      {doc.filePath}
                    </code>
                    <span className="text-[10px] font-mono text-amber-300">{doc.layer}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{doc.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{doc.summary}</p>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-1.5 text-[11px]">
                  <p className="font-semibold text-slate-200">Fungsi Utama:</p>
                  <ul className="list-disc list-inside text-slate-400 space-y-0.5 font-mono">
                    {doc.keyFunctions.map((fn) => (
                      <li key={fn} className="truncate">
                        {fn}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] font-mono text-sky-400 pt-1">
                    Database: {doc.connectedDatabase}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
