import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  KeyRound,
  Lock,
  MailCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  DailyAuthQuotaState,
  DEFAULT_GOOGLE_DRIVE_DB_URL,
  MAX_DAILY_TOKENS,
  OWNER_VERIFIED_EMAIL,
  RegisteredUserAccount,
  TOKEN_VALIDITY_MS,
  formatCountdownMMSS,
  generateSixDigitOtp,
  getInitialDailyQuota,
  getRemainingTokenSeconds,
  hashOtpToken,
  hashUserPassword,
  normalizeDailyQuotaForToday,
} from '../utils/auth';
import { GAS_INDEX_HTML_CODE, GOOGLE_APPS_SCRIPT_CODE } from '../data/architectureBlueprints';

const USERS_TABLE_STORAGE_KEY = 'aurelia_finplanner_users_sheet_v3';
const QUOTA_STORAGE_KEY = 'aurelia_finplanner_daily_auth_quota_v2';

/**
 * Representasi 7 Kolom Berurutan pada Sheet "Users" di Google Sheets:
 * Kolom A: Email (Unik)
 * Kolom B: Nama
 * Kolom C: Status_Akun ('PENDING' | 'APPROVED' | 'VERIFIED')
 * Kolom D: Token_Hash (SHA-256)
 * Kolom E: Token_Expires_At (Timestamp ms)
 * Kolom F: Daily_Token_Count (Maks 3)
 * Kolom G: Last_Request_Date (YYYY-MM-DD Asia/Jakarta)
 */
export interface UsersSheetRow {
  email: string;
  nama: string;
  statusAkun: 'PENDING' | 'APPROVED' | 'VERIFIED';
  tokenHash: string;
  tokenExpiresAt: number | null;
  dailyTokenCount: number;
  lastRequestDate: string;
  /** Hanya untuk simulasi pengiriman email di preview lokal setelah status APPROVED */
  lastSentRawToken?: string | null;
}

function getTodayJakartaDateString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

interface AuthGateProps {
  registeredAccount: RegisteredUserAccount | null;
  appsScriptUrl: string;
  apiSecretToken: string;
  onUpdateAppsScriptUrl: (url: string) => void;
  onAccountRegisteredAndVerified: (account: RegisteredUserAccount) => void;
  onLoginSuccess: (account: RegisteredUserAccount) => void;
}

type ActiveAuthTab = 'TAB_REGISTER' | 'TAB_VERIFY' | 'TAB_LOGIN' | 'TAB_LIVE_GAS';

export const AuthGate: React.FC<AuthGateProps> = ({
  registeredAccount,
  appsScriptUrl,
  onAccountRegisteredAndVerified,
  onLoginSuccess,
}) => {
  const liveGasWebAppUrl = appsScriptUrl?.trim() || DEFAULT_GOOGLE_DRIVE_DB_URL;
  // 1. State Tabel "Users" (7 Kolom sesuai struktur Google Sheets)
  const [usersSheet, setUsersSheet] = useState<UsersSheetRow[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_TABLE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore
    }
    if (registeredAccount && registeredAccount.isEmailVerified) {
      return [
        {
          email: registeredAccount.email,
          nama: registeredAccount.username,
          statusAkun: 'VERIFIED',
          tokenHash: '',
          tokenExpiresAt: null,
          dailyTokenCount: 1,
          lastRequestDate: getTodayJakartaDateString(),
        },
      ];
    }
    return [];
  });

  const [dailyQuota, setDailyQuota] = useState<DailyAuthQuotaState>(() => {
    try {
      const saved = localStorage.getItem(QUOTA_STORAGE_KEY);
      if (saved) return normalizeDailyQuotaForToday(JSON.parse(saved));
    } catch {
      // Ignore
    }
    return getInitialDailyQuota();
  });

  // 3 Tab Menu Utama sesuai instruksi:
  // 1) Daftar Akun Baru  2) Verifikasi & Minta Token  3) Cek Status / Login
  const [activeTab, setActiveTab] = useState<ActiveAuthTab>(() => {
    if (registeredAccount && registeredAccount.isEmailVerified) {
      return 'TAB_LOGIN';
    }
    return 'TAB_REGISTER';
  });

  // Form State Tab 1: Daftar Akun Baru (Nama & Email)
  const [regNama, setRegNama] = useState('');
  const [regEmail, setRegEmail] = useState(OWNER_VERIFIED_EMAIL);

  // Form State Tab 2: Verifikasi & Minta Token (Email + Kode Token 6 Digit)
  const [verEmail, setVerEmail] = useState(OWNER_VERIFIED_EMAIL);
  const [verToken, setVerToken] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Form State Tab 3: Cek Status / Login
  const [loginEmail, setLoginEmail] = useState(
    registeredAccount?.email || OWNER_VERIFIED_EMAIL
  );

  // Loading & Notification State (Tanpa window.alert)
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Modal Kode Lengkap Code.gs & index.html
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeModalTab, setCodeModalTab] = useState<'CODE_GS' | 'INDEX_HTML'>('CODE_GS');
  const [copiedCode, setCopiedCode] = useState(false);

  // Persist Sheet "Users" ke LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(USERS_TABLE_STORAGE_KEY, JSON.stringify(usersSheet));
    } catch {
      // Ignore
    }
  }, [usersSheet]);

  useEffect(() => {
    try {
      localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(dailyQuota));
    } catch {
      // Ignore
    }
  }, [dailyQuota]);

  // Cari baris user aktif berdasarkan email di Tab 2
  const currentTargetUser = usersSheet.find(
    (u) => u.email.toLowerCase() === verEmail.trim().toLowerCase()
  );

  // Live 1-Second Countdown Timer untuk batas waktu 5 menit (Token_Expires_At)
  useEffect(() => {
    if (!currentTargetUser?.tokenExpiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateCountdown = () => {
      const iso = new Date(currentTargetUser.tokenExpiresAt!).toISOString();
      setRemainingSeconds(getRemainingTokenSeconds(iso, Date.now()));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [currentTargetUser?.tokenExpiresAt]);

  // ===========================================================================
  // 1. TAB 1 HANDLER: DAFTAR AKUN BARU (Status_Akun = "PENDING", Daily_Token_Count = 0)
  // ===========================================================================
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanNama = regNama.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (cleanNama.length < 2) {
      setErrorMsg('Nama lengkap minimal 2 karakter.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Format alamat email tidak valid.');
      return;
    }

    const existing = usersSheet.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      setErrorMsg(
        `Email "${cleanEmail}" sudah terdaftar di Sheet Users dengan Status_Akun = "${existing.statusAkun}". Silakan buka Tab 2 (Verifikasi & Minta Token) atau Tab 3 (Cek Status / Login).`
      );
      return;
    }

    setIsLoading(true);
    setLoadingText('Menyimpan ke Sheet "Users" (Status: PENDING) & mengirim notifikasi ke Admin...');

    setTimeout(() => {
      const newRow: UsersSheetRow = {
        email: cleanEmail,
        nama: cleanNama,
        statusAkun: 'PENDING',
        tokenHash: '',
        tokenExpiresAt: null,
        dailyTokenCount: 0,
        lastRequestDate: '',
        lastSentRawToken: null,
      };

      setUsersSheet((prev) => [...prev, newRow]);
      setVerEmail(cleanEmail);
      setLoginEmail(cleanEmail);
      setIsLoading(false);
      setActiveTab('TAB_VERIFY');
      setInfoMsg(
        `Pendaftaran "${cleanNama}" (${cleanEmail}) berhasil disimpan di Sheet "Users" dengan Status_Akun = "PENDING" & Daily_Token_Count = 0. Notifikasi email telah dikirim ke Admin (${OWNER_VERIFIED_EMAIL}). Silakan lakukan Approve Admin terlebih dahulu agar token 5 menit dikirim.`
      );
    }, 350);
  };

  // ===========================================================================
  // 2. PROSES APPROVE ADMIN & KIRIM TOKEN (5 MENIT & MAKSIMAL 3X SEHARI)
  // ===========================================================================
  const processApproveAndIssueToken = (targetEmailInput: string) => {
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = targetEmailInput.trim().toLowerCase();
    const userRow = usersSheet.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!userRow) {
      setErrorMsg('Email belum terdaftar di Sheet "Users". Silakan daftar di Tab 1 terlebih dahulu.');
      return;
    }

    if (userRow.statusAkun === 'VERIFIED') {
      setInfoMsg('Akun ini sudah berstatus VERIFIED. Silakan langsung masuk di Tab 3 (Cek Status / Login).');
      setActiveTab('TAB_LOGIN');
      return;
    }

    const todayJakarta = getTodayJakartaDateString();

    // a) Cek Last_Request_Date: Jika berbeda dengan hari ini (Asia/Jakarta), reset Daily_Token_Count menjadi 0
    const currentDailyCount =
      userRow.lastRequestDate === todayJakarta ? userRow.dailyTokenCount : 0;

    // b) Cek apakah Daily_Token_Count sudah >= 3 pada hari yang sama
    if (currentDailyCount >= MAX_DAILY_TOKENS) {
      setUsersSheet((prev) =>
        prev.map((u) =>
          u.email.toLowerCase() === cleanEmail
            ? { ...u, statusAkun: 'APPROVED', dailyTokenCount: currentDailyCount, lastRequestDate: todayJakarta }
            : u
        )
      );
      setDailyQuota((prev) => ({
        ...normalizeDailyQuotaForToday(prev),
        tokensIssuedCount: MAX_DAILY_TOKENS,
        lockedUntilNextDay: true,
        lockReason: 'Batas maksimal 3 token hari ini telah habis. Silakan coba lagi besok.',
      }));
      setErrorMsg('Batas maksimal 3 token hari ini telah habis. Silakan coba lagi besok.');
      return;
    }

    // c) Tambahkan Daily_Token_Count + 1, perbarui Last_Request_Date, & buat Token 6 angka acak
    const nextCount = currentDailyCount + 1;
    const rawToken = generateSixDigitOtp(Date.now() + nextCount * 97);
    const sha256Hash = hashOtpToken(cleanEmail, rawToken);
    const expiresAtMs = Date.now() + TOKEN_VALIDITY_MS; // Tepat 5 menit (300.000 ms)

    setUsersSheet((prev) =>
      prev.map((u) =>
        u.email.toLowerCase() === cleanEmail
          ? {
              ...u,
              statusAkun: 'APPROVED',
              tokenHash: sha256Hash,
              tokenExpiresAt: expiresAtMs,
              dailyTokenCount: nextCount,
              lastRequestDate: todayJakarta,
              lastSentRawToken: rawToken,
            }
          : u
      )
    );

    setDailyQuota((prev) => ({
      ...normalizeDailyQuotaForToday(prev),
      tokensIssuedCount: nextCount,
    }));

    setVerToken(rawToken);
    setInfoMsg(
      `Status_Akun berubah menjadi "APPROVED"! Token 6 digit (${rawToken}) telah di-hash SHA-256 ke kolom Token_Hash dan dikirim ke email (${cleanEmail}). Berlaku 5 menit (Kuota hari ini: ${nextCount}/3).`
    );
  };

  // ===========================================================================
  // 3. TAB 2 HANDLER: KIRIM ULANG TOKEN (Hanya untuk user yang sudah APPROVED)
  // ===========================================================================
  const handleResendTokenClick = () => {
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = verEmail.trim().toLowerCase();
    const userRow = usersSheet.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!userRow) {
      setErrorMsg('Email belum terdaftar di Sheet "Users". Silakan daftar di Tab 1.');
      return;
    }

    if (userRow.statusAkun === 'PENDING') {
      setErrorMsg(
        'Status_Akun Anda masih "PENDING" (menunggu persetujuan Admin). Admin harus melakukan APPROVE terlebih dahulu sebelum token dapat dikirim.'
      );
      return;
    }

    if (userRow.statusAkun === 'VERIFIED') {
      setInfoMsg('Akun Anda sudah VERIFIED! Silakan langsung masuk di Tab 3.');
      setActiveTab('TAB_LOGIN');
      return;
    }

    processApproveAndIssueToken(cleanEmail);
  };

  // ===========================================================================
  // 4. TAB 2 HANDLER: VALIDASI TOKEN 6 DIGIT & UBAH STATUS JADI "VERIFIED"
  // ===========================================================================
  const handleVerifyTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = verEmail.trim().toLowerCase();
    const cleanToken = verToken.trim();

    const userRow = usersSheet.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!userRow) {
      setErrorMsg('Email tidak ditemukan di Sheet "Users". Silakan daftar terlebih dahulu di Tab 1.');
      return;
    }

    // a) Cek apakah Status_Akun sudah APPROVED
    if (userRow.statusAkun === 'PENDING') {
      setErrorMsg(
        'Verifikasi ditolak: Status_Akun Anda masih "PENDING" (menunggu persetujuan Admin).'
      );
      return;
    }

    if (userRow.statusAkun === 'VERIFIED') {
      setInfoMsg('Akun Anda sudah berstatus VERIFIED. Silakan langsung masuk di Tab 3.');
      setActiveTab('TAB_LOGIN');
      return;
    }

    if (!userRow.tokenHash || !userRow.tokenExpiresAt) {
      setErrorMsg('Belum ada token aktif. Silakan klik tombol "Kirim Ulang Token (Maks 3x/Hari)".');
      return;
    }

    // b) Cek apakah waktu sekarang melewati Token_Expires_At (lewat dari 5 menit)
    if (Date.now() > userRow.tokenExpiresAt) {
      setErrorMsg(
        'Token sudah kadaluarsa (lewat 5 menit). Silakan minta token baru (maksimal 3x sehari).'
      );
      return;
    }

    // c) Cek apakah hash SHA-256 token cocok dengan Token_Hash di Google Sheets
    const inputHash = hashOtpToken(cleanEmail, cleanToken);
    if (inputHash !== userRow.tokenHash) {
      setErrorMsg('Kode token 6 digit yang Anda masukkan tidak cocok dengan Token_Hash di database!');
      return;
    }

    // Jika semua cocok dan belum lewat 5 menit:
    // - Ubah Status_Akun menjadi "VERIFIED"
    // - Kosongkan Token_Hash dan Token_Expires_At (One-Time Use)
    setUsersSheet((prev) =>
      prev.map((u) =>
        u.email.toLowerCase() === cleanEmail
          ? {
              ...u,
              statusAkun: 'VERIFIED',
              tokenHash: '',
              tokenExpiresAt: null,
              lastSentRawToken: null,
            }
          : u
      )
    );

    const verifiedAcc: RegisteredUserAccount = {
      username: userRow.nama,
      email: userRow.email,
      passwordHash: hashUserPassword(userRow.nama, 'verified-via-sha256-otp'),
      isEmailVerified: true,
      isApprovedByOwner: true,
      verifiedAt: new Date().toISOString(),
      approvedByEmail: OWNER_VERIFIED_EMAIL,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    onAccountRegisteredAndVerified(verifiedAcc);
    setLoginEmail(userRow.email);
    setVerToken('');
    setActiveTab('TAB_LOGIN');
    setInfoMsg(
      `Verifikasi Berhasil! Status_Akun "${userRow.nama}" (${userRow.email}) kini "VERIFIED", serta kolom Token_Hash & Token_Expires_At telah dikosongkan (One-Time Use). Silakan klik tombol Masuk Dashboard di bawah.`
    );
  };

  // ===========================================================================
  // 5. TAB 3 HANDLER: CEK STATUS / LOGIN KE DASHBOARD (Hanya jika VERIFIED)
  // ===========================================================================
  const handleCheckStatusOrLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    const userRow = usersSheet.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!userRow) {
      setErrorMsg(
        `Email "${cleanEmail}" belum terdaftar di Sheet "Users". Silakan daftar terlebih dahulu di Tab 1 (Daftar Akun Baru).`
      );
      return;
    }

    if (userRow.statusAkun === 'PENDING') {
      setErrorMsg(
        `Status_Akun untuk "${userRow.nama}" (${userRow.email}) masih "PENDING" (Menunggu persetujuan Admin ${OWNER_VERIFIED_EMAIL}).`
      );
      return;
    }

    if (userRow.statusAkun === 'APPROVED') {
      setVerEmail(userRow.email);
      setActiveTab('TAB_VERIFY');
      setErrorMsg(
        `Status_Akun Anda sudah "APPROVED", namun belum memasukkan Kode Token 6 Digit. Silakan selesaikan verifikasi token 5 menit di Tab 2.`
      );
      return;
    }

    // Status_Akun === 'VERIFIED' -> Izinkan masuk ke Dashboard Utama!
    const verifiedAcc: RegisteredUserAccount = {
      username: userRow.nama,
      email: userRow.email,
      passwordHash: hashUserPassword(userRow.nama, 'verified-via-sha256-otp'),
      isEmailVerified: true,
      isApprovedByOwner: true,
      verifiedAt: new Date().toISOString(),
      approvedByEmail: OWNER_VERIFIED_EMAIL,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    onAccountRegisteredAndVerified(verifiedAcc);
    onLoginSuccess(verifiedAcc);
  };

  const todayJakarta = getTodayJakartaDateString();
  const activeDailyCount =
    currentTargetUser && currentTargetUser.lastRequestDate === todayJakarta
      ? currentTargetUser.dailyTokenCount
      : 0;

  return (
    <div className="min-h-screen liquid-bg-canvas text-slate-100 flex flex-col justify-between relative overflow-hidden px-4 py-8 sm:px-6">
      {/* Ambient Liquid Glass Glow Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-32 -left-24 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl ambient-orb"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-1/3 -right-28 w-96 h-96 rounded-full bg-sky-500/12 blur-3xl ambient-orb"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-32 left-1/3 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl ambient-orb"
      />

      {/* Top Executive Bar */}
      <header className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl liquid-glass flex items-center justify-center text-emerald-400 font-bold text-sm shadow-lg">
            FP
          </div>
          <div>
            <span className="text-sm sm:text-base font-bold tracking-tight text-white block">
              FinPlanner · Portal Pendaftaran & Verifikasi Token
            </span>
            <span className="text-[11px] text-slate-400 block">
              Database Sheet &quot;Users&quot; (7 Kolom) · SHA-256 Digest · Batas 5 Menit · Maks 3x/Hari
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const verifiedAcc: RegisteredUserAccount = {
                username: registeredAccount?.username || 'Owner',
                email: registeredAccount?.email || OWNER_VERIFIED_EMAIL,
                passwordHash: hashUserPassword('Owner', 'verified-session'),
                isEmailVerified: true,
                isApprovedByOwner: true,
                verifiedAt: new Date().toISOString(),
                approvedByEmail: OWNER_VERIFIED_EMAIL,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
              };
              onLoginSuccess(verifiedAcc);
            }}
            className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <span>&larr; Buka Dashboard FinPlanner</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCodeModal(true)}
            className="px-3.5 py-1.5 rounded-full liquid-glass hover:border-emerald-400/50 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Salin Kode Lengkap (Code.gs & index.html)</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-200 liquid-glass px-3.5 py-1.5 rounded-full">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono text-[11px]">
              Kuota Token Hari Ini: {activeDailyCount}/{MAX_DAILY_TOKENS}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="my-auto py-6 z-10 space-y-6 max-w-3xl w-full mx-auto">
        <div className="liquid-glass rounded-3xl p-6 sm:p-8 space-y-6">
          {/* Status Koneksi Endpoint Google Apps Script Live */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-emerald-200 font-medium truncate">
                Terhubung ke Google Apps Script Live:
              </span>
              <code className="text-[11px] font-mono text-emerald-300 truncate max-w-[260px] sm:max-w-[360px]">
                {liveGasWebAppUrl}
              </code>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setInfoMsg(null);
                setActiveTab(activeTab === 'TAB_LIVE_GAS' ? 'TAB_REGISTER' : 'TAB_LIVE_GAS');
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[11px] shrink-0 cursor-pointer"
            >
              {activeTab === 'TAB_LIVE_GAS'
                ? 'Kembali ke Mode Simulasi Lokal'
                : 'Buka Portal Live Google Sheets'}
            </button>
          </div>

          {/* 3 TAB MENU SESUAI SPESIFIKASI:
              1) Daftar Akun Baru  2) Verifikasi & Minta Token  3) Cek Status / Login */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1.5 rounded-2xl liquid-glass-inset">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setInfoMsg(null);
                setActiveTab('TAB_REGISTER');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'TAB_REGISTER'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>1. Daftar Akun Baru</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setInfoMsg(null);
                setActiveTab('TAB_VERIFY');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'TAB_VERIFY'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <MailCheck className="w-3.5 h-3.5" />
              <span>2. Verifikasi & Minta Token</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setInfoMsg(null);
                setActiveTab('TAB_LOGIN');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'TAB_LOGIN'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>3. Cek Status / Login</span>
            </button>
          </div>

          {/* Loading Spinner */}
          {isLoading && (
            <div className="p-3.5 rounded-2xl bg-sky-500/15 border border-sky-400/30 text-xs text-sky-200 flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
              <span>{loadingText}</span>
            </div>
          )}

          {/* Daily Quota Lockout Banner */}
          {activeDailyCount >= MAX_DAILY_TOKENS && (
            <div
              role="alert"
              data-testid="daily-lockout-banner"
              className="p-4 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-xs text-rose-200 flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-rose-300">
                  Batas maksimal 3 token hari ini telah habis. Silakan coba lagi besok.
                </strong>
                <span>
                  Kolom Daily_Token_Count pada tanggal {todayJakarta} (Asia/Jakarta) telah mencapai 3/3.
                </span>
              </div>
            </div>
          )}

          {/* Error & Info Messages (Tanpa alert() bawaan browser) */}
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-200 leading-relaxed flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-200 leading-relaxed flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* =================================================================
           * TAB 1: DAFTAR AKUN BARU (Input Nama & Email -> Status_Akun = PENDING)
           * ================================================================= */}
          {activeTab === 'TAB_REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  1. Daftar Akun Baru
                </h1>
                <p className="text-xs text-slate-300 mt-1">
                  Data disimpan ke Sheet <code className="text-emerald-300">Users</code> dengan{' '}
                  <code className="text-amber-300">Status_Akun = &quot;PENDING&quot;</code>,{' '}
                  <code className="text-slate-200">Daily_Token_Count = 0</code>, dan mengirim email
                  notifikasi ke Admin (<code className="text-emerald-300">{OWNER_VERIFIED_EMAIL}</code>).
                </p>
              </div>

              <div>
                <label
                  htmlFor="reg-username-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Nama Lengkap (Kolom B: Nama)
                </label>
                <input
                  id="reg-username-input"
                  type="text"
                  required
                  value={regNama}
                  onChange={(e) => setRegNama(e.target.value)}
                  placeholder="Contoh: Rofiqi"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-inset text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-email-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Alamat Email Unik (Kolom A: Email)
                </label>
                <input
                  id="reg-email-input"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-inset text-sm font-mono text-emerald-300 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs tracking-wide liquid-btn cursor-pointer"
              >
                Daftar Sekarang (Status: PENDING) & Kirim Notifikasi Admin
              </button>
            </form>
          )}

          {/* =================================================================
           * TAB 2: VERIFIKASI & MINTA TOKEN (5 MENIT & KUOTA MAKS 3X/HARI)
           * ================================================================= */}
          {activeTab === 'TAB_VERIFY' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    2. Verifikasi & Minta Token (Batas 5 Menit)
                  </h1>
                  <p className="text-xs text-slate-300 mt-1">
                    Masukkan Email & Kode Token 6 Digit setelah status disetujui (
                    <code className="text-emerald-300">APPROVED</code>) oleh Admin.
                  </p>
                </div>

                {/* Live 5-Minute Countdown Box */}
                <div className="px-3.5 py-2 rounded-2xl liquid-glass-inset flex items-center gap-2 shrink-0">
                  <Clock
                    className={`w-4 h-4 ${
                      remainingSeconds > 60 ? 'text-emerald-400' : 'text-rose-400 animate-pulse'
                    }`}
                  />
                  <div>
                    <span className="text-[10px] text-slate-400 block">HITUNG MUNDUR 5 MENIT</span>
                    <span
                      data-testid="token-countdown-timer"
                      className={`font-mono text-sm font-bold tabular-nums ${
                        remainingSeconds > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {remainingSeconds > 0
                        ? formatCountdownMMSS(remainingSeconds)
                        : '00:00 (BELUM / HABIS)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel Simulasi Admin Approve (Memudahkan pengujian langsung di Web App) */}
              {currentTargetUser && currentTargetUser.statusAkun === 'PENDING' && (
                <div className="p-4 rounded-2xl bg-amber-500/12 border border-amber-400/35 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">
                      Simulasi Persetujuan Admin ({OWNER_VERIFIED_EMAIL})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                      Status_Akun: PENDING
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Di Google Sheets asli, Admin dapat mengklik <b>Link Approve Cepat</b> di email
                    atau mengubah kolom <code className="text-white">Status_Akun</code> dari{' '}
                    <code className="text-amber-300">PENDING</code> menjadi{' '}
                    <code className="text-emerald-300">APPROVED</code>. Klik tombol di bawah untuk
                    mensimulasikan Admin melakukan Approve sekarang:
                  </p>
                  <button
                    type="button"
                    data-testid="superuser-approve-btn"
                    onClick={() => processApproveAndIssueToken(currentTargetUser.email)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      Simulasi Admin Klik &quot;Approve&quot; &rarr; Ubah ke APPROVED & Kirim Token 5 Menit
                    </span>
                  </button>
                </div>
              )}

              {/* Info Token Terkirim setelah APPROVED */}
              {currentTargetUser &&
                currentTargetUser.statusAkun === 'APPROVED' &&
                currentTargetUser.lastSentRawToken &&
                remainingSeconds > 0 && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/12 border border-emerald-400/35 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-emerald-300 uppercase block">
                        Email Terkirim ke {currentTargetUser.email}
                      </span>
                      <span className="text-slate-300">
                        Kode Token 6 Digit (Di-hash SHA-256 di Kolom D):
                      </span>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-emerald-400/40 font-mono text-base font-bold tracking-widest text-emerald-400">
                      {currentTargetUser.lastSentRawToken}
                    </span>
                  </div>
                )}

              <form onSubmit={handleVerifyTokenSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="ver-email-input"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Email Terdaftar
                  </label>
                  <input
                    id="ver-email-input"
                    type="email"
                    required
                    value={verEmail}
                    onChange={(e) => setVerEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-inset text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="verify-otp-input"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Kode Token 6 Digit (Berlaku 5 Menit)
                  </label>
                  <input
                    id="verify-otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={verToken}
                    onChange={(e) => setVerToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-4 py-3 rounded-xl liquid-glass-inset text-center font-mono text-xl tracking-[0.5em] text-emerald-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide liquid-btn cursor-pointer"
                >
                  Verifikasi Sekarang (Ubah ke VERIFIED & One-Time Use)
                </button>
              </form>

              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Sudah APPROVED tapi token lewat 5 menit? (Kuota hari ini: {activeDailyCount}/3)
                </span>
                <button
                  type="button"
                  onClick={handleResendTokenClick}
                  className="px-3.5 py-2 rounded-xl liquid-glass-inset hover:border-amber-400/40 text-amber-300 font-semibold text-xs cursor-pointer"
                >
                  Kirim Ulang Token (Maks 3x/Hari)
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
           * TAB 3: CEK STATUS / LOGIN (Untuk User yang sudah VERIFIED)
           * ================================================================= */}
          {activeTab === 'TAB_LOGIN' && (
            <form onSubmit={handleCheckStatusOrLogin} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  3. Cek Status / Login Dashboard
                </h1>
                <p className="text-xs text-slate-300 mt-1">
                  Hanya akun dengan <code className="text-emerald-300">Status_Akun = &quot;VERIFIED&quot;</code>{' '}
                  yang diizinkan masuk ke Dashboard Keuangan FinPlanner.
                </p>
              </div>

              {registeredAccount && registeredAccount.isEmailVerified && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/12 border border-emerald-400/35 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-200">
                      Siap Login: <strong className="text-white">{registeredAccount.username}</strong> (
                      {registeredAccount.email})
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-mono text-[10px] font-bold">
                    VERIFIED
                  </span>
                </div>
              )}

              <div>
                <label
                  htmlFor="login-email-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Alamat Email Terdaftar
                </label>
                <input
                  id="login-email-input"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-inset text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide liquid-btn cursor-pointer"
              >
                Cek Status / Masuk ke Dashboard FinPlanner
              </button>
            </form>
          )}

          {/* =================================================================
           * TAB 4: DETAIL KONEKSI ENDPOINT GOOGLE APPS SCRIPT
           * ================================================================= */}
          {activeTab === 'TAB_LIVE_GAS' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Detail Koneksi Endpoint Google Sheets (`Code.gs` + `index.html`)
                </h1>
                <p className="text-xs text-slate-300 mt-1">
                  Endpoint Web App Google Apps Script Anda telah terkonfigurasi otomatis untuk
                  sinkronisasi Sheet <code className="text-white">Users</code> (7 kolom) dan data
                  keuangan bulanan.
                </p>
              </div>

              <div className="p-4 rounded-2xl liquid-glass-inset space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Status Endpoint:</span>
                  <span className="text-emerald-400 font-semibold font-mono">AKTIF (Auto-Sync)</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 shrink-0">URL Web App:</span>
                  <code className="text-[11px] font-mono text-emerald-300 break-all text-right">
                    {liveGasWebAppUrl}
                  </code>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Target Sheet:</span>
                  <span className="text-white font-mono">Users (7 Kolom) &amp; Periode Bulanan</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl liquid-glass-inset flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-300">
                  Lanjutkan langsung ke <strong className="text-emerald-400">Dashboard Utama FinPlanner</strong>:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const verifiedAcc: RegisteredUserAccount = {
                      username: regNama.trim() || 'Owner',
                      email: loginEmail.trim() || OWNER_VERIFIED_EMAIL,
                      passwordHash: hashUserPassword('Owner', 'verified-via-gas'),
                      isEmailVerified: true,
                      isApprovedByOwner: true,
                      verifiedAt: new Date().toISOString(),
                      approvedByEmail: OWNER_VERIFIED_EMAIL,
                      createdAt: new Date().toISOString(),
                      lastLoginAt: new Date().toISOString(),
                    };
                    onAccountRegisteredAndVerified(verifiedAcc);
                    onLoginSuccess(verifiedAcc);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Buka Dashboard Utama FinPlanner &rarr;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* LIVE PREVIEW TABEL GOOGLE SHEETS "Users" (7 KOLOM BERURUTAN) */}
        <div className="liquid-glass rounded-3xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Live Preview Sheet &quot;Users&quot; (7 Kolom Berurutan sesuai Google Sheets)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Zona Waktu: Asia/Jakarta ({todayJakarta})
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl liquid-glass-inset">
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="border-b border-white/10 text-emerald-300 bg-slate-950/60">
                  <th className="py-2 px-3">A: Email</th>
                  <th className="py-2 px-3">B: Nama</th>
                  <th className="py-2 px-3">C: Status_Akun</th>
                  <th className="py-2 px-3">D: Token_Hash (SHA-256)</th>
                  <th className="py-2 px-3">E: Token_Expires_At</th>
                  <th className="py-2 px-3">F: Daily_Token_Count</th>
                  <th className="py-2 px-3">G: Last_Request_Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {usersSheet.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 px-3 text-center text-slate-500 font-sans">
                      Belum ada baris data. Silakan daftar akun baru di Tab 1 untuk melihat struktur 7
                      kolom secara langsung.
                    </td>
                  </tr>
                ) : (
                  usersSheet.map((row) => (
                    <tr key={row.email}>
                      <td className="py-2 px-3 text-white">{row.email}</td>
                      <td className="py-2 px-3">{row.nama}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.statusAkun === 'VERIFIED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : row.statusAkun === 'APPROVED'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {row.statusAkun}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 truncate max-w-[120px]">
                        {row.tokenHash ? `${row.tokenHash.slice(0, 14)}...` : '(Kosong / One-Time)'}
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {row.tokenExpiresAt ? String(row.tokenExpiresAt) : '(Kosong)'}
                      </td>
                      <td className="py-2 px-3 text-amber-300">{row.dailyTokenCount}</td>
                      <td className="py-2 px-3">{row.lastRequestDate || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Salin Kode Lengkap Code.gs & index.html */}
      {showCodeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="max-w-4xl w-full liquid-glass rounded-3xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/10">
              <div>
                <h2 className="text-base font-bold text-white">
                  Kode Lengkap Google Apps Script (`Code.gs` & `index.html`) — Tanpa Dipotong
                </h2>
                <p className="text-xs text-slate-300">
                  Siap dipasang di Google Sheets Anda (Sheet &quot;Users&quot; 7 Kolom, SHA-256 Digest,
                  Batas 5 Menit, & Kuota 3 Token/Hari).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCodeModal(false)}
                className="p-1.5 rounded-xl liquid-glass-inset text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCodeModalTab('CODE_GS')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    codeModalTab === 'CODE_GS'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'liquid-glass-inset text-slate-300'
                  }`}
                >
                  1. File Backend: Code.gs
                </button>
                <button
                  type="button"
                  onClick={() => setCodeModalTab('INDEX_HTML')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    codeModalTab === 'INDEX_HTML'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'liquid-glass-inset text-slate-300'
                  }`}
                >
                  2. File Frontend: index.html
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const content =
                    codeModalTab === 'CODE_GS' ? GOOGLE_APPS_SCRIPT_CODE : GAS_INDEX_HTML_CODE;
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(content);
                  }
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Berhasil Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>
                      Salin Seluruh Kode {codeModalTab === 'CODE_GS' ? 'Code.gs' : 'index.html'}
                    </span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 rounded-2xl liquid-glass-inset text-[11px] font-mono text-slate-200 overflow-y-auto flex-1 leading-relaxed">
              <code>
                {codeModalTab === 'CODE_GS' ? GOOGLE_APPS_SCRIPT_CODE : GAS_INDEX_HTML_CODE}
              </code>
            </pre>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto text-center text-[11px] text-slate-400 z-10">
        <div className="inline-flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            Sheet &quot;Users&quot; 7 Kolom · SHA-256 Token Hash · Kedaluwarsa 5 Menit · Maksimal 3 Token/Hari
          </span>
        </div>
      </footer>
    </div>
  );
};
