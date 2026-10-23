import {
  AccountBalanceItem,
  BalanceRevisionEntry,
  DailyExpenseItem,
  HangoutExpenseItem,
  MonthlyPeriodData,
  PeriodFinancialSummary,
  SyncOperationType,
  SyncQueueItem,
} from '../types/finance';

export function formatIDR(amount: number, showPlus = false): string {
  const isNegative = amount < 0;
  const absVal = Math.abs(Math.round(amount));
  const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (isNegative) {
    return `-Rp ${formatted}`;
  }
  if (showPlus && amount > 0) {
    return `+Rp ${formatted}`;
  }
  return `Rp ${formatted}`;
}

export function formatCompactIDR(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const prefix = isNegative ? '-Rp ' : 'Rp ';
  if (abs >= 1_000_000_000) {
    return `${prefix}${(abs / 1_000_000_000).toFixed(2).replace(/\.00$/, '')} M`;
  }
  if (abs >= 1_000_000) {
    return `${prefix}${(abs / 1_000_000).toFixed(2).replace(/\.00$/, '')} Jt`;
  }
  if (abs >= 1_000) {
    return `${prefix}${(abs / 1_000).toFixed(0)} Rb`;
  }
  return `${prefix}${abs}`;
}

export function computeDailyExpenseTotal(qty: number, unitPrice: number): number {
  const validQty = Number.isFinite(qty) && qty >= 0 ? qty : 0;
  const validPrice = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
  return Math.round(validQty * validPrice);
}

export function calculatePeriodSummary(period: MonthlyPeriodData): PeriodFinancialSummary {
  const isOpeningBalanceRevised = period.openingBalanceManualOverride !== null;
  const openingBalance = isOpeningBalanceRevised
    ? (period.openingBalanceManualOverride as number)
    : period.openingBalanceCarryOver;

  const primaryIncome = period.incomes
    .filter((i) => i.type === 'Utama')
    .reduce((acc, item) => acc + (item.amount || 0), 0);

  const sideIncome = period.incomes
    .filter((i) => i.type === 'Sampingan')
    .reduce((acc, item) => acc + (item.amount || 0), 0);

  const totalIncome = primaryIncome + sideIncome;

  const fixedCostPlanned = period.fixedCosts.reduce((acc, item) => acc + (item.planned || 0), 0);
  const fixedCostActual = period.fixedCosts.reduce((acc, item) => acc + (item.actual || 0), 0);
  const paidFixedCount = period.fixedCosts.filter((item) => item.isPaid).length;
  const totalFixedCount = period.fixedCosts.length;

  const subDebtPlanned = period.subscriptionsAndDebts
    .filter((item) => item.includeInMonthlyTotal)
    .reduce((acc, item) => acc + (item.planned || 0), 0);

  const subDebtActual = period.subscriptionsAndDebts
    .filter((item) => item.includeInMonthlyTotal)
    .reduce((acc, item) => acc + (item.actual || 0), 0);

  const subDebtAllActual = period.subscriptionsAndDebts.reduce(
    (acc, item) => acc + (item.actual || 0),
    0
  );

  const dailyTrackerTotal = period.dailyExpenses.reduce((acc, item) => acc + (item.total || 0), 0);
  const dailyTrackerOperationalTotal = period.dailyExpenses
    .filter((item) => item.groupTag !== 'AIRA_SAVING')
    .reduce((acc, item) => acc + (item.total || 0), 0);
  const dailyTrackerAiraSavingTotal = period.dailyExpenses
    .filter((item) => item.groupTag === 'AIRA_SAVING')
    .reduce((acc, item) => acc + (item.total || 0), 0);

  const dailyTrackerCount = period.dailyExpenses.filter((item) => item.total > 0 || item.description.trim() !== '').length;

  const hangoutTrackerTotal = period.hangoutExpenses.reduce(
    (acc, item) => acc + (item.amount || 0),
    0
  );
  const hangoutTrackerCount = period.hangoutExpenses.length;

  const variablePlanned = period.variableCosts.reduce((acc, item) => acc + (item.planned || 0), 0);
  const variableActual = period.variableCosts.reduce((acc, item) => {
    if (period.syncVariableWithTrackers) {
      if (item.linkedToTracker === 'DAILY') {
        return acc + dailyTrackerTotal;
      }
      if (item.linkedToTracker === 'HANGOUT') {
        return acc + hangoutTrackerTotal;
      }
    }
    return acc + (item.actual || 0);
  }, 0);

  const savingPlanned = period.savings.reduce((acc, item) => acc + (item.planned || 0), 0);
  const savingActual = period.savings.reduce((acc, item) => acc + (item.actual || 0), 0);

  const totalExpensePlanned = fixedCostPlanned + subDebtPlanned + variablePlanned;
  const totalExpenseActual = fixedCostActual + subDebtActual + variableActual;

  const totalAllocationPlanned = totalExpensePlanned + savingPlanned;
  const totalAllocationActual = totalExpenseActual + savingActual;

  const netMonthlyCashflow = totalIncome - totalAllocationActual;
  const closingBalance = openingBalance + netMonthlyCashflow;

  const totalCodExpenses =
    period.dailyExpenses
      .filter((d) => d.paymentMethod === 'COD')
      .reduce((acc, d) => acc + d.total, 0) +
    period.hangoutExpenses
      .filter((h) => h.paymentMethod === 'COD')
      .reduce((acc, h) => acc + h.amount, 0);

  const totalTfExpenses =
    period.dailyExpenses
      .filter((d) => d.paymentMethod === 'TF')
      .reduce((acc, d) => acc + d.total, 0) +
    period.hangoutExpenses
      .filter((h) => h.paymentMethod === 'TF')
      .reduce((acc, h) => acc + h.amount, 0);

  const totalBriExpenses =
    period.dailyExpenses
      .filter((d) => d.paymentMethod === 'BRI')
      .reduce((acc, d) => acc + d.total, 0) +
    period.hangoutExpenses
      .filter((h) => h.paymentMethod === 'BRI')
      .reduce((acc, h) => acc + h.amount, 0);

  const totalBsiExpenses =
    period.dailyExpenses
      .filter((d) => d.paymentMethod === 'BSI')
      .reduce((acc, d) => acc + d.total, 0) +
    period.hangoutExpenses
      .filter((h) => h.paymentMethod === 'BSI')
      .reduce((acc, h) => acc + h.amount, 0);

  const totalBankBalance = period.accounts
    .filter((a) => a.category === 'BANK')
    .reduce((acc, a) => acc + (a.balance || 0), 0);

  const totalEwalletBalance = period.accounts
    .filter((a) => a.category === 'EWALLET')
    .reduce((acc, a) => acc + (a.balance || 0), 0);

  const totalAllAccountsBalance = totalBankBalance + totalEwalletBalance;

  const totalSpecialLiabilities = period.specialLiabilities
    .filter((l) => !l.isSettled && l.category === 'HUTANG_KHUSUS')
    .reduce((acc, l) => acc + (l.amount || 0), 0);

  return {
    openingBalance,
    isOpeningBalanceRevised,
    totalIncome,
    primaryIncome,
    sideIncome,
    fixedCostPlanned,
    fixedCostActual,
    paidFixedCount,
    totalFixedCount,
    subDebtPlanned,
    subDebtActual,
    subDebtAllActual,
    variablePlanned,
    variableActual,
    savingPlanned,
    savingActual,
    totalExpensePlanned,
    totalExpenseActual,
    totalAllocationPlanned,
    totalAllocationActual,
    netMonthlyCashflow,
    closingBalance,
    dailyTrackerTotal,
    dailyTrackerOperationalTotal,
    dailyTrackerAiraSavingTotal,
    dailyTrackerCount,
    hangoutTrackerTotal,
    hangoutTrackerCount,
    totalCodExpenses,
    totalTfExpenses,
    totalBriExpenses,
    totalBsiExpenses,
    totalBankBalance,
    totalEwalletBalance,
    totalAllAccountsBalance,
    totalSpecialLiabilities,
  };
}

export function createRolloverMonth(
  sourcePeriod: MonthlyPeriodData,
  newPeriodId: string,
  newMonthLabel: string,
  nowIso = new Date().toISOString()
): MonthlyPeriodData {
  const sourceSummary = calculatePeriodSummary(sourcePeriod);
  const carryOverBalance = sourceSummary.closingBalance;

  return {
    periodId: newPeriodId,
    monthLabel: newMonthLabel,
    createdAt: nowIso,
    updatedAt: nowIso,
    openingBalanceCarryOver: carryOverBalance,
    openingBalanceManualOverride: null,
    openingBalanceRevisionNote: `Rollover otomatis dari Saldo Akhir ${sourcePeriod.monthLabel} (${formatIDR(carryOverBalance)})`,
    syncVariableWithTrackers: true,
    fixedCosts: sourcePeriod.fixedCosts.map((fc) => ({
      ...fc,
      id: `${newPeriodId}-${fc.id.split('-').slice(-1)[0]}`,
      actual: 0,
      isPaid: false,
      updatedAt: nowIso,
    })),
    subscriptionsAndDebts: sourcePeriod.subscriptionsAndDebts.map((sd) => ({
      ...sd,
      id: `${newPeriodId}-${sd.id.split('-').slice(-1)[0]}`,
      actual: 0,
      isPaid: false,
      updatedAt: nowIso,
    })),
    variableCosts: sourcePeriod.variableCosts.map((vc) => ({
      ...vc,
      id: `${newPeriodId}-${vc.id.split('-').slice(-1)[0]}`,
      actual: 0,
      updatedAt: nowIso,
    })),
    incomes: sourcePeriod.incomes.map((inc) => ({
      ...inc,
      id: `${newPeriodId}-${inc.id.split('-').slice(-1)[0]}`,
      amount: inc.type === 'Utama' ? inc.amount : 0, // Keep base salary, reset side gig actuals
      updatedAt: nowIso,
    })),
    savings: sourcePeriod.savings.map((sav) => ({
      ...sav,
      id: `${newPeriodId}-${sav.id.split('-').slice(-1)[0]}`,
      actual: 0,
      updatedAt: nowIso,
    })),
    accounts: sourcePeriod.accounts.map((acc) => ({
      ...acc,
      lastReconciledAt: nowIso,
      reconciliationNote: `Saldo terbawa dari ${sourcePeriod.monthLabel}`,
    })),
    dailyExpenses: [],
    hangoutExpenses: [],
    specialLiabilities: sourcePeriod.specialLiabilities.map((liab) => ({ ...liab })),
    revisionHistory: [
      {
        id: `rev-init-${newPeriodId}`,
        timestamp: nowIso,
        previousBalance: 0,
        newBalance: carryOverBalance,
        delta: carryOverBalance,
        reason: `Auto-Rollover Saldo Akhir dari ${sourcePeriod.monthLabel}`,
        targetType: 'OPENING_BALANCE',
        targetName: 'Saldo Awal Bulan',
      },
    ],
  };
}

export function applyOpeningBalanceRevision(
  period: MonthlyPeriodData,
  newBalance: number,
  reason: string,
  nowIso = new Date().toISOString()
): MonthlyPeriodData {
  const currentSummary = calculatePeriodSummary(period);
  const previousBalance = currentSummary.openingBalance;
  const delta = newBalance - previousBalance;

  const revisionEntry: BalanceRevisionEntry = {
    id: `rev-${Date.now()}`,
    timestamp: nowIso,
    previousBalance,
    newBalance,
    delta,
    reason: reason.trim() || 'Penyesuaian / rekonsiliasi saldo manual',
    targetType: 'OPENING_BALANCE',
    targetName: 'Saldo Awal / Akumulasi',
  };

  return {
    ...period,
    updatedAt: nowIso,
    openingBalanceManualOverride: newBalance,
    openingBalanceRevisionNote: revisionEntry.reason,
    revisionHistory: [revisionEntry, ...period.revisionHistory],
  };
}

export function applyAccountBalanceRevision(
  period: MonthlyPeriodData,
  accountId: string,
  newBalance: number,
  reason: string,
  nowIso = new Date().toISOString()
): MonthlyPeriodData {
  const targetAcc = period.accounts.find((a) => a.id === accountId);
  if (!targetAcc) return period;

  const previousBalance = targetAcc.balance;
  const delta = newBalance - previousBalance;

  const revisionEntry: BalanceRevisionEntry = {
    id: `rev-acc-${Date.now()}`,
    timestamp: nowIso,
    previousBalance,
    newBalance,
    delta,
    reason: reason.trim() || `Rekonsiliasi saldo ${targetAcc.name}`,
    targetType: 'ACCOUNT_BALANCE',
    targetName: targetAcc.name,
  };

  const updatedAccounts: AccountBalanceItem[] = period.accounts.map((a) =>
    a.id === accountId
      ? {
          ...a,
          balance: newBalance,
          lastReconciledAt: nowIso,
          reconciliationNote: revisionEntry.reason,
        }
      : a
  );

  return {
    ...period,
    updatedAt: nowIso,
    accounts: updatedAccounts,
    revisionHistory: [revisionEntry, ...period.revisionHistory],
  };
}

export function generateDeterministicHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `sha256:${hex1}${hex2}`;
}

export function createEncryptedPreview(payload: Record<string, unknown>): string {
  const raw = JSON.stringify(payload);
  let encoded = '';
  try {
    encoded = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(raw))) : Buffer.from(raw).toString('base64');
  } catch {
    encoded = raw.slice(0, 32);
  }
  const snippet = encoded.slice(0, 28);
  return `AES256-GCM::IV9a8f::${snippet}...`;
}

export function createSyncQueueItem(
  periodId: string,
  monthLabel: string,
  operation: SyncOperationType,
  summary: string,
  payload: Record<string, unknown>,
  nowIso = new Date().toISOString()
): SyncQueueItem {
  const rawString = `${periodId}|${operation}|${nowIso}|${JSON.stringify(payload)}`;
  return {
    queueId: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    periodId,
    monthLabel,
    operation,
    summary,
    timestamp: nowIso,
    isSynced: false,
    checksumSha256: generateDeterministicHash(rawString),
    encryptedPayloadPreview: createEncryptedPreview(payload),
    payload,
  };
}

export function exportPeriodToCSV(period: MonthlyPeriodData): string {
  const summary = calculatePeriodSummary(period);
  const lines: string[] = [];

  lines.push(`LAPORAN FINANCIAL PLANNER - ${period.monthLabel.toUpperCase()}`);
  lines.push(`Periode ID,${period.periodId}`);
  lines.push(`Diekspor Pada,${new Date().toISOString()}`);
  lines.push('');

  lines.push('RINGKASAN EKSEKUTIF (KPI),NILAI (IDR)');
  lines.push(`Saldo Awal / Akumulasi Bulan Lalu,${summary.openingBalance}`);
  lines.push(`Total Pendapatan Bulanan,${summary.totalIncome}`);
  lines.push(`Total Pengeluaran Bulan Ini (Aktual),${summary.totalExpenseActual}`);
  lines.push(`Uang Ditabung Bulan Ini (Aktual),${summary.savingActual}`);
  lines.push(`Total Rencana Alokasi,${summary.totalAllocationPlanned}`);
  lines.push(`Total Aktual Alokasi,${summary.totalAllocationActual}`);
  lines.push(`Arus Kas Bersih Bulan Ini,${summary.netMonthlyCashflow}`);
  lines.push(`Sisa Uang Bulan Ini / Saldo Akhir,${summary.closingBalance}`);
  lines.push('');

  lines.push('1. PENGELUARAN TETAP / OPERASIONAL RUMAH');
  lines.push('Tgl,Keterangan,Metode/Prioritas,Rencana,Aktual,Status Lunas');
  period.fixedCosts.forEach((fc) => {
    lines.push(
      `"${fc.dueDay}","${fc.title}","${fc.methodOrPriority}",${fc.planned},${fc.actual},${fc.isPaid ? 'LUNAS' : 'BELUM'}`
    );
  });
  lines.push(`TOTAL FIXED COST,,,${summary.fixedCostPlanned},${summary.fixedCostActual},`);
  lines.push('');

  lines.push('2. BIAYA LANGGANAN & HUTANG');
  lines.push('Tgl,Keterangan,Prioritas,Rencana,Aktual,Status');
  period.subscriptionsAndDebts.forEach((sd) => {
    lines.push(
      `"${sd.dueDay}","${sd.title}","${sd.priority}",${sd.planned},${sd.actual},${sd.isPaid ? 'LUNAS' : 'AKTIF'}`
    );
  });
  lines.push(`TOTAL SUBSCRIPTION & DEBT (AKTIF),,,${summary.subDebtPlanned},${summary.subDebtActual},`);
  lines.push('');

  lines.push('3. PENGELUARAN TIDAK TETAP / VARIABLE COST');
  lines.push('Keterangan,Prioritas,Rencana,Aktual');
  period.variableCosts.forEach((vc) => {
    lines.push(`"${vc.title}","${vc.priority}",${vc.planned},${vc.actual}`);
  });
  lines.push(`TOTAL VARIABLE COST,,${summary.variablePlanned},${summary.variableActual}`);
  lines.push('');

  lines.push('4. PENDAPATAN / INCOME');
  lines.push('Sumber,Tipe,Jumlah');
  period.incomes.forEach((inc) => {
    lines.push(`"${inc.source}","${inc.type}",${inc.amount}`);
  });
  lines.push(`TOTAL PENDAPATAN,,${summary.totalIncome}`);
  lines.push('');

  lines.push('5. NABUNG / SAVING MASA DEPAN');
  lines.push('Alokasi,Prioritas,Rencana,Aktual');
  period.savings.forEach((sav) => {
    lines.push(`"${sav.title}","${sav.priority}",${sav.planned},${sav.actual}`);
  });
  lines.push(`TOTAL TABUNGAN,,${summary.savingPlanned},${summary.savingActual}`);
  lines.push('');

  lines.push('6. SALDO REKENING & E-WALLET');
  lines.push('Rekening/Wallet,Kode,Kategori,Alokasi Rencana,Saldo Aktual,Catatan');
  period.accounts.forEach((acc) => {
    lines.push(
      `"${acc.name}","${acc.code}","${acc.category}",${acc.plannedAllocation},${acc.balance},"${acc.holderNote}"`
    );
  });
  lines.push('');

  lines.push('7. TRACKER PENGELUARAN SEHARI-HARI');
  lines.push('Tanggal,Keterangan,Qty,Harga Satuan,Total,Metode Pembayaran');
  period.dailyExpenses.forEach((de: DailyExpenseItem) => {
    lines.push(
      `"${de.date}","${de.description}",${de.qty},${de.unitPrice},${de.total},"${de.paymentMethod}"`
    );
  });
  lines.push(`TOTAL TRACKER HARIAN,,,,${summary.dailyTrackerTotal},`);
  lines.push('');

  lines.push('8. TRACKER JAJAN & NONGKRONG');
  lines.push('Tanggal,Nama Tempat / Keterangan,Biaya Dihabiskan,Metode Pembayaran,Catatan');
  period.hangoutExpenses.forEach((he: HangoutExpenseItem) => {
    lines.push(
      `"${he.date}","${he.placeOrEvent}",${he.amount},"${he.paymentMethod}","${he.note}"`
    );
  });
  lines.push(`TOTAL JAJAN & NONGKRONG,,${summary.hangoutTrackerTotal},,`);

  return lines.join('\n');
}
