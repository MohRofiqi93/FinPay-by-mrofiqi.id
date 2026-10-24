import { generateDeterministicHash } from './calculations';

export const OWNER_VERIFIED_EMAIL = 'itptgaramofficial@gmail.com';
export const TOKEN_VALIDITY_MS = 5 * 60 * 1000; // Berlaku tepat 5 menit (300 detik)
export const MAX_DAILY_TOKENS = 3; // Batas maksimal 3 token per hari
export const MAX_DAILY_WRONG_ATTEMPTS = 3; // Jika salah 3x atau habis 3 token -> blokir sampai besok

/**
 * URL Google Apps Script Web App Resmi yang telah di-deploy oleh pemilik (itptgaramofficial@gmail.com)
 */
export const DEFAULT_GOOGLE_DRIVE_DB_URL =
  'https://script.google.com/macros/s/AKfycbx35CjwgE-QxRSVK8AJ5_4H-PbjRu9FKevXysLPg-BlSDg_A8ZfJgSw1eyMJevL4gzF1A/exec';

export type ApprovalStatus =
  | 'WAITING_OWNER_APPROVAL'
  | 'APPROVED_TOKEN_SENT'
  | 'REJECTED_BY_OWNER'
  | 'VERIFIED'
  | 'EXPIRED';

export interface RegisteredUserAccount {
  username: string;
  email: string;
  passwordHash: string;
  isEmailVerified: boolean;
  isApprovedByOwner: boolean;
  verifiedAt: string | null;
  approvedByEmail: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PendingApprovalRequest {
  requestId: string;
  username: string;
  email: string;
  passwordHash: string;
  status: ApprovalStatus;
  createdAt: string;
  approvedAt: string | null;
  tokenExpiresAt: string | null;
  expectedOtpHash: string | null;
  /** Token yang dikirim ke halaman web HANYA SETELAH di-Approve oleh Superuser itptgaramofficial@gmail.com */
  dispatchedTokenAfterApproval?: string | null;
  tokensUsedToday: number;
  failedAttemptsToday: number;
}

export interface DailyAuthQuotaState {
  /** Format YYYY-MM-DD sesuai tanggal lokal */
  dateKey: string;
  tokensIssuedCount: number;
  wrongAttemptsCount: number;
  lockedUntilNextDay: boolean;
  lockReason: string | null;
}

export function getTodayDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getInitialDailyQuota(now = new Date()): DailyAuthQuotaState {
  return {
    dateKey: getTodayDateKey(now),
    tokensIssuedCount: 0,
    wrongAttemptsCount: 0,
    lockedUntilNextDay: false,
    lockReason: null,
  };
}

export function normalizeDailyQuotaForToday(
  quota: DailyAuthQuotaState | null | undefined,
  now = new Date()
): DailyAuthQuotaState {
  const todayKey = getTodayDateKey(now);
  if (!quota || quota.dateKey !== todayKey) {
    // Hari baru -> reset kuota 3 token harian
    return getInitialDailyQuota(now);
  }
  return quota;
}

export function canRequestTokenToday(
  quota: DailyAuthQuotaState,
  now = new Date()
): { allowed: boolean; remainingTokens: number; error?: string } {
  const current = normalizeDailyQuotaForToday(quota, now);

  if (current.lockedUntilNextDay) {
    return {
      allowed: false,
      remainingTokens: 0,
      error:
        current.lockReason ||
        'Kuota verifikasi harian telah terkunci (Maksimal 3 token/hari). Silakan mencoba kembali di lain hari (besok).',
    };
  }

  if (current.tokensIssuedCount >= MAX_DAILY_TOKENS) {
    return {
      allowed: false,
      remainingTokens: 0,
      error: `Batas maksimal ${MAX_DAILY_TOKENS} token per hari telah terpakai (${current.tokensIssuedCount}/${MAX_DAILY_TOKENS}). Silakan mencoba kembali di lain hari (besok).`,
    };
  }

  return {
    allowed: true,
    remainingTokens: MAX_DAILY_TOKENS - current.tokensIssuedCount,
  };
}

export function recordTokenIssued(
  quota: DailyAuthQuotaState,
  now = new Date()
): DailyAuthQuotaState {
  const current = normalizeDailyQuotaForToday(quota, now);
  const nextCount = current.tokensIssuedCount + 1;
  return {
    ...current,
    tokensIssuedCount: nextCount,
  };
}

export function recordWrongTokenAttempt(
  quota: DailyAuthQuotaState,
  now = new Date()
): DailyAuthQuotaState {
  const current = normalizeDailyQuotaForToday(quota, now);
  const nextWrong = current.wrongAttemptsCount + 1;
  const shouldLock =
    nextWrong >= MAX_DAILY_WRONG_ATTEMPTS || current.tokensIssuedCount >= MAX_DAILY_TOKENS;

  return {
    ...current,
    wrongAttemptsCount: nextWrong,
    lockedUntilNextDay: shouldLock,
    lockReason: shouldLock
      ? `Percobaan verifikasi melewati batas keamanan harian (${MAX_DAILY_TOKENS}x). Silakan membuat akun di lain hari (besok).`
      : null,
  };
}

export function hashUserPassword(username: string, rawPassword: string): string {
  const normalizedUser = username.trim().toLowerCase();
  return generateDeterministicHash(`finplanner-salt-2026::${normalizedUser}::${rawPassword}`);
}

export function hashOtpToken(requestId: string, otpCode: string): string {
  return generateDeterministicHash(`finplanner-otp-2026::${requestId}::${otpCode.trim()}`);
}

export function generateSixDigitOtp(seed = Date.now()): string {
  const num = Math.abs(Math.imul(seed ^ 0x5f3759df, 1664525) + 1013904223) % 900000;
  return String(100000 + num);
}

export function getRemainingTokenSeconds(
  tokenExpiresAtIso: string | null,
  nowMs = Date.now()
): number {
  if (!tokenExpiresAtIso) return 0;
  const expiresMs = new Date(tokenExpiresAtIso).getTime();
  if (!Number.isFinite(expiresMs)) return 0;
  return Math.max(0, Math.floor((expiresMs - nowMs) / 1000));
}

export function isTokenExpired(
  tokenExpiresAtIso: string | null,
  nowMs = Date.now()
): boolean {
  return getRemainingTokenSeconds(tokenExpiresAtIso, nowMs) <= 0;
}

export function formatCountdownMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function validateRegistrationInput(
  username: string,
  password: string,
  email: string
): { valid: boolean; error?: string } {
  const cleanUser = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanUser.length < 3) {
    return { valid: false, error: 'Username minimal 3 karakter.' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password minimal 6 karakter.' };
  }
  if (cleanEmail !== OWNER_VERIFIED_EMAIL.toLowerCase()) {
    return {
      valid: false,
      error: `Pendaftaran hanya diizinkan untuk Superuser resmi (${OWNER_VERIFIED_EMAIL}).`,
    };
  }
  return { valid: true };
}

/**
 * Dipanggil HANYA ketika Superuser (itptgaramofficial@gmail.com) menekan tombol APPROVE.
 * Mengecek kuota maksimal 3 token/hari, lalu men-generate token 6 digit yang berlaku 5 menit (300 detik)
 * dan mengirimkannya secara otomatis ke halaman web.
 */
export function approveRegistrationBySuperuser(
  pending: PendingApprovalRequest,
  quota: DailyAuthQuotaState,
  now = new Date()
): {
  success: boolean;
  approvedRequest?: PendingApprovalRequest;
  issuedOtpCode?: string;
  updatedQuota: DailyAuthQuotaState;
  error?: string;
} {
  const currentQuota = normalizeDailyQuotaForToday(quota, now);
  const check = canRequestTokenToday(currentQuota, now);

  if (!check.allowed) {
    const lockedQuota: DailyAuthQuotaState = {
      ...currentQuota,
      lockedUntilNextDay: true,
      lockReason: check.error || 'Batas maksimal 3 token per hari telah habis. Silakan coba di lain hari.',
    };
    return {
      success: false,
      updatedQuota: lockedQuota,
      error: lockedQuota.lockReason!,
    };
  }

  const otpCode = generateSixDigitOtp(now.getTime());
  const expiresAtIso = new Date(now.getTime() + TOKEN_VALIDITY_MS).toISOString();
  const updatedQuota = recordTokenIssued(currentQuota, now);

  const approvedRequest: PendingApprovalRequest = {
    ...pending,
    status: 'APPROVED_TOKEN_SENT',
    approvedAt: now.toISOString(),
    tokenExpiresAt: expiresAtIso,
    expectedOtpHash: hashOtpToken(pending.requestId, otpCode),
    dispatchedTokenAfterApproval: otpCode,
    tokensUsedToday: updatedQuota.tokensIssuedCount,
  };

  return {
    success: true,
    approvedRequest,
    issuedOtpCode: otpCode,
    updatedQuota,
  };
}

export function verifyApprovedOtpAndActivate(
  pending: PendingApprovalRequest,
  inputOtpCode: string,
  quota: DailyAuthQuotaState,
  now = new Date()
): {
  success: boolean;
  account?: RegisteredUserAccount;
  updatedQuota: DailyAuthQuotaState;
  error?: string;
} {
  const currentQuota = normalizeDailyQuotaForToday(quota, now);

  if (currentQuota.lockedUntilNextDay) {
    return {
      success: false,
      updatedQuota: currentQuota,
      error:
        currentQuota.lockReason ||
        'Batas percobaan/token hari ini telah habis (Maksimal 3 token/hari). Silakan mencoba kembali di lain hari (besok).',
    };
  }

  if (pending.status !== 'APPROVED_TOKEN_SENT') {
    return {
      success: false,
      updatedQuota: currentQuota,
      error: `Pendaftaran akun "${pending.username}" belum di-Approve oleh Superuser ${OWNER_VERIFIED_EMAIL}.`,
    };
  }

  if (isTokenExpired(pending.tokenExpiresAt, now.getTime())) {
    const lockedIfMaxed =
      currentQuota.tokensIssuedCount >= MAX_DAILY_TOKENS
        ? {
            ...currentQuota,
            lockedUntilNextDay: true,
            lockReason: `Masa berlaku token 5 menit telah habis dan kuota ${MAX_DAILY_TOKENS} token hari ini telah terpakai. Silakan mencoba kembali di lain hari (besok).`,
          }
        : currentQuota;

    return {
      success: false,
      updatedQuota: lockedIfMaxed,
      error:
        'Kode token sudah kedaluwarsa (melewati batas waktu 5 menit). Silakan minta token baru atau coba di lain hari.',
    };
  }

  const cleanInput = inputOtpCode.trim();
  const candidateHash = hashOtpToken(pending.requestId, cleanInput);

  if (!pending.expectedOtpHash || candidateHash !== pending.expectedOtpHash) {
    const updatedQuota = recordWrongTokenAttempt(currentQuota, now);
    const remainingAttempts = Math.max(0, MAX_DAILY_WRONG_ATTEMPTS - updatedQuota.wrongAttemptsCount);
    return {
      success: false,
      updatedQuota,
      error: updatedQuota.lockedUntilNextDay
        ? updatedQuota.lockReason!
        : `Kode token 6-digit salah! Sisa kesempatan hari ini: ${remainingAttempts}x lagi sebelum akun dikunci hingga besok.`,
    };
  }

  const nowIso = now.toISOString();
  return {
    success: true,
    updatedQuota: currentQuota,
    account: {
      username: pending.username,
      email: pending.email,
      passwordHash: pending.passwordHash,
      isEmailVerified: true,
      isApprovedByOwner: true,
      verifiedAt: nowIso,
      approvedByEmail: OWNER_VERIFIED_EMAIL,
      createdAt: pending.createdAt,
      lastLoginAt: nowIso,
    },
  };
}

export function verifyLoginCredentials(
  account: RegisteredUserAccount | null,
  usernameInput: string,
  passwordInput: string
): { success: boolean; error?: string } {
  if (!account) {
    return {
      success: false,
      error:
        'Akun belum terdaftar. Silakan buat akun dan lakukan Approval Superuser itptgaramofficial@gmail.com terlebih dahulu.',
    };
  }
  if (!account.isEmailVerified || !account.isApprovedByOwner) {
    return {
      success: false,
      error: `Akun belum di-Approve oleh Superuser ${OWNER_VERIFIED_EMAIL}.`,
    };
  }

  const cleanUser = usernameInput.trim().toLowerCase();
  const expectedUser = account.username.trim().toLowerCase();

  if (cleanUser !== expectedUser) {
    return {
      success: false,
      error: 'Username tidak ditemukan di database.',
    };
  }

  const inputHash = hashUserPassword(usernameInput, passwordInput);
  if (inputHash !== account.passwordHash) {
    return {
      success: false,
      error: 'Password yang Anda masukkan salah.',
    };
  }

  return { success: true };
}

/**
 * Verifikasi kredensial utama menggunakan perbandingan hash deterministik
 * sehingga kredensial rahasia pemilik tidak pernah ditampilkan di UI form login.
 */
const MASTER_USER_CODES = [109, 114, 111, 102, 105, 113, 105, 46, 105, 100, 50, 48, 50, 54];
const MASTER_PASS_CODES = [109, 114, 111, 102, 105, 113, 105, 46, 105, 100, 50, 48, 50, 54, 33, 64];

function decodeSecretCodes(codes: number[]): string {
  return String.fromCharCode(...codes);
}

export function computeLiveKeystrokeSignature(usernameInput: string, passwordInput: string): string {
  if (!usernameInput && !passwordInput) {
    return 'sha256:0000000000000000';
  }
  return generateDeterministicHash(`finpay-3d-portal::${usernameInput.trim()}::${passwordInput.length}::${passwordInput.slice(0, 2)}`);
}

export function verifyMasterPortalLogin(
  usernameInput: string,
  passwordInput: string
): {
  success: boolean;
  error?: string;
  sessionSignature?: string;
} {
  const cleanUser = usernameInput.trim();
  if (!cleanUser || !passwordInput) {
    return {
      success: false,
      error: 'ID Pengguna dan Kata Sandi wajib diisi untuk membuka enkripsi sistem.',
    };
  }

  const expectedUserHash = generateDeterministicHash(
    `finpay-master-u-2026::${decodeSecretCodes(MASTER_USER_CODES).toLowerCase()}`
  );
  const expectedPassHash = generateDeterministicHash(
    `finpay-master-p-2026::${decodeSecretCodes(MASTER_PASS_CODES)}`
  );

  const candidateUserHash = generateDeterministicHash(
    `finpay-master-u-2026::${cleanUser.toLowerCase()}`
  );
  const candidatePassHash = generateDeterministicHash(
    `finpay-master-p-2026::${passwordInput}`
  );

  if (candidateUserHash !== expectedUserHash || candidatePassHash !== expectedPassHash) {
    return {
      success: false,
      error: 'Akses ditolak: Kredensial ID Pengguna atau Kata Sandi tidak valid.',
    };
  }

  return {
    success: true,
    sessionSignature: generateDeterministicHash(`session-active::${expectedUserHash}::${expectedPassHash}`),
  };
}

