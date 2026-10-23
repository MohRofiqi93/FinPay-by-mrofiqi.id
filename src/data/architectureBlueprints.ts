export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * SISTEM PENDAFTARAN, APPROVAL ADMIN, VERIFIKASI TOKEN 5 MENIT & LOGIN AMAN
 * File: Code.gs (Google Apps Script Backend + Google Sheets Database)
 * ============================================================================
 */

// 1. KONFIGURASI UTAMA (Ubah ADMIN_EMAIL sesuai email Admin Anda)
const ADMIN_EMAIL = "itptgaramofficial@gmail.com";
const SHEET_NAME = "Users";
const TIMEZONE = "Asia/Jakarta";
const TOKEN_VALIDITY_MS = 5 * 60 * 1000; // 5 Menit (300.000 milidetik)
const MAX_DAILY_TOKENS = 3;              // Maksimal 3 token per hari

/**
 * Jalankan fungsi setupDatabase() ini PERTAMA KALI dari Editor Apps Script (Klik tombol Run).
 * Fungsi ini otomatis membuat tab sheet "Users" beserta 7 kolom header jika belum ada,
 * sekaligus memberikan izin akses (Permissions) Google Sheets & Gmail.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  const headers = [
    "Email",
    "Nama",
    "Status_Akun",
    "Token_Hash",
    "Token_Expires_At",
    "Daily_Token_Count",
    "Last_Request_Date"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#0F172A")
    .setFontColor("#10B981");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  // Simpan kunci rahasia Admin otomatis di ScriptProperties untuk keamanan Link Approve
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ADMIN_SECRET_KEY")) {
    props.setProperty("ADMIN_SECRET_KEY", Utilities.getUuid());
  }

  Logger.log("Database Sheet 'Users' dengan 7 kolom berhasil disiapkan!");
  return {
    success: true,
    message: "Sheet 'Users' beserta 7 kolom berhasil dibuat!"
  };
}

/**
 * Helper: Mendapatkan objek Sheet "Users" (otomatis dibuat jika belum ada)
 */
function getUsersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    setupDatabase();
    sheet = ss.getSheetByName(SHEET_NAME);
  }
  return sheet;
}

/**
 * Helper: Mendapatkan tanggal hari ini (YYYY-MM-DD) sesuai zona waktu Asia/Jakarta
 */
function getTodayJakarta_() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
}

/**
 * Helper: Hash string (Token 6 Digit) menggunakan SHA-256 via Utilities.computeDigest
 */
function hashSHA256_(rawText) {
  const clean = String(rawText || "").trim();
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    clean,
    Utilities.Charset.UTF_8
  );
  return digest
    .map(function (byte) {
      const v = byte < 0 ? byte + 256 : byte;
      return ("0" + v.toString(16)).slice(-2);
    })
    .join("");
}

/**
 * Helper: Mencari baris user berdasarkan Email (Case-Insensitive)
 * Mengembalikan { rowNumber, email, nama, status, tokenHash, tokenExpiresAt, dailyCount, lastDate } atau null
 */
function findUserByEmail_(emailInput) {
  const cleanEmail = String(emailInput || "").trim().toLowerCase();
  if (!cleanEmail) return null;

  const sheet = getUsersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (let i = 0; i < data.length; i++) {
    const rowEmail = String(data[i][0] || "").trim().toLowerCase();
    if (rowEmail === cleanEmail) {
      return {
        rowNumber: i + 2,
        email: String(data[i][0]).trim(),
        nama: String(data[i][1]).trim(),
        status: String(data[i][2]).trim().toUpperCase(),
        tokenHash: String(data[i][3] || "").trim(),
        tokenExpiresAt: Number(data[i][4] || 0),
        dailyCount: Number(data[i][5] || 0),
        lastDate: thisDateToString_(data[i][6])
      };
    }
  }
  return null;
}

/**
 * Helper: Normalisasi nilai tanggal dari sel Google Sheets menjadi string YYYY-MM-DD
 */
function thisDateToString_(cellVal) {
  if (!cellVal) return "";
  if (Object.prototype.toString.call(cellVal) === "[object Date]") {
    return Utilities.formatDate(cellVal, TIMEZONE, "yyyy-MM-dd");
  }
  return String(cellVal).trim();
}

/**
 * Helper: Mendapatkan kunci rahasia Admin untuk validasi Link Approve di email
 */
function getAdminSecretKey_() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty("ADMIN_SECRET_KEY");
  if (!key) {
    key = Utilities.getUuid();
    props.setProperty("ADMIN_SECRET_KEY", key);
  }
  return key;
}

/**
 * ============================================================================
 * 1. FUNGSI UTAMA WEB APP: doGet(e)
 * Menangani:
 * - Tampilan utama aplikasi web (index.html)
 * - Klik "Link Approve Cepat" dari email Admin (?action=approve&email=...&key=...)
 * - Klik "Link Verifikasi Otomatis" dari email User (?action=verify&email=...&token=...)
 * ============================================================================
 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = String(params.action || "").trim().toLowerCase();

  // A. Jika Admin mengklik "Link Approve Cepat" dari Email Notifikasi Admin
  if (action === "approve") {
    const targetEmail = String(params.email || "").trim().toLowerCase();
    const providedKey = String(params.key || "").trim();

    if (providedKey !== getAdminSecretKey_()) {
      return renderStatusHtmlCard_(
        "Akses Ditolak",
        "Kunci keamanan Admin tidak valid.",
        false
      );
    }

    const result = processAdminApprovalAndSendToken_(targetEmail);
    return renderStatusHtmlCard_(
      result.success ? "Akun Disetujui & Token Terkirim" : "Gagal Mengirim Token",
      result.message,
      result.success
    );
  }

  // B. Jika User mengklik "Link Verifikasi Otomatis" dari Email User
  if (action === "verify") {
    const userEmail = String(params.email || "").trim().toLowerCase();
    const rawToken = String(params.token || "").trim();

    const verifyResult = verifyUserToken(userEmail, rawToken);
    return renderStatusHtmlCard_(
      verifyResult.success ? "Verifikasi Berhasil (VERIFIED)" : "Verifikasi Ditolak",
      verifyResult.message,
      verifyResult.success
    );
  }

  // C. Render halaman utama SPA (index.html)
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Sistem Pendaftaran & Verifikasi Keamanan")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/**
 * ============================================================================
 * 2. PENDAFTARAN USER BARU (Dipanggil dari Tab 1 di index.html)
 * ============================================================================
 */
function registerUser(namaInput, emailInput) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const nama = String(namaInput || "").trim();
    const email = String(emailInput || "").trim().toLowerCase();

    if (nama.length < 2) {
      return { success: false, message: "Nama lengkap minimal 2 karakter." };
    }
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      return { success: false, message: "Format alamat email tidak valid." };
    }

    const existing = findUserByEmail_(email);
    if (existing) {
      return {
        success: false,
        message: "Email ini sudah terdaftar dengan status: " + existing.status + ". Silakan cek status atau minta token."
      };
    }

    const sheet = getUsersSheet_();
    // Simpan baris baru ke Sheet "Users":
    // [Email, Nama, Status_Akun="PENDING", Token_Hash="", Token_Expires_At="", Daily_Token_Count=0, Last_Request_Date=""]
    sheet.appendRow([email, nama, "PENDING", "", "", 0, ""]);

    // Kirim email notifikasi ke ADMIN_EMAIL berisi Link Approve Cepat
    const webAppUrl = ScriptApp.getService().getUrl();
    const approveUrl =
      webAppUrl +
      "?action=approve&email=" +
      encodeURIComponent(email) +
      "&key=" +
      encodeURIComponent(getAdminSecretKey_());

    const subject = "[APPROVAL PENDAFTARAN BARU] " + nama + " (" + email + ")";
    const htmlBody =
      '<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#0f172a;color:#f8fafc;">' +
      '<h2 style="color:#10b981;margin-top:0;">Permintaan Pendaftaran Akun Baru</h2>' +
      '<p>Halo Admin (<b>' + ADMIN_EMAIL + '</b>), seseorang baru saja mendaftar di Web App Anda:</p>' +
      '<table style="width:100%;background:#1e293b;padding:12px;border-radius:10px;margin:16px 0;color:#f8fafc;">' +
      '<tr><td style="padding:4px 8px;color:#94a3b8;">Nama:</td><td style="padding:4px 8px;"><b>' + nama + '</b></td></tr>' +
      '<tr><td style="padding:4px 8px;color:#94a3b8;">Email:</td><td style="padding:4px 8px;"><b>' + email + '</b></td></tr>' +
      '<tr><td style="padding:4px 8px;color:#94a3b8;">Status Saat Ini:</td><td style="padding:4px 8px;color:#fbbf24;"><b>PENDING</b></td></tr>' +
      '</table>' +
      '<p>Pilih salah satu cara di bawah ini untuk menyetujui (Approve) dan mengirimkan Token 5 Menit ke user:</p>' +
      '<div style="margin:22px 0;">' +
      '<a href="' + approveUrl + '" style="background:#10b981;color:#022c22;padding:12px 22px;text-decoration:none;font-weight:bold;border-radius:10px;display:inline-block;">✅ KLIK UNTUK APPROVE & KIRIM TOKEN (5 MENIT)</a>' +
      '</div>' +
      '<p style="font-size:12px;color:#94a3b8;">Atau ubah manual kolom <b>Status_Akun</b> dari <b>PENDING</b> menjadi <b>APPROVED</b> langsung di Google Sheets tab <b>Users</b>.</p>' +
      '</div>';

    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: subject,
      htmlBody: htmlBody
    });

    return {
      success: true,
      message: "Pendaftaran berhasil disimpan dengan status PENDING! Email permintaan persetujuan telah dikirim ke Admin (" + ADMIN_EMAIL + ")."
    };
  } catch (err) {
    return {
      success: false,
      message: "Terjadi kesalahan saat mendaftar: " + err.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * 3. INSTALLABLE TRIGGER onEdit: Saat Admin Mengubah "PENDING" -> "APPROVED"
 *    di Google Sheets secara manual
 * ============================================================================
 */
function onEditTrigger(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  // Kolom C (kolom ke-3) adalah Status_Akun, baris >= 2
  if (col === 3 && row >= 2) {
    const newValue = String(e.value || sheet.getRange(row, 3).getValue() || "")
      .trim()
      .toUpperCase();

    if (newValue === "APPROVED") {
      const targetEmail = String(sheet.getRange(row, 1).getValue() || "")
        .trim()
        .toLowerCase();
      if (targetEmail) {
        processAdminApprovalAndSendToken_(targetEmail);
      }
    }
  }
}

/**
 * ============================================================================
 * 4. GENERATOR & PENGIRIM TOKEN 6 DIGIT (BATAS 5 MENIT & MAKSIMAL 3X SEHARI)
 * ============================================================================
 */
function processAdminApprovalAndSendToken_(emailInput) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const user = findUserByEmail_(emailInput);
    if (!user) {
      return { success: false, message: "Data email user tidak ditemukan di Sheet Users." };
    }

    if (user.status === "VERIFIED") {
      return {
        success: false,
        message: "Akun " + user.email + " sudah berstatus VERIFIED (Aktif)."
      };
    }

    const sheet = getUsersSheet_();
    const todayStr = getTodayJakarta_();

    // a) Cek apakah tanggal hari ini (Asia/Jakarta) berbeda dengan Last_Request_Date
    let currentCount = user.dailyCount;
    if (user.lastDate !== todayStr) {
      currentCount = 0; // Hari baru -> reset kuota harian menjadi 0
    }

    // b) Cek apakah Daily_Token_Count sudah mencapai 3 pada hari yang sama
    if (currentCount >= MAX_DAILY_TOKENS) {
      // Pastikan status tetap tercatat APPROVED tetapi pengiriman token ditolak hari ini
      sheet.getRange(user.rowNumber, 3).setValue("APPROVED");
      return {
        success: false,
        message: "Batas maksimal 3 token hari ini telah habis. Silakan coba lagi besok."
      };
    }

    // c) Tambahkan Daily_Token_Count + 1, perbarui Last_Request_Date, & buat Token 6 angka acak
    const nextCount = currentCount + 1;
    const rawToken = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = hashSHA256_(rawToken);
    const expiresAtMs = Date.now() + TOKEN_VALIDITY_MS; // Tepat 5 menit (300.000 ms)

    // Simpan ke baris user di Sheet "Users" (Kolom C s/d G)
    sheet.getRange(user.rowNumber, 3, 1, 5).setValues([[
      "APPROVED",
      tokenHash,
      expiresAtMs,
      nextCount,
      todayStr
    ]]);

    // Kirim email ke User berisi Kode Token 6 Digit & Link Verifikasi Otomatis (Berlaku 5 Menit)
    const webAppUrl = ScriptApp.getService().getUrl();
    const verifyLink =
      webAppUrl +
      "?action=verify&email=" +
      encodeURIComponent(user.email) +
      "&token=" +
      encodeURIComponent(rawToken);

    const subject = "[KODE TOKEN 5 MENIT] Verifikasi Akun Anda (" + rawToken + ")";
    const htmlBody =
      '<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;border:1px solid #10b981;border-radius:16px;background:#0f172a;color:#f8fafc;">' +
      '<h2 style="color:#10b981;margin-top:0;">Pendaftaran Anda Telah Disetujui (APPROVED)!</h2>' +
      '<p>Halo <b>' + user.nama + '</b>, akun Anda telah disetujui oleh Admin. Gunakan kode token 6 digit berikut atau klik tombol verifikasi di bawah ini:</p>' +
      '<div style="background:#1e293b;padding:18px;border-radius:12px;text-align:center;margin:20px 0;border:1px solid #334155;">' +
      '<div style="font-size:11px;color:#94a3b8;letter-spacing:1px;">KODE TOKEN VERIFIKASI (BERLAKU 5 MENIT)</div>' +
      '<div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#10b981;margin-top:6px;font-family:monospace;">' + rawToken + '</div>' +
      '</div>' +
      '<div style="text-align:center;margin:22px 0;">' +
      '<a href="' + verifyLink + '" style="background:#10b981;color:#022c22;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:10px;display:inline-block;">🔐 VERIFIKASI AKUN OTOMATIS SEKARANG</a>' +
      '</div>' +
      '<p style="font-size:12px;color:#fbbf24;">⚠️ <b>Penting:</b> Kode token dan link di atas <b>hanya berlaku selama 5 menit</b> sejak email ini dikirim. Kuota pengiriman token hari ini: <b>' + nextCount + ' dari ' + MAX_DAILY_TOKENS + '</b>.</p>' +
      '</div>';

    MailApp.sendEmail({
      to: user.email,
      subject: subject,
      htmlBody: htmlBody
    });

    return {
      success: true,
      dailyCount: nextCount,
      expiresAtMs: expiresAtMs,
      message: "Status akun " + user.email + " telah APPROVED. Kode token 6 digit (berlaku 5 menit) telah dikirim ke email user (Kuota hari ini: " + nextCount + "/3)."
    };
  } catch (err) {
    return {
      success: false,
      message: "Gagal memproses pengiriman token: " + err.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * 5. KIRIM ULANG TOKEN (Dipanggil oleh User yang sudah APPROVED di Tab 2)
 * ============================================================================
 */
function resendVerificationToken(emailInput) {
  const user = findUserByEmail_(emailInput);
  if (!user) {
    return {
      success: false,
      message: "Email belum terdaftar. Silakan daftar terlebih dahulu di Tab 1."
    };
  }

  if (user.status === "PENDING") {
    return {
      success: false,
      message: "Status akun Anda masih PENDING (Menunggu persetujuan Admin). Token hanya bisa dikirim setelah di-APPROVE oleh Admin."
    };
  }

  if (user.status === "VERIFIED") {
    return {
      success: false,
      message: "Akun Anda sudah berstatus VERIFIED! Silakan langsung masuk di Tab 3 (Cek Status / Login)."
    };
  }

  return processAdminApprovalAndSendToken_(user.email);
}

/**
 * ============================================================================
 * 6. VALIDASI TOKEN & UBAH STATUS MENJADI "VERIFIED" (One-Time Use)
 * ============================================================================
 */
function verifyUserToken(emailInput, tokenInput) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const cleanEmail = String(emailInput || "").trim().toLowerCase();
    const cleanToken = String(tokenInput || "").trim();

    if (!cleanEmail || !/^[0-9]{6}$/.test(cleanToken)) {
      return {
        success: false,
        message: "Masukkan alamat email yang valid dan kode token 6 digit angka."
      };
    }

    const user = findUserByEmail_(cleanEmail);
    if (!user) {
      return {
        success: false,
        message: "Email tidak ditemukan di database."
      };
    }

    // a) Cek apakah Status_Akun sudah APPROVED
    if (user.status === "PENDING") {
      return {
        success: false,
        message: "Verifikasi ditolak: Status akun Anda masih PENDING (menunggu persetujuan Admin)."
      };
    }

    if (user.status === "VERIFIED") {
      return {
        success: true,
        alreadyVerified: true,
        user: { email: user.email, nama: user.nama, status: "VERIFIED" },
        message: "Akun Anda sudah terverifikasi sebelumnya (VERIFIED). Silakan langsung Login."
      };
    }

    if (!user.tokenHash || !user.tokenExpiresAt) {
      return {
        success: false,
        message: "Belum ada token aktif untuk akun ini. Silakan klik tombol 'Kirim Ulang Token'."
      };
    }

    // b) Cek apakah waktu sekarang melewati Token_Expires_At (lewat 5 menit)
    const nowMs = Date.now();
    if (nowMs > user.tokenExpiresAt) {
      return {
        success: false,
        expired: true,
        message: "Token sudah kadaluarsa (lewat 5 menit). Silakan minta token baru (maksimal 3x sehari)."
      };
    }

    // c) Cek apakah SHA-256 hash dari token yang dimasukkan cocok dengan Token_Hash di Sheets
    const inputHash = hashSHA256_(cleanToken);
    if (inputHash !== user.tokenHash) {
      return {
        success: false,
        message: "Kode token 6 digit yang Anda masukkan salah! Periksa kembali email Anda."
      };
    }

    // Jika semua cocok dan belum lewat 5 menit:
    // - Ubah Status_Akun (Kolom C) menjadi "VERIFIED"
    // - Kosongkan Token_Hash (Kolom D) & Token_Expires_At (Kolom E) agar One-Time Use
    const sheet = getUsersSheet_();
    sheet.getRange(user.rowNumber, 3, 1, 3).setValues([["VERIFIED", "", ""]]);

    return {
      success: true,
      user: {
        email: user.email,
        nama: user.nama,
        status: "VERIFIED"
      },
      message: "Selamat! Akun Anda (" + user.email + ") telah resmi VERIFIED dan aman. Anda sekarang dapat masuk ke Dashboard."
    };
  } catch (err) {
    return {
      success: false,
      message: "Terjadi kesalahan saat verifikasi: " + err.message
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * 7. CEK STATUS AKUN / LOGIN USER (Dipanggil dari Tab 3 di index.html)
 * ============================================================================
 */
function checkUserStatusOrLogin(emailInput) {
  const cleanEmail = String(emailInput || "").trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, message: "Masukkan alamat email Anda terlebih dahulu." };
  }

  const user = findUserByEmail_(cleanEmail);
  if (!user) {
    return {
      success: false,
      message: "Email belum terdaftar di database. Silakan daftar di Tab 1."
    };
  }

  const todayStr = getTodayJakarta_();
  const effectiveDailyCount = user.lastDate === todayStr ? user.dailyCount : 0;

  if (user.status === "VERIFIED") {
    return {
      success: true,
      canLogin: true,
      user: {
        email: user.email,
        nama: user.nama,
        status: user.status,
        dailyCount: effectiveDailyCount,
        lastDate: user.lastDate
      },
      message: "Login Berhasil! Status akun Anda sudah VERIFIED dan aktif."
    };
  }

  return {
    success: true,
    canLogin: false,
    user: {
      email: user.email,
      nama: user.nama,
      status: user.status,
      dailyCount: effectiveDailyCount,
      lastDate: user.lastDate,
      tokenExpiresAt: user.tokenExpiresAt
    },
    message:
      user.status === "PENDING"
        ? "Status akun Anda masih PENDING (Menunggu persetujuan Admin)."
        : "Status akun Anda sudah APPROVED! Silakan buka Tab 2 dan masukkan kode token 6 digit dari email Anda."
  };
}

/**
 * Helper: Render halaman HTML responsif saat Admin/User mengklik link dari Email
 */
function renderStatusHtmlCard_(title, message, isSuccess) {
  const badgeColor = isSuccess ? "#10b981" : "#f43f5e";
  const webAppUrl = ScriptApp.getService().getUrl();
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title></head>' +
    '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#f8fafc;font-family:system-ui,sans-serif;padding:20px;">' +
    '<div style="max-width:460px;width:100%;background:#0f172a;border:1px solid #1e293b;border-radius:24px;padding:32px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.6);">' +
    '<div style="width:56px;height:56px;border-radius:16px;background:' + badgeColor + '22;color:' + badgeColor + ';display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px;font-weight:bold;">' +
    (isSuccess ? "✓" : "!") +
    '</div>' +
    '<h1 style="font-size:20px;margin:0 0 12px;color:#ffffff;">' + title + '</h1>' +
    '<p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 24px;">' + message + '</p>' +
    '<a href="' + webAppUrl + '" style="display:inline-block;background:#10b981;color:#022c22;font-weight:bold;font-size:13px;padding:12px 24px;border-radius:12px;text-decoration:none;">Buka Halaman Utama Aplikasi</a>' +
    '</div></body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
`;

export const GAS_INDEX_HTML_CODE = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Portal Pendaftaran, Verifikasi Token 5 Menit & Login</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans">
  <!-- Header -->
  <header class="max-w-xl w-full mx-auto flex items-center justify-between border-b border-slate-800 pb-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold">
        FP
      </div>
      <div>
        <h1 class="text-base font-bold text-white">Portal Keamanan Akun</h1>
        <p class="text-xs text-slate-400">Google Sheets Database · SHA-256 OTP · 5-Min Expiry</p>
      </div>
    </div>
    <span class="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400">
      Maks 3 Token/Hari
    </span>
  </header>

  <!-- Main Card -->
  <main class="max-w-xl w-full mx-auto my-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
    <!-- 3 Tab Navigation -->
    <div class="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-semibold">
      <button id="tabBtn1" onclick="switchTab(1)" class="py-2.5 px-2 rounded-xl bg-emerald-500 text-slate-950 transition-all cursor-pointer">
        1. Daftar Akun Baru
      </button>
      <button id="tabBtn2" onclick="switchTab(2)" class="py-2.5 px-2 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer">
        2. Verifikasi & Token
      </button>
      <button id="tabBtn3" onclick="switchTab(3)" class="py-2.5 px-2 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer">
        3. Cek Status / Login
      </button>
    </div>

    <!-- Loading Indicator -->
    <div id="loadingBox" class="hidden p-4 rounded-2xl bg-sky-500/10 border border-sky-400/30 text-xs text-sky-300 flex items-center gap-3">
      <div class="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
      <span id="loadingText">Memproses permintaan ke Google Sheets...</span>
    </div>

    <!-- Notification Box (Success / Error without alert()) -->
    <div id="alertBox" class="hidden p-4 rounded-2xl text-xs leading-relaxed"></div>

    <!-- TAB 1: DAFTAR AKUN BARU -->
    <section id="tabContent1" class="space-y-4">
      <div>
        <h2 class="text-lg font-bold text-white">Daftar Akun Baru</h2>
        <p class="text-xs text-slate-400 mt-1">
          Data pendaftaran akan disimpan dengan status <b class="text-amber-300">PENDING</b> dan dikirim ke email Admin untuk disetujui.
        </p>
      </div>

      <form onsubmit="handleRegister(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">Nama Lengkap</label>
          <input id="regNama" type="text" required placeholder="Contoh: Rofiqi"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-400" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">Alamat Email (Unik)</label>
          <input id="regEmail" type="email" required placeholder="nama@email.com"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-400" />
        </div>
        <button type="submit"
          class="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide transition-all cursor-pointer">
          Daftar Sekarang & Minta Approval Admin
        </button>
      </form>
    </section>

    <!-- TAB 2: VERIFIKASI & MINTA TOKEN (5 MENIT & MAKS 3X/HARI) -->
    <section id="tabContent2" class="hidden space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-white">Verifikasi & Minta Token</h2>
          <p class="text-xs text-slate-400 mt-1">
            Masukkan 6 digit token yang dikirim ke email Anda setelah status disetujui (<b class="text-emerald-400">APPROVED</b>).
          </p>
        </div>
        <div class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right shrink-0">
          <span class="text-[10px] text-slate-400 block">TIMER 5 MENIT</span>
          <span id="countdownTimer" class="font-mono text-sm font-bold text-emerald-400">05:00</span>
        </div>
      </div>

      <form onsubmit="handleVerifyToken(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">Email Terdaftar</label>
          <input id="verEmail" type="email" required placeholder="nama@email.com"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-400" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">Kode Token 6 Digit</label>
          <input id="verToken" type="text" inputmode="numeric" maxlength="6" required placeholder="123456"
            class="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono text-xl tracking-[0.5em] text-emerald-400 focus:outline-none focus:border-emerald-400" />
        </div>

        <button type="submit"
          class="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide transition-all cursor-pointer">
          Verifikasi Sekarang
        </button>
      </form>

      <div class="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
        <span class="text-[11px] text-slate-400">Token kadaluarsa (lewat 5 menit)?</span>
        <button type="button" onclick="handleResendToken()"
          class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs transition-all cursor-pointer">
          Kirim Ulang Token (Maks 3x/Hari)
        </button>
      </div>
    </section>

    <!-- TAB 3: CEK STATUS / LOGIN + DASHBOARD TERVERIFIKASI -->
    <section id="tabContent3" class="hidden space-y-4">
      <div>
        <h2 class="text-lg font-bold text-white">Cek Status Akun / Login</h2>
        <p class="text-xs text-slate-400 mt-1">
          Akun dengan status <b class="text-emerald-400">VERIFIED</b> dapat langsung masuk ke halaman Dashboard.
        </p>
      </div>

      <form onsubmit="handleCheckStatusOrLogin(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">Alamat Email Anda</label>
          <input id="loginEmail" type="email" required placeholder="nama@email.com"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-400" />
        </div>
        <button type="submit"
          class="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide transition-all cursor-pointer">
          Cek Status / Masuk Dashboard
        </button>
      </form>

      <!-- Verified Dashboard Box -->
      <div id="dashboardBox" class="hidden p-5 rounded-2xl bg-emerald-500/10 border border-emerald-400/40 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-emerald-300">AKUN RESMI TERDAFTAR & AMAN</span>
          <span class="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-mono text-[10px] font-bold">VERIFIED</span>
        </div>
        <p id="dashUserText" class="text-sm font-semibold text-white"></p>
        <p class="text-xs text-slate-300">Selamat datang di Dashboard Utama. Token SHA-256 Anda telah dibersihkan (One-Time Use) sehingga akun Anda sepenuhnya aman.</p>
      </div>
    </section>
  </main>

  <footer class="max-w-xl w-full mx-auto text-center text-[11px] text-slate-500">
    Diamankan dengan SHA-256 Digest · Batas Waktu 5 Menit · Kuota 3 Token/Hari (Asia/Jakarta)
  </footer>

  <script>
    let countdownInterval = null;
    let remainingSecs = 300;

    function switchTab(tabNum) {
      [1, 2, 3].forEach(function (n) {
        document.getElementById("tabContent" + n).classList.toggle("hidden", n !== tabNum);
        const btn = document.getElementById("tabBtn" + n);
        if (n === tabNum) {
          btn.className = "py-2.5 px-2 rounded-xl bg-emerald-500 text-slate-950 transition-all cursor-pointer";
        } else {
          btn.className = "py-2.5 px-2 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer";
        }
      });
      hideAlert();
    }

    function setLoading(isLoading, text) {
      const box = document.getElementById("loadingBox");
      document.getElementById("loadingText").textContent = text || "Memproses...";
      box.classList.toggle("hidden", !isLoading);
    }

    function showAlert(message, isSuccess) {
      const box = document.getElementById("alertBox");
      box.classList.remove("hidden");
      if (isSuccess) {
        box.className = "p-4 rounded-2xl text-xs leading-relaxed bg-emerald-500/15 border border-emerald-400/40 text-emerald-200";
      } else {
        box.className = "p-4 rounded-2xl text-xs leading-relaxed bg-rose-500/15 border border-rose-400/40 text-rose-200";
      }
      box.textContent = message;
    }

    function hideAlert() {
      document.getElementById("alertBox").classList.add("hidden");
    }

    function startFiveMinuteCountdown(seconds) {
      remainingSecs = seconds || 300;
      if (countdownInterval) clearInterval(countdownInterval);
      const el = document.getElementById("countdownTimer");

      const tick = function () {
        if (remainingSecs <= 0) {
          el.textContent = "00:00 (HABIS)";
          el.className = "font-mono text-sm font-bold text-rose-400";
          clearInterval(countdownInterval);
          return;
        }
        const m = String(Math.floor(remainingSecs / 60)).padStart(2, "0");
        const s = String(remainingSecs % 60).padStart(2, "0");
        el.textContent = m + ":" + s;
        el.className = "font-mono text-sm font-bold text-emerald-400";
        remainingSecs--;
      };
      tick();
      countdownInterval = setInterval(tick, 1000);
    }

    function handleRegister(e) {
      e.preventDefault();
      hideAlert();
      const nama = document.getElementById("regNama").value.trim();
      const email = document.getElementById("regEmail").value.trim();

      setLoading(true, "Menyimpan pendaftaran & mengirim email ke Admin...");
      google.script.run
        .withSuccessHandler(function (res) {
          setLoading(false);
          showAlert(res.message, res.success);
          if (res.success) {
            document.getElementById("verEmail").value = email;
            document.getElementById("loginEmail").value = email;
          }
        })
        .withFailureHandler(function (err) {
          setLoading(false);
          showAlert("Gagal terhubung ke server: " + err.message, false);
        })
        .registerUser(nama, email);
    }

    function handleVerifyToken(e) {
      e.preventDefault();
      hideAlert();
      const email = document.getElementById("verEmail").value.trim();
      const token = document.getElementById("verToken").value.trim();

      setLoading(true, "Memvalidasi SHA-256 Token & batas waktu 5 menit...");
      google.script.run
        .withSuccessHandler(function (res) {
          setLoading(false);
          showAlert(res.message, res.success);
          if (res.success) {
            document.getElementById("loginEmail").value = email;
            switchTab(3);
            showAlert(res.message, true);
            if (res.user) {
              document.getElementById("dashboardBox").classList.remove("hidden");
              document.getElementById("dashUserText").textContent =
                res.user.nama + " (" + res.user.email + ")";
            }
          }
        })
        .withFailureHandler(function (err) {
          setLoading(false);
          showAlert("Gagal memverifikasi token: " + err.message, false);
        })
        .verifyUserToken(email, token);
    }

    function handleResendToken() {
      hideAlert();
      const email = document.getElementById("verEmail").value.trim();
      if (!email) {
        showAlert("Masukkan alamat Email Terdaftar terlebih dahulu sebelum meminta token baru.", false);
        return;
      }

      setLoading(true, "Mengecek kuota harian (Maks 3x/hari) & mengirim token baru...");
      google.script.run
        .withSuccessHandler(function (res) {
          setLoading(false);
          showAlert(res.message, res.success);
          if (res.success) {
            startFiveMinuteCountdown(300);
          }
        })
        .withFailureHandler(function (err) {
          setLoading(false);
          showAlert("Gagal meminta token: " + err.message, false);
        })
        .resendVerificationToken(email);
    }

    function handleCheckStatusOrLogin(e) {
      e.preventDefault();
      hideAlert();
      document.getElementById("dashboardBox").classList.add("hidden");
      const email = document.getElementById("loginEmail").value.trim();

      setLoading(true, "Memeriksa status akun di Google Sheets...");
      google.script.run
        .withSuccessHandler(function (res) {
          setLoading(false);
          showAlert(res.message, res.success && res.canLogin);
          if (res.success && res.canLogin && res.user) {
            document.getElementById("dashboardBox").classList.remove("hidden");
            document.getElementById("dashUserText").textContent =
              res.user.nama + " (" + res.user.email + ") — Kuota Token Hari Ini: " + res.user.dailyCount + "/3";
          }
        })
        .withFailureHandler(function (err) {
          setLoading(false);
          showAlert("Gagal memeriksa status: " + err.message, false);
        })
        .checkUserStatusOrLogin(email);
    }
  </script>
</body>
</html>`;

export const KOTLIN_CLEAN_ARCH_CODE = `// ============================================================================
// AURELIA FINPLANNER — KOTLIN ANDROID CLEAN ARCHITECTURE + ROOM + WORKMANAGER
// ============================================================================
// Stack: Kotlin 2.0, Jetpack Compose, Room Database (SQLite), WorkManager,
//        OkHttp WebSocket (Real-Time UI Sync), AndroidKeyStore AES-256-GCM.
// ============================================================================

package id.aurelia.finplanner.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.util.Base64

// 1. ROOM ENTITIES (Offline-First Local Persistence)
@Entity(tableName = "monthly_periods")
data class MonthlyPeriodEntity(
    @PrimaryKey val periodId: String,          // Contoh: "2026-10", "2026-11"
    val monthLabel: String,                    // Contoh: "Oktober 2026"
    val openingBalanceCarryOver: Long,         // Akumulasi otomatis dari bulan lalu
    val openingBalanceManualOverride: Long?,   // Nilai revisi manual jika diedit
    val openingBalanceRevisionNote: String,
    val encryptedSnapshotJson: String,         // Dienkripsi dengan AES-256-GCM
    val updatedAt: Long
)

@Entity(tableName = "sync_queue")
data class SyncQueueEntity(
    @PrimaryKey val queueId: String,
    val periodId: String,
    val monthLabel: String,
    val operation: String,
    val summary: String,
    val payloadJson: String,
    val checksumSha256: String,
    val timestamp: Long,
    val isSynced: Boolean = false
)

// 2. ROOM DAO (Query Cepat & Reactive Flow)
@Dao
interface FinanceDao {
    @Query("SELECT * FROM monthly_periods ORDER BY periodId ASC")
    fun observeAllPeriods(): Flow<List<MonthlyPeriodEntity>>

    @Upsert
    suspend fun upsertPeriod(period: MonthlyPeriodEntity)

    @Query("SELECT * FROM sync_queue WHERE isSynced = 0 ORDER BY timestamp ASC")
    fun observePendingSyncQueue(): Flow<List<SyncQueueEntity>>

    @Query("SELECT * FROM sync_queue WHERE isSynced = 0 ORDER BY timestamp ASC")
    suspend fun getPendingSyncItems(): List<SyncQueueEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueueSyncOperation(item: SyncQueueEntity)

    @Query("UPDATE sync_queue SET isSynced = 1 WHERE queueId IN (:ids)")
    suspend fun markQueueItemsSynced(ids: List<String>)
}

// 3. AES-256-GCM SECURITY ENCRYPTION HELPER
object Aes256SecurityManager {
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_LENGTH = 128

    fun encryptPayload(plainText: String, secretKey: SecretKey): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)
        val iv = cipher.iv
        val encrypted = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        val combined = iv + encrypted
        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    fun decryptPayload(cipherTextBase64: String, secretKey: SecretKey): String {
        val raw = Base64.decode(cipherTextBase64, Base64.NO_WRAP)
        val iv = raw.copyOfRange(0, 12)
        val cipherBytes = raw.copyOfRange(12, raw.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(GCM_TAG_LENGTH, iv))
        return String(cipher.doFinal(cipherBytes), Charsets.UTF_8)
    }
}
`;

export const SWAGGER_OPENAPI_SPEC = `openapi: 3.0.3
info:
  title: Aurelia FinPlanner — Users Sheet Auth & Two-Way Sync API
  version: 2.5.0
  description: >
    Spesifikasi REST API untuk Pendaftaran (PENDING), Persetujuan Admin (APPROVED),
    Verifikasi Token 5 Menit SHA-256 (VERIFIED, Maks 3x/Hari Asia/Jakarta), dan Sinkronisasi Google Sheets.
servers:
  - url: https://script.google.com/macros/s/{deploymentId}/exec
    description: Google Apps Script Production Web App
`;
