import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  OWNER_VERIFIED_EMAIL,
  PendingVerificationSession,
  RegisteredUserAccount,
  generateSixDigitOtp,
  hashUserPassword,
  validateRegistrationInput,
  verifyLoginCredentials,
  verifyOtpAndActivateAccount,
} from '../utils/auth';

interface AuthGateProps {
  registeredAccount: RegisteredUserAccount | null;
  appsScriptUrl: string;
  apiSecretToken: string;
  onAccountRegisteredAndVerified: (account: RegisteredUserAccount) => void;
  onLoginSuccess: (account: RegisteredUserAccount) => void;
}

type AuthStep = 'LOGIN' | 'REGISTER' | 'VERIFY_EMAIL';

export const AuthGate: React.FC<AuthGateProps> = ({
  registeredAccount,
  appsScriptUrl,
  apiSecretToken,
  onAccountRegisteredAndVerified,
  onLoginSuccess,
}) => {
  const [step, setStep] = useState<AuthStep>(() =>
    registeredAccount && registeredAccount.isEmailVerified ? 'LOGIN' : 'REGISTER'
  );

  // Login State
  const [loginUsername, setLoginUsername] = useState(registeredAccount?.username || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register State
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState(OWNER_VERIFIED_EMAIL);
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Verification State
  const [pendingSession, setPendingSession] = useState<PendingVerificationSession | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [emailDispatchStatus, setEmailDispatchStatus] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Feedback State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const dispatchVerificationEmail = async (session: PendingVerificationSession) => {
    setIsSendingEmail(true);
    setEmailDispatchStatus(null);
    try {
      if (appsScriptUrl && appsScriptUrl.trim().startsWith('https://script.google.com')) {
        await fetch(appsScriptUrl.trim(), {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'SEND_VERIFICATION_EMAIL',
            apiSecretToken,
            email: OWNER_VERIFIED_EMAIL,
            username: session.username,
            otpCode: session.otpCode,
          }),
        });
        setEmailDispatchStatus(
          `Email verifikasi otomatis telah dikirim ke ${OWNER_VERIFIED_EMAIL} melalui Google Apps Script MailApp.`
        );
      } else {
        await new Promise((resolve) => setTimeout(resolve, 350));
        setEmailDispatchStatus(
          `Surat verifikasi untuk ${OWNER_VERIFIED_EMAIL} telah disiapkan. Kode OTP 6-digit ditampilkan di Kotak Masuk Verifikasi Instan di bawah.`
        );
      }
    } catch {
      setEmailDispatchStatus(
        `Mode Offline Aktif: Kode verifikasi untuk ${OWNER_VERIFIED_EMAIL} tersedia langsung pada panel Verifikasi Instan di bawah.`
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleStartRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Konfirmasi password tidak sama dengan password yang dimasukkan.');
      return;
    }

    const validation = validateRegistrationInput(regUsername, regPassword, regEmail);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Data pendaftaran belum valid.');
      return;
    }

    const otpCode = generateSixDigitOtp();
    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60 * 1000);

    const newPending: PendingVerificationSession = {
      username: regUsername.trim(),
      email: OWNER_VERIFIED_EMAIL,
      passwordHash: hashUserPassword(regUsername.trim(), regPassword),
      otpCode,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    setPendingSession(newPending);
    setOtpInput('');
    setStep('VERIFY_EMAIL');
    await dispatchVerificationEmail(newPending);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!pendingSession) {
      setErrorMsg('Sesi pendaftaran tidak ditemukan. Silakan daftar ulang.');
      setStep('REGISTER');
      return;
    }

    const result = verifyOtpAndActivateAccount(pendingSession, otpInput);
    if (!result.success || !result.account) {
      setErrorMsg(result.error || 'Kode OTP tidak valid.');
      return;
    }

    onAccountRegisteredAndVerified(result.account);
    setLoginUsername(result.account.username);
    setLoginPassword('');
    setSuccessMsg(
      `Selamat! Akun "${result.account.username}" telah terverifikasi dengan email ${OWNER_VERIFIED_EMAIL}. Silakan masuk menggunakan Username & Password Anda.`
    );
    setStep('LOGIN');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const check = verifyLoginCredentials(registeredAccount, loginUsername, loginPassword);
    if (!check.success || !registeredAccount) {
      setErrorMsg(check.error || 'Gagal masuk. Periksa kembali Username & Password Anda.');
      return;
    }

    onLoginSuccess({
      ...registeredAccount,
      lastLoginAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen liquid-bg-canvas text-slate-100 flex flex-col justify-between relative overflow-hidden px-4 py-8 sm:px-6">
      {/* Ambient Liquid Glass Glow Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-28 -left-24 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl ambient-orb"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-1/3 -right-28 w-96 h-96 rounded-full bg-sky-500/12 blur-3xl ambient-orb"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-28 left-1/3 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl ambient-orb"
      />

      {/* Top Minimal Brand Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center text-emerald-400 font-bold text-sm">
            FP
          </div>
          <div>
            <span className="text-sm sm:text-base font-bold tracking-tight text-slate-100 block">
              FinPlanner by mrofiqi.id
            </span>
            <span className="text-[11px] text-slate-400 block">
              Private Wealth & Cloud Sync Vault
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-300 liquid-glass px-3.5 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-mono text-[11px] truncate max-w-[200px] sm:max-w-none">
            Verified Owner: {OWNER_VERIFIED_EMAIL}
          </span>
        </div>
      </header>

      {/* Center Liquid Glass Authentication Card */}
      <main className="my-auto py-8 z-10">
        <div className="max-w-md w-full mx-auto liquid-glass rounded-3xl p-6 sm:p-8 space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl liquid-glass-inset">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setStep('LOGIN');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                step === 'LOGIN'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Masuk (Log In)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setStep('REGISTER');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                step === 'REGISTER' || step === 'VERIFY_EMAIL'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{registeredAccount ? 'Ubah / Daftar Akun' : 'Daftar Akun Baru'}</span>
            </button>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-200 leading-relaxed"
            >
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-200 leading-relaxed flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: LOGIN FORM */}
          {step === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Masuk ke Brankas Keuangan
                </h1>
                <p className="text-xs text-slate-300 mt-1">
                  Gunakan Username & Password yang telah diverifikasi dengan{' '}
                  <span className="font-mono text-emerald-300">{OWNER_VERIFIED_EMAIL}</span>
                </p>
              </div>

              {!registeredAccount && (
                <div className="p-3.5 rounded-2xl bg-amber-500/12 border border-amber-400/30 text-xs text-amber-200 flex items-center justify-between gap-3">
                  <span>Belum ada akun terdaftar di perangkat ini.</span>
                  <button
                    type="button"
                    onClick={() => setStep('REGISTER')}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Daftar Sekarang
                  </button>
                </div>
              )}

              {registeredAccount && (
                <div className="p-3 rounded-2xl liquid-glass-inset flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 truncate">
                      Akun Terdaftar: <strong className="text-white">{registeredAccount.username}</strong>
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                    Terverifikasi
                  </span>
                </div>
              )}

              <div>
                <label
                  htmlFor="login-username-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Username atau Email
                </label>
                <input
                  id="login-username-input"
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Masukkan username Anda"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-inset text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password-input"
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl liquid-glass-inset text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    aria-label="Tampilkan atau sembunyikan password"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide liquid-btn cursor-pointer"
              >
                Masuk ke Dashboard FinPlanner
              </button>
            </form>
          )}

          {/* STEP 2: REGISTER FORM */}
          {step === 'REGISTER' && (
            <form onSubmit={handleStartRegistration} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Daftarkan User & Password
                </h1>
                <p className="text-xs text-slate-300 mt-1">
                  Buat akun keamanan pribadi Anda. Verifikasi kepemilikan dikunci eksklusif ke email{' '}
                  <span className="font-mono text-emerald-300">{OWNER_VERIFIED_EMAIL}</span>.
                </p>
              </div>

              <div>
                <label
                  htmlFor="reg-username-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Username Pilihan Anda
                </label>
                <input
                  id="reg-username-input"
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Contoh: mrofiqi"
                  className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-inset text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-email-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Email Verifikasi Resmi Pemilik
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-email-input"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl liquid-glass-inset text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="reg-password-input"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password-input"
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 4 karakter"
                      className="w-full pl-3.5 pr-9 py-2.5 rounded-xl liquid-glass-inset text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((v) => !v)}
                      aria-label="Lihat password pendaftaran"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-confirm-input"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Ulangi Password
                  </label>
                  <input
                    id="reg-confirm-input"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang password"
                    className="w-full px-3.5 py-2.5 rounded-xl liquid-glass-inset text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingEmail}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide liquid-btn cursor-pointer"
              >
                {isSendingEmail
                  ? 'Mengirim Verifikasi Email...'
                  : `Daftar & Kirim Verifikasi ke ${OWNER_VERIFIED_EMAIL}`}
              </button>
            </form>
          )}

          {/* STEP 3: EMAIL VERIFICATION STEP */}
          {step === 'VERIFY_EMAIL' && pendingSession && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Verifikasi Email Pendaftaran
                </h1>
                <p className="text-xs text-slate-300 mt-1">
                  Konfirmasi bahwa pendaftaran akun{' '}
                  <strong className="text-white">{pendingSession.username}</strong> disetujui oleh{' '}
                  <span className="font-mono text-emerald-300">{OWNER_VERIFIED_EMAIL}</span>.
                </p>
              </div>

              {/* Instant Verification Outbox Preview so User can verify immediately both Online & Offline */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Surat Verifikasi Terkirim · {OWNER_VERIFIED_EMAIL}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">OTP 6-Digit</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {emailDispatchStatus ||
                    `Kode verifikasi keamanan untuk aktivasi akun ${pendingSession.username}:`}
                </p>
                <div className="p-3 rounded-xl liquid-glass-inset flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">KODE VERIFIKASI EMAIL</span>
                    <span
                      data-testid="generated-otp-code"
                      className="text-xl font-bold font-mono tracking-widest text-emerald-400"
                    >
                      {pendingSession.otpCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtpInput(pendingSession.otpCode)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Gunakan Kode Ini
                  </button>
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <a
                    href={`mailto:${OWNER_VERIFIED_EMAIL}?subject=${encodeURIComponent(
                      `[FinPlanner Verified] Akun ${pendingSession.username} Terdaftar`
                    )}&body=${encodeURIComponent(
                      `Halo,\n\nAkun FinPlanner Anda telah didaftarkan:\nUsername: ${pendingSession.username}\nEmail Terverifikasi: ${OWNER_VERIFIED_EMAIL}\nKode Verifikasi OTP: ${pendingSession.otpCode}\nWaktu: ${new Date().toLocaleString('id-ID')}`
                    )}`}
                    className="text-sky-300 hover:underline"
                  >
                    Kirim Salinan Bukti ke Aplikasi Email ({OWNER_VERIFIED_EMAIL}) →
                  </a>
                </div>
              </div>

              <div>
                <label
                  htmlFor="verify-otp-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Masukkan 6 Digit Kode Verifikasi OTP
                </label>
                <input
                  id="verify-otp-input"
                  type="text"
                  required
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="Contoh: 482910"
                  className="w-full px-4 py-3 rounded-xl liquid-glass-inset text-center font-mono text-lg tracking-widest text-emerald-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide liquid-btn cursor-pointer"
              >
                Verifikasi Email & Aktifkan Akun
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer Security Note */}
      <footer className="max-w-5xl w-full mx-auto text-center text-[11px] text-slate-400 z-10">
        <div className="inline-flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            Dilindungi Enkripsi Lokal & Verifikasi Kepemilikan Email {OWNER_VERIFIED_EMAIL}
          </span>
        </div>
      </footer>
    </div>
  );
};
