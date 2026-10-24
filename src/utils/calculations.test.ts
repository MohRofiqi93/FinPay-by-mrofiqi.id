import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAccountBalanceRevision,
  applyOpeningBalanceRevision,
  calculatePeriodSummary,
  computeDailyExpenseTotal,
  createRolloverMonth,
  createSyncQueueItem,
  formatIDR,
} from './calculations';
import { OCTOBER_2026_DATA } from '../data/initialSeedData';

test('October 2026 financial summary matches FINANCIAL_PLANNER.csv exactly', () => {
  const summary = calculatePeriodSummary(OCTOBER_2026_DATA);

  assert.equal(summary.totalIncome, 8_000_000, 'Pendapatan Bulanan should be Rp 8.000.000');
  assert.equal(summary.primaryIncome, 5_000_000, 'Pendapatan Utama should be Rp 5.000.000');
  assert.equal(summary.sideIncome, 3_000_000, 'Pendapatan Sampingan should be Rp 3.000.000');

  assert.equal(summary.fixedCostPlanned, 1_010_000, 'Fixed Cost Rencana should be Rp 1.010.000');
  assert.equal(summary.fixedCostActual, 1_122_000, 'Fixed Cost Aktual should be Rp 1.122.000');

  assert.equal(summary.subDebtPlanned, 695_000, 'Subscription & Debt Rencana should be Rp 695.000');
  assert.equal(summary.subDebtActual, 700_000, 'Subscription & Debt Aktual should be Rp 700.000');

  assert.equal(summary.dailyTrackerTotal, 5_250_000, 'Daily Tracker Total should be Rp 5.250.000');
  assert.equal(summary.dailyTrackerOperationalTotal, 3_250_000, 'Operational Daily Total should be Rp 3.250.000');
  assert.equal(summary.dailyTrackerAiraSavingTotal, 2_000_000, 'Aira Daily Saving Total should be Rp 2.000.000');

  assert.equal(summary.variablePlanned, 4_500_000, 'Variable Cost Rencana should be Rp 4.500.000');
  assert.equal(summary.variableActual, 5_250_000, 'Variable Cost Aktual should be Rp 5.250.000');

  assert.equal(summary.savingPlanned, 4_441_000, 'Saving Rencana should be Rp 4.441.000');
  assert.equal(summary.savingActual, 4_441_000, 'Saving Aktual should be Rp 4.441.000');

  assert.equal(summary.totalExpenseActual, 7_072_000, 'Total Pengeluaran Bulan Ini should be Rp 7.072.000');
  assert.equal(summary.totalAllocationPlanned, 10_646_000, 'Total Rencana should be Rp 10.646.000');
  assert.equal(summary.totalAllocationActual, 11_513_000, 'Total Aktual should be Rp 11.513.000');
  assert.equal(summary.closingBalance, -3_513_000, 'Sisa Uang Bulan Ini should be -Rp 3.513.000');

  assert.equal(summary.totalCodExpenses, 470_000, 'Total COD should be Rp 470.000');
  assert.equal(summary.totalTfExpenses, 300_000, 'Total TF should be Rp 300.000');
  assert.equal(summary.totalBankBalance, 4_522_000, 'Total Bank Balance (BCA+BRI+BSI) should be Rp 4.522.000');
});

test('Rollover new month carries over closing balance and resets actuals and daily trackers', () => {
  const decPeriod = createRolloverMonth(OCTOBER_2026_DATA, '2026-12', 'Desember 2026');
  const decSummary = calculatePeriodSummary(decPeriod);

  assert.equal(decPeriod.openingBalanceCarryOver, -3_513_000);
  assert.equal(decSummary.openingBalance, -3_513_000);
  assert.equal(decSummary.fixedCostActual, 0);
  assert.equal(decSummary.dailyTrackerTotal, 0);
  assert.equal(decSummary.hangoutTrackerTotal, 0);
  assert.equal(decPeriod.fixedCosts.length, OCTOBER_2026_DATA.fixedCosts.length);
});

test('Manual opening balance revision updates closing balance dynamically', () => {
  const revised = applyOpeningBalanceRevision(
    OCTOBER_2026_DATA,
    5_000_000,
    'Penyesuaian kas riil di brankas & rekening'
  );
  const summary = calculatePeriodSummary(revised);

  assert.equal(summary.isOpeningBalanceRevised, true);
  assert.equal(summary.openingBalance, 5_000_000);
  // -3,513,000 + 5,000,000 = +1,487,000
  assert.equal(summary.closingBalance, 1_487_000);
  assert.equal(revised.revisionHistory[0].delta, 5_000_000);
});

test('Account balance revision updates bank total and records audit log', () => {
  const revised = applyAccountBalanceRevision(
    OCTOBER_2026_DATA,
    'acc-bca',
    2_500_000,
    'Transfer masuk bonus proyek ke BCA'
  );
  const summary = calculatePeriodSummary(revised);

  assert.equal(summary.totalBankBalance, 4_522_000 + 2_500_000);
  assert.equal(revised.revisionHistory[0].targetName, 'Bank BCA — Bulanan');
});

test('Daily expense multiplication and Sync Queue item integrity', () => {
  assert.equal(computeDailyExpenseTotal(4, 52_000), 208_000);
  assert.equal(formatIDR(-3_513_000), '-Rp 3.513.000');

  const qItem = createSyncQueueItem(
    '2026-10',
    'Oktober 2026',
    'ADD_DAILY_EXPENSE',
    'Tambah Mie Gacoan Rp 208.000',
    { total: 208_000 }
  );
  assert.equal(qItem.isSynced, false);
  assert.ok(qItem.checksumSha256.startsWith('sha256:'));
  assert.ok(qItem.encryptedPayloadPreview.startsWith('AES256-GCM::'));
});

test('Revising a daily expense updates tracker total, variable cost, and closing balance, and Pak Syamsul is removed', () => {
  assert.equal(
    OCTOBER_2026_DATA.specialLiabilities.some((l) => l.title.toLowerCase().includes('pak syamsul')),
    false,
    'Pak Syamsul contact note should be removed from specialLiabilities'
  );

  // Revise 2026-10-de2 (Thug Antiperspirant Deodorant: 4 x 25.000 = 100.000 COD -> 5 x 30.000 = 150.000 COD)
  const updatedPeriod = {
    ...OCTOBER_2026_DATA,
    dailyExpenses: OCTOBER_2026_DATA.dailyExpenses.map((d) =>
      d.id === '2026-10-de2'
        ? { ...d, qty: 5, unitPrice: 30_000, total: computeDailyExpenseTotal(5, 30_000) }
        : d
    ),
  };

  const summary = calculatePeriodSummary(updatedPeriod);
  assert.equal(summary.dailyTrackerTotal, 5_300_000, 'Daily tracker total should increase by +50.000');
  assert.equal(summary.totalCodExpenses, 520_000, 'Total COD should increase from 470.000 to 520.000');
  assert.equal(summary.totalExpenseActual, 7_122_000, 'Total monthly expense should increase by +50.000');
  assert.equal(summary.closingBalance, -3_563_000, 'Closing balance should reflect the +50.000 expense revision');
});

test('Strict Owner Approval (itptgaramofficial@gmail.com), 5-minute token expiry, and 3-token/day rate limit', async () => {
  const {
    OWNER_VERIFIED_EMAIL,
    TOKEN_VALIDITY_MS,
    canRequestTokenToday,
    formatCountdownMMSS,
    getInitialDailyQuota,
    hashOtpToken,
    hashUserPassword,
    recordTokenIssued,
    validateRegistrationInput,
    verifyApprovedOtpAndActivate,
    verifyLoginCredentials,
  } = await import('./auth');

  // 1. Rejects non-owner email & short passwords
  assert.equal(validateRegistrationInput('mrofiqi.id', 'rahasia123', 'other@gmail.com').valid, false);
  assert.equal(validateRegistrationInput('mrofiqi.id', '123', OWNER_VERIFIED_EMAIL).valid, false);
  assert.equal(validateRegistrationInput('mrofiqi.id', 'rahasia123', OWNER_VERIFIED_EMAIL).valid, true);

  const day1 = new Date('2026-10-24T10:00:00.000Z');
  let quota = getInitialDailyQuota(day1);
  assert.equal(canRequestTokenToday(quota, day1).allowed, true);
  assert.equal(canRequestTokenToday(quota, day1).remainingTokens, 3);

  const reqId = 'req-test-001';
  const realOtp = '482910';

  // 2. Cannot verify OTP BEFORE owner approves in itptgaramofficial@gmail.com
  const unapprovedPending = {
    requestId: reqId,
    username: 'mrofiqi.id',
    email: OWNER_VERIFIED_EMAIL,
    passwordHash: hashUserPassword('mrofiqi.id', 'rahasia123'),
    status: 'WAITING_OWNER_APPROVAL' as const,
    createdAt: day1.toISOString(),
    approvedAt: null,
    tokenExpiresAt: null,
    expectedOtpHash: hashOtpToken(reqId, realOtp),
    tokensUsedToday: 0,
    failedAttemptsToday: 0,
  };

  const beforeApproveAttempt = verifyApprovedOtpAndActivate(unapprovedPending, realOtp, quota, day1);
  assert.equal(beforeApproveAttempt.success, false, 'Must reject token if owner has not clicked Approve yet');

  // 3. Owner approves -> token is valid for exactly 5 minutes (300 seconds)
  const expiresAt = new Date(day1.getTime() + TOKEN_VALIDITY_MS).toISOString();
  assert.equal(formatCountdownMMSS(300), '05:00');

  const approvedPending = {
    ...unapprovedPending,
    status: 'APPROVED_TOKEN_SENT' as const,
    approvedAt: day1.toISOString(),
    tokenExpiresAt: expiresAt,
  };

  // Test after 5 minutes + 1 second -> must fail as expired
  const afterFiveMin = new Date(day1.getTime() + TOKEN_VALIDITY_MS + 1000);
  const expiredResult = verifyApprovedOtpAndActivate(approvedPending, realOtp, quota, afterFiveMin);
  assert.equal(expiredResult.success, false, 'Must reject token after 5 minutes');

  // Test wrong OTP 3 times -> locks account creation for the rest of the day
  const wrong1 = verifyApprovedOtpAndActivate(approvedPending, '000001', quota, day1);
  assert.equal(wrong1.success, false);
  assert.equal(wrong1.updatedQuota.lockedUntilNextDay, false);

  const wrong2 = verifyApprovedOtpAndActivate(approvedPending, '000002', wrong1.updatedQuota, day1);
  assert.equal(wrong2.success, false);
  assert.equal(wrong2.updatedQuota.lockedUntilNextDay, false);

  const wrong3 = verifyApprovedOtpAndActivate(approvedPending, '000003', wrong2.updatedQuota, day1);
  assert.equal(wrong3.success, false);
  assert.equal(wrong3.updatedQuota.lockedUntilNextDay, true, '3rd wrong attempt must lock until tomorrow');
  assert.equal(canRequestTokenToday(wrong3.updatedQuota, day1).allowed, false);

  // Next calendar day -> quota resets automatically!
  const day2 = new Date('2026-10-25T08:00:00.000Z');
  assert.equal(canRequestTokenToday(wrong3.updatedQuota, day2).allowed, true);
  assert.equal(canRequestTokenToday(wrong3.updatedQuota, day2).remainingTokens, 3);

  // Test 3 tokens issued in a single day limit
  let day2Quota = getInitialDailyQuota(day2);
  day2Quota = recordTokenIssued(day2Quota, day2);
  day2Quota = recordTokenIssued(day2Quota, day2);
  day2Quota = recordTokenIssued(day2Quota, day2);
  assert.equal(canRequestTokenToday(day2Quota, day2).allowed, false, '4th token request on same day must be blocked');

  // Valid OTP within 5 minutes activates account & enables login
  const freshQuota = getInitialDailyQuota(day1);
  const validResult = verifyApprovedOtpAndActivate(approvedPending, realOtp, freshQuota, day1);
  assert.equal(validResult.success, true);
  assert.ok(validResult.account);
  assert.equal(validResult.account.isApprovedByOwner, true);
  assert.equal(verifyLoginCredentials(validResult.account, 'mrofiqi.id', 'rahasia123').success, true);
});

test('Master 3D Portal login verifies secret credentials via hash comparison and rejects wrong inputs', async () => {
  const { verifyMasterPortalLogin, computeLiveKeystrokeSignature } = await import('./auth');

  // Empty or wrong credentials must be rejected
  assert.equal(verifyMasterPortalLogin('', '').success, false);
  assert.equal(verifyMasterPortalLogin('admin', 'admin123').success, false);
  assert.equal(verifyMasterPortalLogin('mrofiqi.id2026', 'wrongpass').success, false);

  // Exact secret credentials must succeed
  const okResult = verifyMasterPortalLogin('mrofiqi.id2026', 'mrofiqi.id2026!@');
  assert.equal(okResult.success, true);
  assert.ok(okResult.sessionSignature?.startsWith('sha256:'));

  // Keystroke signature updates deterministically
  assert.equal(computeLiveKeystrokeSignature('', ''), 'sha256:0000000000000000');
  assert.notEqual(computeLiveKeystrokeSignature('user', 'pass'), 'sha256:0000000000000000');
});




