export type SupportedLocale = 'id' | 'en' | 'ar';

export interface NotificationPreferences {
  pushEnabled: boolean;
  soundEnabled: boolean;
  budgetThresholdAlert: boolean;
  security2FAAlert: boolean;
  cloudSyncAlert: boolean;
  userApprovalAlert: boolean;
  overBudgetWarningPercent: number;
}

export interface RealtimePushNotification {
  id: string;
  timestamp: string;
  actor: string;
  category: 'SECURITY_2FA' | 'BUDGET_MUTATION' | 'CLOUD_SYNC' | 'API_GATEWAY' | 'USER_APPROVAL';
  title: string;
  description: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  read: boolean;
}

export const TRANSLATIONS: Record<
  SupportedLocale,
  {
    brandTitle: string;
    navDashboard: string;
    navBudget: string;
    navTracker: string;
    navAccounts: string;
    navAdminHub: string;
    syncNow: string;
    syncing: string;
    onlineSynced: string;
    offlinePending: string;
    themeDark: string;
    themeLight: string;
    langLabel: string;
    notificationsTitle: string;
    twoFactorBadge: string;
    cloudSyncStatus: string;
    newMonthBtn: string;
    closingBalanceLabel: string;
    openingBalanceLabel: string;
    monthlyIncomeLabel: string;
    monthlyExpenseLabel: string;
    monthlySavingLabel: string;
    dailyTrackerLabel: string;
    recordDailyBtn: string;
    reviseBalanceBtn: string;
  }
> = {
  id: {
    brandTitle: 'FinPay Pro by mrofiqi.id',
    navDashboard: 'Dashboard',
    navBudget: 'Anggaran Bulanan',
    navTracker: 'Tracker Harian',
    navAccounts: 'Rekening & Cloud',
    navAdminHub: 'Admin, 2FA & API',
    syncNow: 'Sync Sekarang',
    syncing: 'Menyinkronkan...',
    onlineSynced: 'Online · Tersinkronisasi ke Cloud & Google Sheets',
    offlinePending: 'Mode Offline — Tersimpan di Perangkat',
    themeDark: 'Mode Gelap',
    themeLight: 'Mode Terang',
    langLabel: 'Bahasa',
    notificationsTitle: 'Notifikasi Real-Time',
    twoFactorBadge: '2FA Aktif',
    cloudSyncStatus: 'Sinkronisasi Cloud Lintas Perangkat',
    newMonthBtn: '+ Buat Bulan Baru',
    closingBalanceLabel: 'Sisa Uang Bulan Ini · Saldo Akhir',
    openingBalanceLabel: 'Saldo Awal / Akumulasi Bulan Lalu',
    monthlyIncomeLabel: 'Pendapatan Bulanan',
    monthlyExpenseLabel: 'Total Pengeluaran Bulan Ini',
    monthlySavingLabel: 'Uang Ditabung Bulan Ini',
    dailyTrackerLabel: 'Tracker Harian & Nongkrong',
    recordDailyBtn: 'Catat Transaksi Harian',
    reviseBalanceBtn: 'Edit / Revisi Saldo',
  },
  en: {
    brandTitle: 'FinPay Pro by mrofiqi.id',
    navDashboard: 'Dashboard',
    navBudget: 'Monthly Budget',
    navTracker: 'Daily Tracker',
    navAccounts: 'Accounts & Cloud',
    navAdminHub: 'Admin, 2FA & API',
    syncNow: 'Sync Now',
    syncing: 'Syncing...',
    onlineSynced: 'Online · Synced to Cloud & Google Sheets',
    offlinePending: 'Offline Mode — Queued Locally',
    themeDark: 'Dark Mode',
    themeLight: 'Light Mode',
    langLabel: 'Language',
    notificationsTitle: 'Real-Time Notifications',
    twoFactorBadge: '2FA Active',
    cloudSyncStatus: 'Cross-Device Cloud Sync',
    newMonthBtn: '+ New Month Sheet',
    closingBalanceLabel: 'Remaining Cash · Closing Balance',
    openingBalanceLabel: 'Opening Balance / Carry-Over',
    monthlyIncomeLabel: 'Monthly Income',
    monthlyExpenseLabel: 'Total Monthly Expenses',
    monthlySavingLabel: 'Monthly Future Savings',
    dailyTrackerLabel: 'Daily & Hangout Tracker',
    recordDailyBtn: 'Log Daily Expense',
    reviseBalanceBtn: 'Revise Balance',
  },
  ar: {
    brandTitle: 'FinPay Pro by mrofiqi.id',
    navDashboard: 'لوحة القيادة',
    navBudget: 'الميزانية الشهرية',
    navTracker: 'المتتبع اليومي',
    navAccounts: 'الحسابات والسحابة',
    navAdminHub: 'الإدارة و 2FA و API',
    syncNow: 'مزامنة الآن',
    syncing: 'جاري المزامنة...',
    onlineSynced: 'متصل · تمت المزامنة مع السحابة',
    offlinePending: 'وضع عدم الاتصال — محفوظ محلياً',
    themeDark: 'الوضع الداكن',
    themeLight: 'الوضع الفاتح',
    langLabel: 'اللغة',
    notificationsTitle: 'إشعارات فورية',
    twoFactorBadge: '2FA مفعل',
    cloudSyncStatus: 'مزامنة سحابية عبر الأجهزة',
    newMonthBtn: '+ شهر جديد',
    closingBalanceLabel: 'الرصيد المتبقي · الرصيد الختامي',
    openingBalanceLabel: 'الرصيد الافتتاحي المرحل',
    monthlyIncomeLabel: 'الدخل الشهري',
    monthlyExpenseLabel: 'إجمالي المصروفات الشهرية',
    monthlySavingLabel: 'مدخرات المستقبل الشهرية',
    dailyTrackerLabel: 'متتبع المصاريف اليومية',
    recordDailyBtn: 'تسجيل مصروف يومي',
    reviseBalanceBtn: 'تعديل الرصيد',
  },
};

export interface FileComponentArchitectureDoc {
  id: string;
  filePath: string;
  layer: 'CORE_APP' | 'UI_COMPONENT' | 'PURE_LOGIC' | 'DATABASE_SEED' | 'BACKEND_API';
  title: string;
  summary: string;
  keyFunctions: string[];
  connectedDatabase: string;
}

export const CODEBASE_ARCHITECTURE_DOCS: FileComponentArchitectureDoc[] = [
  {
    id: 'doc-server',
    filePath: '/server.ts',
    layer: 'BACKEND_API',
    title: 'Full-Stack Express + SSE Real-Time Cloud Vault Server',
    summary:
      'Menyediakan endpoint REST API (/api/vault, /api/sync, /api/notifications/broadcast, /api/third-party/rates, /api/admin/users-sheet) dan saluran Server-Sent Events (/api/events) untuk notifikasi push real-time serta sinkronisasi data cloud lintas perangkat ke .data/finplanner-cloud-vault.json.',
    keyFunctions: [
      'GET /api/events (SSE Real-Time Stream)',
      'GET /api/vault (Database & CSV Schema Inspector)',
      'POST /api/sync (2-Way Cloud & Google Sheets Sync)',
      'GET /api/third-party/rates (Live Forex, Gold & Crypto Oracle)',
    ],
    connectedDatabase: '.data/finplanner-cloud-vault.json + FINANCIAL_PLANNER_4b47ce17.csv + DATA_UPROVE_LOG_IN',
  },
  {
    id: 'doc-app',
    filePath: '/src/App.tsx',
    layer: 'CORE_APP',
    title: 'Root Application Controller, Multi-Language, Theme & Offline-First Sync Engine',
    summary:
      'Mengatur state utama seluruh periode anggaran (Oktober & November 2026+), antrean sinkronisasi offline (SyncQueue), koneksi SSE real-time, mode gelap/terang (Dark/Light Mode), serta dukungan multi-bahasa (ID/EN/AR).',
    keyFunctions: [
      'mutateActivePeriod() — Mutasi state atomik + auto-rollover kas antar-bulan',
      'executeCloudSync() — Sinkronisasi latar belakang ke Cloud Vault & Google Apps Script',
      'pushRealtimeNotification() — Engine notifikasi push real-time dengan filter preferensi pengguna',
    ],
    connectedDatabase: 'LocalStorage Offline-First + /api/sync Cloud Vault',
  },
  {
    id: 'doc-dashboard',
    filePath: '/src/components/DashboardView.tsx',
    layer: 'UI_COMPONENT',
    title: 'Executive Wealth & Interactive Analytics Dashboard',
    summary:
      'Menampilkan indikator Sisa Uang Bulan Ini, Saldo Awal Rollover, 4 KPI utama, grafik batang ganda Rencana vs Aktual, grafik cincin (Donut Chart) interaktif, serta kurva gelombang tren pengeluaran harian.',
    keyFunctions: [
      'Bar Chart Rencana vs Aktual (Fixed, Sub/Debt, Variable, Saving)',
      'Interactive SVG Donut Chart (Pengeluaran, Pendapatan, Tabungan)',
      'Daily Expense Area Spline & Interactive Bar Trend',
    ],
    connectedDatabase: 'FINANCIAL_PLANNER_4b47ce17.csv (Baris 10–57)',
  },
  {
    id: 'doc-budget',
    filePath: '/src/components/MonthlyBudgetView.tsx',
    layer: 'UI_COMPONENT',
    title: '6-Pos Monthly Budget & Spreadsheet Reconciliation Manager',
    summary:
      'Mengelola 6 bagian utama dari lembar kerja FINANCIAL_PLANNER.csv: (1) Fixed Cost Operasional Rumah, (2) Biaya Langganan & Hutang, (3) Pengeluaran Tidak Tetap/Variable Cost, (4) Pendapatan Bulanan, (5) Tabungan Masa Depan, dan (6) Catatan Kewajiban Khusus (Kas Masjid & PLN).',
    keyFunctions: [
      'Inline Edit Rencana & Aktual per item anggaran',
      'Toggle Status Lunas (✅) vs Belum/Aktif (⭕)',
      'Auto-link Variable Cost dengan Tracker Harian & Nongkrong',
    ],
    connectedDatabase: 'FINANCIAL_PLANNER_4b47ce17.csv (Baris 28–57 & 140–141)',
  },
  {
    id: 'doc-tracker',
    filePath: '/src/components/DailyTrackerView.tsx',
    layer: 'UI_COMPONENT',
    title: 'Daily Expense & Hangout/Lifestyle Tracker',
    summary:
      'Mencatat transaksi pengeluaran sehari-hari dengan perkalian otomatis (Qty × Harga Satuan) serta tracker Jajan & Nongkrong. Dilengkapi filter metode pembayaran (BRI, BSI, BCA, COD, TF, GOPAY, DANA) dan pengelompokan otomatis Jajan De Aira + Nabung.',
    keyFunctions: [
      'Auto-compute Qty × Harga Satuan',
      'Rekap otomatis Total COD (Rp 470.000) & Total TF (Rp 300.000)',
      'Filter & Pencarian instan lintas tanggal dan metode bayar',
    ],
    connectedDatabase: 'FINANCIAL_PLANNER_4b47ce17.csv (Baris 69–130)',
  },
  {
    id: 'doc-accounts',
    filePath: '/src/components/AccountsAndSyncView.tsx',
    layer: 'UI_COMPONENT',
    title: 'Multi-Bank Liquidity, Offline Sync Queue & Blueprint Code Center',
    summary:
      'Mengelola rekonsiliasi saldo riil 5 akun (Bank BSI Aira, Bank BRI Ops, Bank BCA Bulanan, GoPay, DANA), menampilkan antrean sinkronisasi lokal berenkripsi AES-256-GCM + checksum SHA-256, serta menyediakan cetak biru kode Google Apps Script (Code.gs), Kotlin Android, dan OpenAPI.',
    keyFunctions: [
      'Rekonsiliasi Saldo Rekening Manual & Audit Trail',
      'Simulasi Tanpa Sinyal (Offline Mode) & Auto-Sync Reconnect',
      'Ekspor Laporan CSV & Cetak PDF',
    ],
    connectedDatabase: 'FINANCIAL_PLANNER_4b47ce17.csv (Baris 55–57) + SyncQueue',
  },
  {
    id: 'doc-authgate',
    filePath: '/src/components/AuthGate.tsx',
    layer: 'UI_COMPONENT',
    title: '7-Column Users Sheet Auth Gate & SHA-256 5-Minute OTP Verification',
    summary:
      'Mengimplementasikan alur pendaftaran dan autentikasi ketat sesuai file lampiran DATA_UPROVE_LOG_IN (7 kolom: Email, Nama, Status_Akun, Token_Hash, Token_Expires_At, Daily_Token_Count, Last_Request_Date) dengan persetujuan Superuser (itptgaramofficial@gmail.com).',
    keyFunctions: [
      'Pendaftaran Status PENDING -> Persetujuan Admin APPROVED -> Validasi OTP VERIFIED',
      'Timer hitung mundur 5 menit (300 detik) & One-Time Use Token Hash',
      'Pembatasan kuota keamanan maksimal 3 token per hari (Asia/Jakarta)',
    ],
    connectedDatabase: 'DATA_UPROVE_LOG_IN_fc7777fd (Sheet Users 7 Kolom)',
  },
  {
    id: 'doc-adminhub',
    filePath: '/src/components/AdminEnterpriseHubView.tsx',
    layer: 'UI_COMPONENT',
    title: 'Admin Comprehensive Analytics, 2FA Security Center, Third-Party API & Architecture Docs',
    summary:
      'Pusat kendali eksekutif untuk memantau aktivitas pengguna secara langsung, mengatur Autentikasi Dua Faktor (2FA TOTP + Kode Pemulihan), mengonfigurasi notifikasi push real-time, menguji integrasi API pihak ketiga (Kurs Mata Uang/Emas/Crypto, Webhook Google Sheets/WhatsApp/Telegram), serta membaca dokumentasi arsitektur kode.',
    keyFunctions: [
      'Live Admin Activity Stream & Database Schema Inspector',
      '2FA TOTP Authenticator Generator & Verification Gate',
      'Real-Time Push Notification Customizer & Broadcast Tester',
      'Live Third-Party Currency/Gold/Crypto Converter & Webhook Gateway',
    ],
    connectedDatabase: 'Full-Stack Cloud Vault + External APIs',
  },
  {
    id: 'doc-calculations',
    filePath: '/src/utils/calculations.ts & /src/utils/auth.ts',
    layer: 'PURE_LOGIC',
    title: 'Pure Financial Math, Hash Cryptography & Unit-Tested Business Rules',
    summary:
      'Modul fungsi murni (pure functions) yang terpisah dari UI untuk menghitung rekapitulasi anggaran, rollover saldo antar-bulan, hashing SHA-256 deterministik, enkripsi payload pratinjau AES-256-GCM, serta validasi kuota 3 token harian. Diuji secara ketat menggunakan node:test.',
    keyFunctions: [
      'calculatePeriodSummary() — Perhitungan 100% akurat sesuai CSV',
      'createRolloverMonth() — Duplikasi struktur anggaran ke bulan baru',
      'approveRegistrationBySuperuser() & verifyApprovedOtpAndActivate()',
    ],
    connectedDatabase: 'Unit Tested via src/utils/calculations.test.ts',
  },
];
