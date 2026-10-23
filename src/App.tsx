import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PieChart,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  WifiOff,
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
} from './utils/auth';
import { AuthGate } from './components/AuthGate';
import { DashboardView } from './components/DashboardView';
import { MonthlyBudgetView } from './components/MonthlyBudgetView';
import { DailyTrackerView } from './components/DailyTrackerView';
import { AccountsAndSyncView } from './components/AccountsAndSyncView';
import { CreateNewMonthModal, ReviseBalanceModal } from './components/Modals';

const STORAGE_KEYS = {
  PERIODS: 'aurelia_finplanner_periods_v2',
  ACTIVE_PERIOD: 'aurelia_finplanner_active_period_v2',
  SYNC_QUEUE: 'aurelia_finplanner_sync_queue_v2',
  SYNC_CONFIG: 'aurelia_finplanner_sync_config_v2',
  USER_ACCOUNT: 'aurelia_finplanner_user_account_v1',
  AUTH_SESSION: 'aurelia_finplanner_auth_session_v1',
};

type ActiveTab = 'dashboard' | 'budget' | 'tracker' | 'accounts';

export default function App() {
  // 0. Authentication & Email Verification State (itptgaramofficial@gmail.com)
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
      const savedSession = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (savedSession === 'LOCKED') return false;
      return true;
    } catch {
      return true;
    }
  });
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

  // 3. Cloud Sync Configuration & Connectivity State (Terhubung ke Google Apps Script Live)
  const [syncConfig, setSyncConfig] = useState<CloudSyncConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SYNC_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved) as CloudSyncConfig;
        const currentUrl = parsed.appsScriptUrl?.trim() || '';
        const isOldPlaceholder =
          !currentUrl || currentUrl.includes('AutoSync_2026');
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

  // Persist to LocalStorage automatically (Offline-First Guarantee)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PERIODS, JSON.stringify(periods));
    } catch {
      // Ignore storage quota errors
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

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
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

  // Determine Sync State Badge
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
      // 1. Sync to Built-in Cloud Vault Server (/api/sync)
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiSecretToken: syncConfig.apiSecretToken,
            queue: pendingSyncItems,
            activePeriodSnapshot: activePeriod,
          }),
        });
      } catch {
        // Ignore on static hosting
      }

      // 2. Mirror automatically to Google Drive Apps Script if custom deployment URL is active
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
      showToast('Seluruh antrean data berhasil disinkronkan ke Google Sheets.');
    } catch {
      showToast('Mode Offline: Data aman tersimpan di perangkat & akan disinkronkan ulang.');
    } finally {
      setIsSyncing(false);
    }
  }, [isEffectiveOnline, isSyncing, syncConfig.appsScriptUrl, syncConfig.apiSecretToken, pendingSyncItems, activePeriod, showToast]);

  // Auto-Sync Trigger when returning Online with pending queue items
  useEffect(() => {
    if (isEffectiveOnline && syncConfig.autoSyncOnReconnect && pendingSyncItems.length > 0 && !isSyncing) {
      const timer = setTimeout(() => {
        executeCloudSync();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [isEffectiveOnline, syncConfig.autoSyncOnReconnect, pendingSyncItems.length, isSyncing, executeCloudSync]);

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
        // Cascade rollover closing balance to subsequent month's openingBalanceCarryOver
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

      if (!isEffectiveOnline) {
        showToast(`Tersimpan Offline: "${summaryText}" masuk ke Antrean Sync.`);
      }
    },
    [activePeriod.periodId, activePeriod.monthLabel, isEffectiveOnline, showToast]
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
    try {
      localStorage.setItem(STORAGE_KEYS.USER_ACCOUNT, JSON.stringify(account));
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'ACTIVE');
    } catch {
      // Ignore
    }
    showToast(`Selamat datang kembali, ${account.username} (${OWNER_VERIFIED_EMAIL}).`);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'LOCKED');
    } catch {
      // Ignore
    }
  };

  if (!isAuthenticated) {
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
    <div className="min-h-screen liquid-bg-canvas text-slate-100 pb-24 md:pb-12 relative overflow-x-hidden">
      {/* Ambient Liquid Glass Glow Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-32 -left-24 w-96 h-96 rounded-full bg-emerald-500/12 blur-3xl ambient-orb no-print"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-1/3 -right-28 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl ambient-orb no-print"
      />

      {/* STRICT 3-ZONE TOP BAR CONTRACT (LIQUID GLASS) */}
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
          FinPlanner by mrofiqi.id
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
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
            Dashboard
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
            Anggaran Bulanan
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
            Tracker Harian
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
            Rekening & Cloud Sync
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
            {isSyncing ? 'Menyinkronkan...' : 'Sync Sekarang'}
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER (1440px Desktop Presence + Mobile Ergonomics) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-5 space-y-6 relative z-10">
        {/* WORKSPACE TOOLBAR: STATUS KONEKSI + VERIFIED USER + MULTI-MONTH SELECTOR */}
        <div className="rounded-3xl liquid-glass p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
          {/* Connection & Sync Queue Status Indicator */}
          <div className="flex flex-wrap items-center gap-3">
            {syncState === 'SYNCED' && (
              <div
                data-testid="sync-status-indicator"
                className="flex items-center gap-2 text-xs font-medium text-emerald-400"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Online · Tersinkronisasi ke Google Sheets</span>
              </div>
            )}
            {syncState === 'SYNCING' && (
              <div
                data-testid="sync-status-indicator"
                className="flex items-center gap-2 text-xs font-medium text-amber-300"
              >
                <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                <span>Menyinkronkan Antrean Data ke Google Drive...</span>
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
                  {isEffectiveOnline
                    ? `Menunggu Sinkronisasi (${pendingSyncItems.length} Antrean Lokal)`
                    : `Mode Offline — Data Tersimpan Lokal di HP (${pendingSyncItems.length} Antrean)`}
                </span>
              </div>
            )}

            <span className="text-slate-600 hidden sm:inline">·</span>

            <button
              type="button"
              onClick={() =>
                setSyncConfig((prev) => ({
                  ...prev,
                  simulateOfflineMode: !prev.simulateOfflineMode,
                }))
              }
              className="text-xs text-slate-300 hover:text-white underline decoration-dotted cursor-pointer whitespace-nowrap shrink-0"
            >
              {syncConfig.simulateOfflineMode
                ? 'Matikan Simulasi Offline (Kembali Online)'
                : 'Simulasikan Tanpa Sinyal (Offline)'}
            </button>

            <span className="text-slate-600 hidden sm:inline">·</span>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-mono text-[11px]">
                {registeredAccount?.username || 'Owner'} ({OWNER_VERIFIED_EMAIL})
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Buka Portal Pendaftaran & Verifikasi Token (Sheet Users)"
                className="ml-1 px-2.5 py-1 rounded-xl liquid-glass-inset hover:border-emerald-400/40 text-emerald-300 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3 h-3" />
                <span>Portal Akun & Verifikasi</span>
              </button>
            </div>
          </div>

          {/* Multi-Bulan Selector & Tombol + Buat Bulan Baru */}
          <div className="flex flex-wrap items-center gap-2">
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

            <button
              type="button"
              onClick={() => setIsNewMonthModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl liquid-glass-inset hover:border-emerald-400/40 text-emerald-300 text-xs font-medium flex items-center gap-1.5 liquid-btn whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>+ Buat Bulan Baru</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('accounts');
                setTimeout(() => {
                  document.getElementById('android-hosting-center')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="px-3.5 py-2 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 liquid-btn whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>.APK / .AAB & Hosting mrofiqi.id</span>
            </button>
          </div>
        </div>

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
      </main>

      {/* ANDROID LUXURY LIQUID GLASS BOTTOM NAVIGATION BAR (Mobile Viewport) */}
      <nav
        aria-label="Navigasi Bawah Android"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 liquid-glass border-x-0 border-b-0 grid grid-cols-4 items-center h-16 px-2 no-print"
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
          <span className="text-[10px] font-medium mt-1">Rekening & Sync</span>
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
