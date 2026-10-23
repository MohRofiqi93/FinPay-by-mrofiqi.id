export type PriorityLevel = 'High' | 'Medium' | 'Low' | 'Optional';
export type PaymentMethod = 'GOPAY' | 'DANA' | 'BRI' | 'BCA' | 'BSI' | 'COD' | 'TF' | 'PILIH';
export type SyncState = 'SYNCED' | 'SYNCING' | 'OFFLINE_PENDING' | 'ERROR';

export interface FixedCostItem {
  id: string;
  dueDay: string;
  title: string;
  methodOrPriority: PaymentMethod | 'Optional';
  planned: number;
  actual: number;
  isPaid: boolean; // true = ✅, false = ⭕
  updatedAt: string;
}

export interface SubscriptionDebtItem {
  id: string;
  dueDay: string;
  title: string;
  priority: PriorityLevel;
  planned: number;
  actual: number;
  isPaid: boolean;
  includeInMonthlyTotal: boolean; // In CSV,⭕ items sum to 700,000 active monthly total
  updatedAt: string;
}

export interface VariableCostItem {
  id: string;
  title: string;
  priority: PriorityLevel;
  planned: number;
  actual: number;
  linkedToTracker?: 'DAILY' | 'HANGOUT' | null;
  updatedAt: string;
}

export interface IncomeItem {
  id: string;
  source: string;
  type: 'Utama' | 'Sampingan';
  amount: number;
  updatedAt: string;
}

export interface SavingItem {
  id: string;
  title: string;
  priority: PriorityLevel;
  planned: number;
  actual: number;
  updatedAt: string;
}

export interface AccountBalanceItem {
  id: string;
  name: string;
  code: PaymentMethod;
  category: 'BANK' | 'EWALLET';
  holderNote: string;
  plannedAllocation: number;
  balance: number;
  lastReconciledAt: string;
  reconciliationNote?: string;
}

export interface DailyExpenseItem {
  id: string;
  date: string; // DD/MM/YY or YYYY-MM-DD
  description: string;
  qty: number;
  unitPrice: number;
  total: number; // qty * unitPrice
  paymentMethod: PaymentMethod;
  groupTag?: 'OPERASIONAL' | 'AIRA_SAVING';
  updatedAt: string;
}

export interface HangoutExpenseItem {
  id: string;
  date: string;
  placeOrEvent: string;
  amount: number;
  paymentMethod: PaymentMethod;
  note: string;
  updatedAt: string;
}

export interface LiabilityNoteItem {
  id: string;
  title: string;
  category: 'HUTANG_KHUSUS' | 'SALDO_TITIPAN' | 'KONTAK_PENTING';
  amount: number;
  detail: string;
  isSettled: boolean;
}

export interface BalanceRevisionEntry {
  id: string;
  timestamp: string;
  previousBalance: number;
  newBalance: number;
  delta: number;
  reason: string;
  targetType: 'OPENING_BALANCE' | 'ACCOUNT_BALANCE';
  targetName: string;
}

export interface MonthlyPeriodData {
  periodId: string; // e.g., "2026-10"
  monthLabel: string; // e.g., "Oktober 2026"
  createdAt: string;
  updatedAt: string;
  openingBalanceCarryOver: number; // Rollover from previous month's closing balance
  openingBalanceManualOverride: number | null; // Manual revision if set
  openingBalanceRevisionNote: string;
  syncVariableWithTrackers: boolean;
  fixedCosts: FixedCostItem[];
  subscriptionsAndDebts: SubscriptionDebtItem[];
  variableCosts: VariableCostItem[];
  incomes: IncomeItem[];
  savings: SavingItem[];
  accounts: AccountBalanceItem[];
  dailyExpenses: DailyExpenseItem[];
  hangoutExpenses: HangoutExpenseItem[];
  specialLiabilities: LiabilityNoteItem[];
  revisionHistory: BalanceRevisionEntry[];
}

export type SyncOperationType =
  | 'ADD_DAILY_EXPENSE'
  | 'UPDATE_DAILY_EXPENSE'
  | 'DELETE_DAILY_EXPENSE'
  | 'ADD_HANGOUT_EXPENSE'
  | 'DELETE_HANGOUT_EXPENSE'
  | 'UPDATE_BUDGET_ITEM'
  | 'ADD_BUDGET_ITEM'
  | 'DELETE_BUDGET_ITEM'
  | 'REVISE_OPENING_BALANCE'
  | 'REVISE_ACCOUNT_BALANCE'
  | 'CREATE_NEW_MONTH'
  | 'FULL_SNAPSHOT_SYNC';

export interface SyncQueueItem {
  queueId: string;
  periodId: string;
  monthLabel: string;
  operation: SyncOperationType;
  summary: string;
  timestamp: string;
  isSynced: boolean;
  syncedAt?: string;
  checksumSha256: string;
  encryptedPayloadPreview: string;
  payload: Record<string, unknown>;
}

export interface CloudSyncConfig {
  appsScriptUrl: string;
  apiSecretToken: string;
  spreadsheetId: string;
  autoSyncOnReconnect: boolean;
  simulateOfflineMode: boolean;
  lastSyncedAt: string | null;
}

export interface PeriodFinancialSummary {
  openingBalance: number;
  isOpeningBalanceRevised: boolean;
  totalIncome: number;
  primaryIncome: number;
  sideIncome: number;
  fixedCostPlanned: number;
  fixedCostActual: number;
  paidFixedCount: number;
  totalFixedCount: number;
  subDebtPlanned: number;
  subDebtActual: number;
  subDebtAllActual: number;
  variablePlanned: number;
  variableActual: number;
  savingPlanned: number;
  savingActual: number;
  totalExpensePlanned: number;
  totalExpenseActual: number; // Fixed + SubDebt + Variable (Rp 7,072,000 in Oct)
  totalAllocationPlanned: number; // Expense Planned + Saving Planned (Rp 10,646,000 in Oct)
  totalAllocationActual: number; // Expense Actual + Saving Actual (Rp 11,513,000 in Oct)
  netMonthlyCashflow: number; // Income - TotalAllocationActual (-Rp 3,513,000 in Oct)
  closingBalance: number; // OpeningBalance + Income - TotalAllocationActual
  dailyTrackerTotal: number;
  dailyTrackerOperationalTotal: number;
  dailyTrackerAiraSavingTotal: number;
  dailyTrackerCount: number;
  hangoutTrackerTotal: number;
  hangoutTrackerCount: number;
  totalCodExpenses: number;
  totalTfExpenses: number;
  totalBriExpenses: number;
  totalBsiExpenses: number;
  totalBankBalance: number; // BCA + BRI + BSI (Rp 4,522,000 in Oct)
  totalEwalletBalance: number; // GoPay + DANA
  totalAllAccountsBalance: number;
  totalSpecialLiabilities: number;
}
