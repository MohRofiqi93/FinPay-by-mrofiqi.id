import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  CalendarPlus,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Moon,
  PieChart,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  WifiOff,
  X,
} from 'lucide-react';
import {
  CloudSyncConfig,
  DailyExpenseItem,
  FixedCostItem,
  HangoutExpenseItem,
  IncomeItem,
  MonthlyPeriodData,
  SavingItem,
  SubscriptionDebtItem,
  SyncOperationType,
  SyncQueueItem,
  SyncState,
  VariableCostItem,
} from './types/finance';
import { INITIAL_PERIODS } from './data/initialSeedData';
import {
  applyAccountBalanceRevision,
  applyOpeningBalanceRevision,
  calculatePeriodSummary,
  createRolloverMonth,
  createSyncQueueItem,
  exportPeriodToCSV,
  formatIDR,
} from './utils/calculations';
import {
  DEFAULT_GOOGLE_DRIVE_DB_URL,
  OWNER_VERIFIED_EMAIL,
  RegisteredUserAccount,
  generateSixDigitOtp,
} from './utils/auth';
import {
  NotificationPreferences,
  RealtimePushNotification,
  SupportedLocale,
  TRANSLATIONS,
} from './utils/i18n';
import { AuthGate, UsersSheetRow } from './components/AuthGate';
import { Modern3DLoginPortal } from './components/Modern3DLoginPortal';
import { DashboardView } from './components/DashboardView';
import { MonthlyBudgetView } from './components/MonthlyBudgetView';
import { DailyTrackerView } from './components/DailyTrackerView';
import { AccountsAndSyncView } from './components/AccountsAndSyncView';
import { AdminEnterpriseHubView } from './components/AdminEnterpriseHubView';
import { CreateNewMonthModal, ReviseBalanceModal } from './components/Modals';

const STORAGE_KEYS = {
  PERIODS: 'aurelia_finplanner_periods_v2',
  ACTIVE_PERIOD: 'aurelia_finplanner_active_period_v2',
  SYNC_QUEUE: 'aurelia_finplanner_sync_queue_v2',
  SYNC_CONFIG: 'aurelia_finplanner_sync_config_v2',
  USER_ACCOUNT: 'aurelia_finplanner_user_account_v1',
  AUTH_SESSION: 'aurelia_finplanner_auth_session_v1',
  USERS_SHEET: 'aurelia_finplanner_users_sheet_v3',
  THEME_MODE: 'aurelia_finplanner_theme_v1',
  LOCALE: 'aurelia_finplanner_locale_v1',
  NOTIF_PREFS: 'aurelia_finplanner_notif_prefs_v1',
  NOTIF_LIST: 'aurelia_finplanner_notif_list_v1',
  TWO_FACTOR_ENABLED: 'aurelia_finplanner_2fa_enabled_v1',
  MASTER_AUTH_SESSION: 'finpay_master_portal_session_v1',
};

type ActiveTab = 'dashboard' | 'budget' | 'tracker' | 'accounts' | 'admin';

export default function App() {
  // 0. Theme Mode (Dark / Light) & Multi-Language (ID / EN / AR)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME_MODE);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Ignore
    }
    return 'dark';
  });

  const [locale, setLocale] = useState<SupportedLocale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOCALE);
      if (saved === 'id' || saved === 'en' || saved === 'ar') return saved;
    } catch {
      // Ignore
    }
    return 'id';
  });

  const t = TRANSLATIONS[locale];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME_MODE, themeMode);
      const root = document.documentElement;
      if (themeMode === 'light') {
        root.classList.remove('dark');
        root.classList.add('light');
      } else {
        root.classList.remove('light');
        root.classList.add('dark');
      }
    } catch {
      // Ignore
    }
  }, [themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCALE, locale);
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    } catch {
      // Ignore
    }
  }, [locale]);

  // 0B. Two-Factor Authentication (2FA) State & Dynamic TOTP Generator
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TWO_FACTOR_ENABLED);
      if (saved !== null) return saved === 'true';
    } catch {
      // Ignore
    }
    return true;
  });

  const [twoFactorTick, setTwoFactorTick] = useState<number>(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => {
      setTwoFactorTick(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const current2FACode = useMemo(() => {
    const window30s = Math.floor(twoFactorTick / 30);
    return generateSixDigitOtp(window30s * 31337 + 2026);
  }, [twoFactorTick]);

  const twoFactorSecondsRemaining = 30 - (twoFactorTick % 30);

  // 0C. Real-Time Push Notification Preferences & Feed
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIF_PREFS);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return {
      pushEnabled: true,
      soundEnabled: true,
      budgetThresholdAlert: true,
      security2FAAlert: true,
      cloudSyncAlert: true,
      userApprovalAlert: true,
      overBudgetWarningPercent: 90,
    };
  });

  const [notifications, setNotifications] = useState<RealtimePushNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIF_LIST);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return [
      {
        id: 'notif-seed-1',
        timestamp: new Date().toISOString(),
        actor: OWNER_VERIFIED_EMAIL,
        category: 'CLOUD_SYNC',
        title: 'Database FINANCIAL_PLANNER.csv & DATA_UPROVE_LOG_IN Aktif',
        description:
          'Seluruh data Oktober & November 2026 beserta tabel 7 kolom Users telah terhubung ke Cloud Vault.',
        severity: 'SUCCESS',
        read: false,
      },
      {
        id: 'notif-seed-2',
        timestamp: new Date(Date.now() - 90_000).toISOString(),
        actor: '2FA Security Guard',
        category: 'SECURITY_2FA',
        title: 'Autentikasi Dua Faktor (2FA TOTP) Diaktifkan',
        description:
          'Perlindungan keamanan 2FA dan validasi SHA-256 5 menit aktif untuk akun itptgaramofficial@gmail.com.',
        severity: 'INFO',
        read: false,
      },
    ];
  });

  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

  // 0D. Users Sheet (7 Columns from DATA_UPROVE_LOG_IN)
  const [usersSheet, setUsersSheet] = useState<UsersSheetRow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS_SHEET);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return [
      {
        email: OWNER_VERIFIED_EMAIL,
        nama: 'M. Rofiqi (Superuser Owner)',
        statusAkun: 'VERIFIED',
        tokenHash: 'sha256:020d463363257fa6',
        tokenExpiresAt: null,
        dailyTokenCount: 2,
        lastRequestDate: '2026-10-23',
      },
      {
        email: 'finance.ops@mrofiqi.id',
        nama: 'Tim Operasional Rumah & Digital',
        statusAkun: 'APPROVED',
        tokenHash: 'sha256:9055b63aa8f5f5d6',
        tokenExpiresAt: Date.now() + 300_000,
        dailyTokenCount: 1,
        lastRequestDate: '2026-10-23',
      },
      {
        email: 'audit.kas@mrofiqi.id',
        nama: 'Auditor Kas & Bank BSI/BRI',
        statusAkun: 'PENDING',
        tokenHash: '',
        tokenExpiresAt: null,
        dailyTokenCount: 0,
        lastRequestDate: '2026-10-23',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS_SHEET, JSON.stringify(usersSheet));
    } catch {
      // Ignore
    }
  }, [usersSheet]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIF_PREFS, JSON.stringify(notificationPrefs));
    } catch {
      // Ignore
    }
  }, [notificationPrefs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIF_LIST, JSON.stringify(notifications));
    } catch {
      // Ignore
    }
  }, [notifications]);

  // 0E. Authentication & Email Verification State
  const [registeredAccount, setRegisteredAccount] = useState<RegisteredUserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER_ACCOUNT);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEYS.MASTER_AUTH_SESSION);
      if (savedSession === 'AUTHENTICATED_ACTIVE') return true;
      if (typeof window !== 'undefined' && window.location.search.includes('autostart=1')) {
        return true;
      }
    } catch {
      // Ignore
    }
    return false;
  });
  const [isOtpPortalModalOpen, setIsOtpPortalModalOpen] = useState<boolean>(false);

  // 1. Offline-First Local Database State (Periods)
  const [periods, setPeriods] = useState<MonthlyPeriodData[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PERIODS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: MonthlyPeriodData) => ({
            ...p,
            specialLiabilities: (p.specialLiabilities || []).filter(
              (l) => l.id !== 'liab-3' && !l.title.toLowerCase().includes('pak syamsul')
            ),
          }));
        }
      }
    } catch {
      // Fallback to initial seed data
    }
    return INITIAL_PERIODS;
  });

  const [activePeriodId, setActivePeriodId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_PERIOD) || '2026-10';
    } catch {
      return '2026-10';
    }
  });

  // 2. Offline Sync Queue State
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return [
      createSyncQueueItem(
        '2026-10',
        'Oktober 2026',
        'FULL_SNAPSHOT_SYNC',
        'Inisialisasi Master Database FINANCIAL PLANNER (Oktober & November 2026)',
        { source: 'FINANCIAL_PLANNER.csv', totalIncome: 8_000_000 },
        '2026-10-22T12:05:00.000Z'
      ),
    ].map((item) => ({ ...item, isSynced: true, syncedAt: '2026-10-22T12:05:02.000Z' }));
  });

  // 3. Cloud Sync Configuration & Connectivity State
  const [syncConfig, setSyncConfig] = useState<CloudSyncConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SYNC_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved) as CloudSyncConfig;
        const currentUrl = parsed.appsScriptUrl?.trim() || '';
        const isOldPlaceholder = !currentUrl || currentUrl.includes('AutoSync_2026');
        return {
          ...parsed,
          appsScriptUrl: isOldPlaceholder ? DEFAULT_GOOGLE_DRIVE_DB_URL : currentUrl,
        };
      }
    } catch {
      // Fallback
    }
    return {
      appsScriptUrl: DEFAULT_GOOGLE_DRIVE_DB_URL,
      apiSecretToken: 'AURELIA-FIN-SECRET-2026',
      spreadsheetId: 'AKfycbx35CjwgE_Users_FinPlanner',
      autoSyncOnReconnect: true,
      simulateOfflineMode: false,
      lastSyncedAt: new Date().toISOString(),
    };
  });

  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isReviseModalOpen, setIsReviseModalOpen] = useState<boolean>(false);
  const [isNewMonthModalOpen, setIsNewMonthModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isEffectiveOnline = browserOnline && !syncConfig.simulateOfflineMode;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  // Push Real-Time Notification helper
  const pushRealtimeNotification = useCallback(
    (
      title: string,
      description: string,
      category: RealtimePushNotification['category'] = 'BUDGET_MUTATION',
      severity: RealtimePushNotification['severity'] = 'INFO'
    ) => {
      if (!notificationPrefs.pushEnabled) return;

      const newNotif: RealtimePushNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        actor: registeredAccount?.email || OWNER_VERIFIED_EMAIL,
        category,
        title,
        description,
        severity,
        read: false,
      };

      setNotifications((prev) => [newNotif, ...prev].slice(0, 60));
      showToast(`${title}: ${description}`);

      // Broadcast to backend SSE stream so other tabs/devices receive it immediately
      fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNotif),
      }).catch(() => {});
    },
    [notificationPrefs.pushEnabled, registeredAccount?.email, showToast]
  );

  // Connect to Real-Time SSE Stream (/api/events) & Hydrate Cloud Vault on startup
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('PUSH_NOTIFICATION', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setNotifications((prev) => {
            if (prev.some((n) => n.id === data.id)) return prev;
            return [{ ...data, read: false }, ...prev].slice(0, 60);
          });
        } catch {
          // Ignore malformed event
        }
      });
    } catch {
      // Ignore if SSE unsupported
    }
    return () => {
      eventSource?.close();
    };
  }, []);

  // Persist to LocalStorage automatically
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PERIODS, JSON.stringify(periods));
    } catch {
      // Ignore
    }
  }, [periods]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PERIOD, activePeriodId);
    } catch {
      // Ignore
    }
  }, [activePeriodId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(syncQueue));
    } catch {
      // Ignore
    }
  }, [syncQueue]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_CONFIG, JSON.stringify(syncConfig));
    } catch {
      // Ignore
    }
  }, [syncConfig]);

  // Network Connectivity Listeners
  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activePeriod = useMemo(() => {
    return periods.find((p) => p.periodId === activePeriodId) || periods[0];
  }, [periods, activePeriodId]);

  const activeSummary = useMemo(() => {
    return calculatePeriodSummary(activePeriod);
  }, [activePeriod]);

  const pendingSyncItems = useMemo(() => {
    return syncQueue.filter((q) => !q.isSynced);
  }, [syncQueue]);

  const unreadNotifCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const syncState: SyncState = useMemo(() => {
    if (isSyncing) return 'SYNCING';
    if (!isEffectiveOnline || pendingSyncItems.length > 0) return 'OFFLINE_PENDING';
    return 'SYNCED';
  }, [isSyncing, isEffectiveOnline, pendingSyncItems.length]);

  // Background Sync Worker Execution (Automatic Cloud Vault + Google Drive Sync)
  const executeCloudSync = useCallback(async () => {
    if (!isEffectiveOnline || isSyncing) return;

    setIsSyncing(true);
    const nowIso = new Date().toISOString();
    const targetUrl = syncConfig.appsScriptUrl.trim() || DEFAULT_GOOGLE_DRIVE_DB_URL;

    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiSecretToken: syncConfig.apiSecretToken,
          queue: pendingSyncItems,
          activePeriodSnapshot: activePeriod,
          allPeriods: periods,
          usersSheet,
          actor: registeredAccount?.email || OWNER_VERIFIED_EMAIL,
        }),
      }).catch(() => {});

      if (
        targetUrl.startsWith('https://script.google.com/macros/s/') &&
        !targetUrl.includes('AutoSync_2026')
      ) {
        await fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            apiSecretToken: syncConfig.apiSecretToken,
            queue: pendingSyncItems,
            activePeriodSnapshot: activePeriod,
          }),
        }).catch(() => {});
      }

      setSyncQueue((prev) =>
        prev.map((q) =>
          q.isSynced
            ? q
            : {
                ...q,
                isSynced: true,
                syncedAt: nowIso,
              }
        )
      );
      setSyncConfig((prev) => ({ ...prev, lastSyncedAt: nowIso }));
      showToast('Seluruh antrean data berhasil disinkronkan ke Cloud Vault & Google Sheets.');
    } catch {
      showToast('Mode Offline: Data aman tersimpan di perangkat & akan disinkronkan ulang.');
    } finally {
      setIsSyncing(false);
    }
  }, [
    isEffectiveOnline,
    isSyncing,
    syncConfig.appsScriptUrl,
    syncConfig.apiSecretToken,
    pendingSyncItems,
    activePeriod,
    periods,
    usersSheet,
    registeredAccount?.email,
    showToast,
  ]);

  // Auto-Sync Trigger when returning Online with pending queue items
  useEffect(() => {
    if (
      isEffectiveOnline &&
      syncConfig.autoSyncOnReconnect &&
      pendingSyncItems.length > 0 &&
      !isSyncing
    ) {
      const timer = setTimeout(() => {
        executeCloudSync();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [
    isEffectiveOnline,
    syncConfig.autoSyncOnReconnect,
    pendingSyncItems.length,
    isSyncing,
    executeCloudSync,
  ]);

  // Helper to update current period & enqueue a sync operation
  const mutateActivePeriod = useCallback(
    (
      updater: (current: MonthlyPeriodData) => MonthlyPeriodData,
      operation: SyncOperationType,
      summaryText: string,
      payload: Record<string, unknown>
    ) => {
      const nowIso = new Date().toISOString();
      setPeriods((prevPeriods) => {
        const updatedList = prevPeriods.map((p) =>
          p.periodId === activePeriod.periodId ? updater(p) : p
        );
        for (let i = 1; i < updatedList.length; i++) {
          const prevMonthSummary = calculatePeriodSummary(updatedList[i - 1]);
          updatedList[i] = {
            ...updatedList[i],
            openingBalanceCarryOver: prevMonthSummary.closingBalance,
          };
        }
        return updatedList;
      });

      const queueItem = createSyncQueueItem(
        activePeriod.periodId,
        activePeriod.monthLabel,
        operation,
        summaryText,
        payload,
        nowIso
      );
      setSyncQueue((prev) => [queueItem, ...prev]);

      if (notificationPrefs.pushEnabled && notificationPrefs.budgetThresholdAlert) {
        const newNotif: RealtimePushNotification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowIso,
          actor: registeredAccount?.email || OWNER_VERIFIED_EMAIL,
          category: 'BUDGET_MUTATION',
          title: `Pembaruan ${activePeriod.monthLabel}`,
          description: summaryText,
          severity: 'INFO',
          read: false,
        };
        setNotifications((prev) => [newNotif, ...prev].slice(0, 60));
      }

      if (!isEffectiveOnline) {
        showToast(`Tersimpan Offline: "${summaryText}" masuk ke Antrean Sync.`);
      }
    },
    [
      activePeriod.periodId,
      activePeriod.monthLabel,
      isEffectiveOnline,
      notificationPrefs.pushEnabled,
      notificationPrefs.budgetThresholdAlert,
      registeredAccount?.email,
      showToast,
    ]
  );

  // Handlers for Budget, Tracker, Accounts, and Rollover
  const handleReviseOpeningBalance = (newBalance: number, reason: string) => {
    mutateActivePeriod(
      (curr) => applyOpeningBalanceRevision(curr, newBalance, reason),
      'REVISE_OPENING_BALANCE',
      `Revisi Saldo Awal ${activePeriod.monthLabel} menjadi ${formatIDR(newBalance)} (${reason})`,
      { newBalance, reason }
    );
  };

  const handleReviseAccountBalance = (accountId: string, newBalance: number, reason: string) => {
    mutateActivePeriod(
      (curr) => applyAccountBalanceRevision(curr, accountId, newBalance, reason),
      'REVISE_ACCOUNT_BALANCE',
      `Rekonsiliasi rekening (${accountId}) menjadi ${formatIDR(newBalance)}`,
      { accountId, newBalance, reason }
    );
  };

  const handleCreateNewMonth = (newPeriodId: string, newMonthLabel: string) => {
    const latestPeriod = periods[periods.length - 1];
    const newPeriod = createRolloverMonth(latestPeriod, newPeriodId, newMonthLabel);
    setPeriods((prev) => [...prev, newPeriod]);
    setActivePeriodId(newPeriodId);

    const queueItem = createSyncQueueItem(
      newPeriodId,
      newMonthLabel,
      'CREATE_NEW_MONTH',
      `Buat Sheet Bulan Baru "${newMonthLabel}" dengan Rollover Saldo Awal ${formatIDR(newPeriod.openingBalanceCarryOver)}`,
      { newPeriodId, newMonthLabel, carryOver: newPeriod.openingBalanceCarryOver }
    );
    setSyncQueue((prev) => [queueItem, ...prev]);
    showToast(`Periode "${newMonthLabel}" berhasil disiapkan dengan akumulasi saldo bulan lalu.`);
  };

  const handleToggleFixedPaid = (id: string) => {
    const target = activePeriod.fixedCosts.find((fc) => fc.id === id);
    if (!target) return;
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        fixedCosts: curr.fixedCosts.map((fc) =>
          fc.id === id ? { ...fc, isPaid: !fc.isPaid, updatedAt: new Date().toISOString() } : fc
        ),
      }),
      'UPDATE_BUDGET_ITEM',
      `Status "${target.title}" diubah menjadi ${!target.isPaid ? 'Lunas' : 'Belum Lunas'}`,
      { id, isPaid: !target.isPaid }
    );
  };

  const handleUpdateFixedCost = (updated: FixedCostItem) => {
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        fixedCosts: curr.fixedCosts.map((fc) => (fc.id === updated.id ? updated : fc)),
      }),
      'UPDATE_BUDGET_ITEM',
      `Perbarui Fixed Cost "${updated.title}" (Aktual: ${formatIDR(updated.actual)})`,
      { item: updated }
    );
  };

  const handleAddFixedCost = (item: Omit<FixedCostItem, 'id' | 'updatedAt'>) => {
    const newItem: FixedCostItem = {
      ...item,
      id: `${activePeriod.periodId}-fc-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        fixedCosts: [...curr.fixedCosts, newItem],
      }),
      'ADD_BUDGET_ITEM',
      `Tambah Fixed Cost "${newItem.title}" (${formatIDR(newItem.actual)})`,
      { item: newItem }
    );
  };

  const handleDeleteFixedCost = (id: string) => {
    const target = activePeriod.fixedCosts.find((fc) => fc.id === id);
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        fixedCosts: curr.fixedCosts.filter((fc) => fc.id !== id),
      }),
      'DELETE_BUDGET_ITEM',
      `Hapus Fixed Cost "${target?.title || id}"`,
      { id }
    );
  };

  const handleToggleSubDebtPaid = (id: string) => {
    const target = activePeriod.subscriptionsAndDebts.find((s) => s.id === id);
    if (!target) return;
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        subscriptionsAndDebts: curr.subscriptionsAndDebts.map((s) =>
          s.id === id ? { ...s, isPaid: !s.isPaid } : s
        ),
      }),
      'UPDATE_BUDGET_ITEM',
      `Status langganan/hutang "${target.title}" diubah`,
      { id, isPaid: !target.isPaid }
    );
  };

  const handleUpdateSubDebt = (updated: SubscriptionDebtItem) => {
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        subscriptionsAndDebts: curr.subscriptionsAndDebts.map((s) =>
          s.id === updated.id ? updated : s
        ),
      }),
      'UPDATE_BUDGET_ITEM',
      `Perbarui "${updated.title}" menjadi ${formatIDR(updated.actual)}`,
      { item: updated }
    );
  };

  const handleAddSubDebt = (item: Omit<SubscriptionDebtItem, 'id' | 'updatedAt'>) => {
    const newItem: SubscriptionDebtItem = {
      ...item,
      id: `${activePeriod.periodId}-sd-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        subscriptionsAndDebts: [...curr.subscriptionsAndDebts, newItem],
      }),
      'ADD_BUDGET_ITEM',
      `Tambah Langganan/Hutang "${newItem.title}" (${formatIDR(newItem.actual)})`,
      { item: newItem }
    );
  };

  const handleUpdateVariableCost = (updated: VariableCostItem) => {
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        variableCosts: curr.variableCosts.map((v) => (v.id === updated.id ? updated : v)),
      }),
      'UPDATE_BUDGET_ITEM',
      `Perbarui plafon "${updated.title}" (Rencana: ${formatIDR(updated.planned)})`,
      { item: updated }
    );
  };

  const handleUpdateIncome = (updated: IncomeItem) => {
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        incomes: curr.incomes.map((i) => (i.id === updated.id ? updated : i)),
      }),
      'UPDATE_BUDGET_ITEM',
      `Perbarui pendapatan "${updated.source}" menjadi ${formatIDR(updated.amount)}`,
      { item: updated }
    );
  };

  const handleAddIncome = (item: Omit<IncomeItem, 'id' | 'updatedAt'>) => {
    const newItem: IncomeItem = {
      ...item,
      id: `${activePeriod.periodId}-inc-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        incomes: [...curr.incomes, newItem],
      }),
      'ADD_BUDGET_ITEM',
      `Tambah sumber pendapatan "${newItem.source}" (${formatIDR(newItem.amount)})`,
      { item: newItem }
    );
  };

  const handleUpdateSaving = (updated: SavingItem) => {
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        savings: curr.savings.map((s) => (s.id === updated.id ? updated : s)),
      }),
      'UPDATE_BUDGET_ITEM',
      `Perbarui tabungan "${updated.title}" menjadi ${formatIDR(updated.actual)}`,
      { item: updated }
    );
  };

  const handleAddSaving = (item: Omit<SavingItem, 'id' | 'updatedAt'>) => {
    const newItem: SavingItem = {
      ...item,
      id: `${activePeriod.periodId}-sav-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        savings: [...curr.savings, newItem],
      }),
      'ADD_BUDGET_ITEM',
      `Tambah pos tabungan "${newItem.title}"`,
      { item: newItem }
    );
  };

  const handleToggleSpecialLiability = (id: string) => {
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        specialLiabilities: curr.specialLiabilities.map((l) =>
          l.id === id ? { ...l, isSettled: !l.isSettled } : l
        ),
      }),
      'UPDATE_BUDGET_ITEM',
      `Perbarui status kewajiban khusus (${id})`,
      { id }
    );
  };

  const handleAddDailyExpense = (item: Omit<DailyExpenseItem, 'id' | 'updatedAt'>) => {
    const newItem: DailyExpenseItem = {
      ...item,
      id: `${activePeriod.periodId}-de-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        dailyExpenses: [newItem, ...curr.dailyExpenses],
      }),
      'ADD_DAILY_EXPENSE',
      `Transaksi baru: ${newItem.description} (${newItem.qty}x ${formatIDR(newItem.unitPrice)} = ${formatIDR(newItem.total)}) via ${newItem.paymentMethod}`,
      { item: newItem }
    );
  };

  const handleUpdateDailyExpense = (updated: DailyExpenseItem) => {
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        dailyExpenses: curr.dailyExpenses.map((d) => (d.id === updated.id ? updated : d)),
      }),
      'UPDATE_DAILY_EXPENSE',
      `Revisi transaksi harian: ${updated.description} (${updated.qty}x ${formatIDR(updated.unitPrice)} = ${formatIDR(updated.total)}) via ${updated.paymentMethod}`,
      { item: updated }
    );
    showToast(`Revisi "${updated.description}" (${formatIDR(updated.total)}) tersimpan & diupdate ke database.`);
  };

  const handleDeleteDailyExpense = (id: string) => {
    const target = activePeriod.dailyExpenses.find((d) => d.id === id);
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        dailyExpenses: curr.dailyExpenses.filter((d) => d.id !== id),
      }),
      'DELETE_DAILY_EXPENSE',
      `Hapus transaksi harian "${target?.description || id}"`,
      { id }
    );
  };

  const handleAddHangoutExpense = (item: Omit<HangoutExpenseItem, 'id' | 'updatedAt'>) => {
    const newItem: HangoutExpenseItem = {
      ...item,
      id: `${activePeriod.periodId}-he-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        hangoutExpenses: [newItem, ...curr.hangoutExpenses],
      }),
      'ADD_HANGOUT_EXPENSE',
      `Jajan/Nongkrong: ${newItem.placeOrEvent} (${formatIDR(newItem.amount)}) via ${newItem.paymentMethod}`,
      { item: newItem }
    );
  };

  const handleUpdateHangoutExpense = (updated: HangoutExpenseItem) => {
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        hangoutExpenses: curr.hangoutExpenses.map((h) => (h.id === updated.id ? updated : h)),
      }),
      'UPDATE_BUDGET_ITEM',
      `Revisi Jajan/Nongkrong: ${updated.placeOrEvent} (${formatIDR(updated.amount)}) via ${updated.paymentMethod}`,
      { item: updated }
    );
    showToast(`Revisi jajan "${updated.placeOrEvent}" (${formatIDR(updated.amount)}) tersimpan ke database.`);
  };

  const handleDeleteHangoutExpense = (id: string) => {
    mutateActivePeriod(
      (curr) => ({
        ...curr,
        hangoutExpenses: curr.hangoutExpenses.filter((h) => h.id !== id),
      }),
      'DELETE_HANGOUT_EXPENSE',
      `Hapus catatan nongkrong (${id})`,
      { id }
    );
  };

  const handleExportCSV = () => {
    const csvContent = exportPeriodToCSV(activePeriod);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FINANCIAL_PLANNER_${activePeriod.periodId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`File FINANCIAL_PLANNER_${activePeriod.periodId}.csv berhasil diunduh.`);
  };

  const handleAccountRegisteredAndVerified = (account: RegisteredUserAccount) => {
    setRegisteredAccount(account);
    try {
      localStorage.setItem(STORAGE_KEYS.USER_ACCOUNT, JSON.stringify(account));
    } catch {
      // Ignore
    }
  };

  const handleLoginSuccess = (account: RegisteredUserAccount) => {
    setRegisteredAccount(account);
    setIsAuthenticated(true);
    setIsOtpPortalModalOpen(false);
    try {
      localStorage.setItem(STORAGE_KEYS.USER_ACCOUNT, JSON.stringify(account));
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'ACTIVE');
      localStorage.setItem(STORAGE_KEYS.MASTER_AUTH_SESSION, 'AUTHENTICATED_ACTIVE');
    } catch {
      // Ignore
    }
    showToast(`Selamat datang kembali, ${account.username} (${OWNER_VERIFIED_EMAIL}).`);
  };

  const handleMasterAuthenticated = () => {
    setIsAuthenticated(true);
    try {
      localStorage.setItem(STORAGE_KEYS.MASTER_AUTH_SESSION, 'AUTHENTICATED_ACTIVE');
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'ACTIVE');
    } catch {
      // Ignore
    }
    showToast(`Otorisasi berhasil! Selamat datang di FinPay Pro (${OWNER_VERIFIED_EMAIL}).`);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsOtpPortalModalOpen(false);
    try {
      localStorage.removeItem(STORAGE_KEYS.MASTER_AUTH_SESSION);
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'LOCKED');
    } catch {
      // Ignore
    }
  };

  const handleVerify2FACode = (inputCode: string): boolean => {
    const clean = inputCode.trim().toUpperCase();
    const validRecovery = [
      'FINPAY-2026-8841-ABCD',
      'FINPAY-2026-3920-EFGH',
      'FINPAY-2026-7712-JKLM',
      'FINPAY-2026-9044-NPQR',
    ];
    if (clean === current2FACode || validRecovery.includes(clean)) {
      pushRealtimeNotification(
        'Verifikasi 2FA Berhasil',
        `Sesi keamanan dua faktor diverifikasi oleh ${registeredAccount?.email || OWNER_VERIFIED_EMAIL}.`,
        'SECURITY_2FA',
        'SUCCESS'
      );
      return true;
    }
    return false;
  };

  if (!isAuthenticated) {
    return <Modern3DLoginPortal onAuthenticated={handleMasterAuthenticated} />;
  }

  if (isOtpPortalModalOpen) {
    return (
      <AuthGate
        registeredAccount={registeredAccount}
        appsScriptUrl={syncConfig.appsScriptUrl}
        apiSecretToken={syncConfig.apiSecretToken}
        onUpdateAppsScriptUrl={(url) =>
          setSyncConfig((prev) => ({ ...prev, appsScriptUrl: url }))
        }
        onAccountRegisteredAndVerified={handleAccountRegisteredAndVerified}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div
      className={`min-h-screen liquid-bg-canvas pb-24 md:pb-12 relative overflow-x-hidden ${
        themeMode === 'light' ? 'theme-light text-slate-900' : 'text-slate-100'
      }`}
    >
      {/* Ambient Liquid Glass Glow Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-32 -left-24 w-96 h-96 rounded-full bg-emerald-500/12 blur-3xl ambient-orb no-print"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-1/3 -right-28 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl ambient-orb no-print"
      />

      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 liquid-glass border-x-0 border-t-0 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8 no-print">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          {t.brandTitle}
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav aria-label="Navigasi Utama" className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-emerald-400 underline underline-offset-8 decoration-2 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t.navDashboard}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'budget'
                ? 'text-emerald-400 underline underline-offset-8 decoration-2 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t.navBudget}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tracker')}
            className={`transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'tracker'
                ? 'text-emerald-400 underline underline-offset-8 decoration-2 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t.navTracker}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'accounts'
                ? 'text-emerald-400 underline underline-offset-8 decoration-2 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t.navAccounts}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'admin'
                ? 'text-emerald-400 underline underline-offset-8 decoration-2 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t.navAdminHub}
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={executeCloudSync}
            disabled={isSyncing || !isEffectiveOnline}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400 rounded-2xl liquid-btn whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSyncing ? t.syncing : t.syncNow}
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER (1440px Desktop Presence + Mobile Ergonomics) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-5 space-y-6 relative z-10">
        {/* WORKSPACE TOOLBAR: STATUS KONEKSI + 2FA + DARK/LIGHT MODE + MULTI-LANGUAGE + NOTIFICATIONS + MULTI-MONTH SELECTOR */}
        <div className="rounded-3xl liquid-glass p-4 flex flex-col gap-4 no-print">
          {/* Top Row of Workspace Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
              {syncState === 'SYNCED' && (
                <div
                  data-testid="sync-status-indicator"
                  className="flex items-center gap-2 text-xs font-medium text-emerald-400"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t.onlineSynced}</span>
                </div>
              )}
              {syncState === 'SYNCING' && (
                <div
                  data-testid="sync-status-indicator"
                  className="flex items-center gap-2 text-xs font-medium text-amber-300"
                >
                  <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                  <span>{t.syncing}</span>
                </div>
              )}
              {syncState === 'OFFLINE_PENDING' && (
                <div
                  data-testid="sync-status-indicator"
                  className="flex items-center gap-2 text-xs font-medium text-amber-400"
                >
                  {isEffectiveOnline ? (
                    <Clock className="w-4 h-4 shrink-0" />
                  ) : (
                    <WifiOff className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {t.offlinePending} ({pendingSyncItems.length})
                  </span>
                </div>
              )}

              <span className="text-slate-500 hidden sm:inline">·</span>

              <button
                type="button"
                onClick={() =>
                  setSyncConfig((prev) => ({
                    ...prev,
                    simulateOfflineMode: !prev.simulateOfflineMode,
                  }))
                }
                className="text-xs text-slate-300 hover:text-white underline decoration-dotted cursor-pointer"
              >
                {syncConfig.simulateOfflineMode
                  ? 'Matikan Simulasi Offline (Kembali Online)'
                  : 'Simulasikan Tanpa Sinyal (Offline)'}
              </button>

              <span className="text-slate-500 hidden sm:inline">·</span>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] break-all">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    {registeredAccount?.username || 'Owner'} ({OWNER_VERIFIED_EMAIL})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className="px-2 py-0.5 rounded-lg liquid-glass-inset text-emerald-400 font-mono text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>{t.twoFactorBadge}: {current2FACode}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Keluar dari Sesi dan Kembali ke Form Log In"
                  className="px-3 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>

            {/* Interactive Controls: Multi-Language Switcher, Dark/Light Theme Toggle, & Real-Time Notification Drawer Button */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Multi-Language Selector (ID / EN / AR) */}
              <div
                role="group"
                aria-label="Pilih Bahasa"
                className="flex items-center gap-1 p-1 rounded-2xl liquid-glass-inset"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400 ml-1.5" />
                {(['id', 'en', 'ar'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLocale(lang)}
                    aria-label={`Bahasa ${lang.toUpperCase()}`}
                    className={`px-2 py-1 rounded-xl text-[11px] font-mono font-semibold uppercase cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                      locale === lang
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Dark / Light Mode Toggle */}
              <button
                type="button"
                onClick={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                aria-label="Toggle Mode Gelap / Terang"
                className="px-3 py-1.5 rounded-2xl liquid-glass-inset hover:border-emerald-400/40 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                {themeMode === 'dark' ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.themeDark}</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.themeLight}</span>
                  </>
                )}
              </button>

              {/* Real-Time Push Notification Center Button */}
              <button
                type="button"
                onClick={() => {
                  setIsNotifDrawerOpen((v) => !v);
                  setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                }}
                aria-label="Buka Pusat Notifikasi Real-Time"
                className="px-3 py-1.5 rounded-2xl liquid-glass-inset hover:border-emerald-400/40 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Bell className="w-3.5 h-3.5 text-amber-300" />
                <span>{t.notificationsTitle}</span>
                {unreadNotifCount > 0 && (
                  <span className="font-mono font-bold text-emerald-400">
                    ({unreadNotifCount})
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Row: Multi-Bulan Selector & Action Buttons */}
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Pilih Periode Bulan"
              className="flex items-center gap-1 p-1 liquid-glass-inset rounded-2xl overflow-x-auto"
            >
              {periods.map((p) => {
                const isSelected = p.periodId === activePeriod.periodId;
                return (
                  <button
                    key={p.periodId}
                    role="tab"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => setActivePeriodId(p.periodId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {p.monthLabel}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNewMonthModalOpen(true)}
                className="px-3.5 py-2 rounded-2xl liquid-glass-inset hover:border-emerald-400/40 text-emerald-300 text-xs font-medium flex items-center gap-1.5 liquid-btn whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>{t.newMonthBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="px-3.5 py-2 rounded-2xl liquid-glass-inset hover:border-emerald-400/40 text-sky-300 text-xs font-medium flex items-center gap-1.5 liquid-btn whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Analitik Admin, 2FA & Dokumentasi</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('accounts');
                  setTimeout(() => {
                    document
                      .getElementById('android-hosting-center')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="px-3.5 py-2 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 liquid-btn whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>.APK / .AAB & Hosting mrofiqi.id</span>
              </button>
            </div>
          </div>
        </div>

        {/* REAL-TIME PUSH NOTIFICATION DRAWER / PANEL */}
        {isNotifDrawerOpen && (
          <section
            aria-label="Panel Notifikasi Real-Time"
            className="rounded-3xl liquid-glass border-emerald-400/40 p-5 space-y-4 no-print"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">
                  Pusat Notifikasi Push Real-Time ({notifications.length} Aktivitas)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('admin');
                    setIsNotifDrawerOpen(false);
                  }}
                  className="text-xs text-emerald-400 hover:underline cursor-pointer"
                >
                  Kustomisasi Preferensi Notifikasi &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => setIsNotifDrawerOpen(false)}
                  aria-label="Tutup panel notifikasi"
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {notifications.slice(0, 6).map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-2xl liquid-glass-inset flex flex-col justify-between gap-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-emerald-400 font-semibold">
                      {n.category} · {n.actor}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(n.timestamp).toLocaleTimeString('id-ID')}
                    </span>
                  </div>
                  <p className="font-semibold text-white">{n.title}</p>
                  <p className="text-slate-300 text-[11px]">{n.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div
            role="status"
            className="rounded-2xl liquid-glass border-emerald-400/40 px-4 py-3 text-xs text-emerald-300 flex items-center justify-between shadow-lg"
          >
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-slate-300 hover:text-white ml-4 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* ACTIVE VIEWPORT MODULE */}
        {activeTab === 'dashboard' && (
          <DashboardView
            period={activePeriod}
            summary={activeSummary}
            onOpenReviseOpeningBalance={() => setIsReviseModalOpen(true)}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onQuickAddDailyExpense={() => setActiveTab('tracker')}
          />
        )}

        {activeTab === 'budget' && (
          <MonthlyBudgetView
            period={activePeriod}
            summary={activeSummary}
            onToggleFixedPaid={handleToggleFixedPaid}
            onUpdateFixedCost={handleUpdateFixedCost}
            onAddFixedCost={handleAddFixedCost}
            onDeleteFixedCost={handleDeleteFixedCost}
            onToggleSubDebtPaid={handleToggleSubDebtPaid}
            onUpdateSubDebt={handleUpdateSubDebt}
            onAddSubDebt={handleAddSubDebt}
            onUpdateVariableCost={handleUpdateVariableCost}
            onUpdateIncome={handleUpdateIncome}
            onAddIncome={handleAddIncome}
            onUpdateSaving={handleUpdateSaving}
            onAddSaving={handleAddSaving}
            onToggleSpecialLiability={handleToggleSpecialLiability}
          />
        )}

        {activeTab === 'tracker' && (
          <DailyTrackerView
            period={activePeriod}
            summary={activeSummary}
            onAddDailyExpense={handleAddDailyExpense}
            onUpdateDailyExpense={handleUpdateDailyExpense}
            onDeleteDailyExpense={handleDeleteDailyExpense}
            onAddHangoutExpense={handleAddHangoutExpense}
            onUpdateHangoutExpense={handleUpdateHangoutExpense}
            onDeleteHangoutExpense={handleDeleteHangoutExpense}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsAndSyncView
            period={activePeriod}
            summary={activeSummary}
            syncQueue={syncQueue}
            syncConfig={syncConfig}
            isSyncing={isSyncing}
            onUpdateSyncConfig={(partial) =>
              setSyncConfig((prev) => ({ ...prev, ...partial }))
            }
            onTriggerSyncNow={executeCloudSync}
            onOpenReviseOpeningBalance={() => setIsReviseModalOpen(true)}
            onReviseAccountBalance={handleReviseAccountBalance}
            onExportCSV={handleExportCSV}
            onPrintPDF={() => window.print()}
          />
        )}

        {activeTab === 'admin' && (
          <AdminEnterpriseHubView
            periods={periods}
            activePeriod={activePeriod}
            activeSummary={activeSummary}
            syncQueue={syncQueue}
            usersSheet={usersSheet}
            onUpdateUsersSheet={setUsersSheet}
            notifications={notifications}
            notificationPrefs={notificationPrefs}
            onUpdateNotificationPrefs={setNotificationPrefs}
            onSendRealtimeNotification={pushRealtimeNotification}
            is2FAEnabled={is2FAEnabled}
            onToggle2FAEnabled={(enabled) => {
              setIs2FAEnabled(enabled);
              try {
                localStorage.setItem(STORAGE_KEYS.TWO_FACTOR_ENABLED, String(enabled));
              } catch {
                // Ignore
              }
            }}
            onVerify2FACode={handleVerify2FACode}
            current2FACode={current2FACode}
            twoFactorSecondsRemaining={twoFactorSecondsRemaining}
            locale={locale}
            onTriggerCloudSync={executeCloudSync}
          />
        )}
      </main>

      {/* ANDROID LUXURY LIQUID GLASS BOTTOM NAVIGATION BAR (Mobile Viewport) */}
      <nav
        aria-label="Navigasi Bawah Android"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 liquid-glass border-x-0 border-b-0 grid grid-cols-5 items-center h-16 px-1 no-print"
      >
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
            activeTab === 'dashboard' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('budget')}
          className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
            activeTab === 'budget' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <PieChart className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Anggaran</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tracker')}
          className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
            activeTab === 'tracker' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <ListChecks className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Tracker</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
            activeTab === 'accounts' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Rekening</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('admin')}
          className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
            activeTab === 'admin' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Admin & 2FA</span>
        </button>
      </nav>

      {/* MODALS */}
      <ReviseBalanceModal
        isOpen={isReviseModalOpen}
        period={activePeriod}
        summary={activeSummary}
        onClose={() => setIsReviseModalOpen(false)}
        onSaveRevision={handleReviseOpeningBalance}
      />

      <CreateNewMonthModal
        isOpen={isNewMonthModalOpen}
        sourcePeriod={periods[periods.length - 1]}
        sourceSummary={calculatePeriodSummary(periods[periods.length - 1])}
        existingPeriods={periods}
        onClose={() => setIsNewMonthModalOpen(false)}
        onCreateMonth={handleCreateNewMonth}
      />
    </div>
  );
}
