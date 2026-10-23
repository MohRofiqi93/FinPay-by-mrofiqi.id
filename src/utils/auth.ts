import { generateDeterministicHash } from './calculations';

export const OWNER_VERIFIED_EMAIL = 'itptgaramofficial@gmail.com';

export interface RegisteredUserAccount {
  username: string;
  email: string;
  passwordHash: string;
  isEmailVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PendingVerificationSession {
  username: string;
  email: string;
  passwordHash: string;
  otpCode: string;
  createdAt: string;
  expiresAt: string;
}

export function hashUserPassword(username: string, rawPassword: string): string {
  const normalizedUser = username.trim().toLowerCase();
  return generateDeterministicHash(`finplanner-salt-2026::${normalizedUser}::${rawPassword}`);
}

export function generateSixDigitOtp(seed = Date.now()): string {
  const num = Math.abs(Math.imul(seed ^ 0x5f3759df, 1664525) + 1013904223) % 900000;
  return String(100000 + num);
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
  if (password.length < 4) {
    return { valid: false, error: 'Password minimal 4 karakter.' };
  }
  if (cleanEmail !== OWNER_VERIFIED_EMAIL.toLowerCase()) {
    return {
      valid: false,
      error: `Demi keamanan, pendaftaran hanya diizinkan untuk email resmi pemilik (${OWNER_VERIFIED_EMAIL}).`,
    };
  }
  return { valid: true };
}

export function verifyOtpAndActivateAccount(
  pending: PendingVerificationSession,
  inputCode: string,
  nowIso = new Date().toISOString()
): { success: boolean; account?: RegisteredUserAccount; error?: string } {
  if (inputCode.trim() !== pending.otpCode.trim()) {
    return {
      success: false,
      error: 'Kode verifikasi OTP tidak sesuai. Silakan periksa kode 6 digit yang dikirim.',
    };
  }

  return {
    success: true,
    account: {
      username: pending.username,
      email: pending.email,
      passwordHash: pending.passwordHash,
      isEmailVerified: true,
      verifiedAt: nowIso,
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
      error: 'Belum ada akun terdaftar. Silakan daftarkan Username & Password Anda terlebih dahulu.',
    };
  }
  if (!account.isEmailVerified) {
    return {
      success: false,
      error: `Akun belum diverifikasi dengan email ${OWNER_VERIFIED_EMAIL}.`,
    };
  }
  const cleanUser = usernameInput.trim().toLowerCase();
  const matchesUser =
    cleanUser === account.username.trim().toLowerCase() ||
    cleanUser === account.email.trim().toLowerCase();

  if (!matchesUser) {
    return { success: false, error: 'Username atau email tidak ditemukan.' };
  }

  const candidateHash = hashUserPassword(account.username, passwordInput);
  if (candidateHash !== account.passwordHash) {
    return { success: false, error: 'Password yang Anda masukkan salah.' };
  }

  return { success: true };
}
