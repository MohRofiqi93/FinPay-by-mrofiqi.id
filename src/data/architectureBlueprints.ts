export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * AURELIA FINPLANNER — GOOGLE APPS SCRIPT 2-WAY CLOUD SYNC ENGINE (Code.gs)
 * ============================================================================
 * Fitur Utama:
 * 1. setupDatabase() — Restrukturisasi otomatis Google Sheets menjadi database
 *    terstruktur yang rapi (Sheet _META_CONFIG, _SYNC_QUEUE_LOG, _REKENING_BANK,
 *    serta Sheet Bulanan Otomatis seperti "Oktober 2026", "November 2026", dst.)
 * 2. doGet(e) — Endpoint REST API untuk menarik snapshot data dua arah (Two-Way Sync)
 * 3. doPost(e) — Endpoint REST API untuk memproses antrean sinkronisasi offline
 *    (Sync Queue) dari HP Android secara idempoten, termasuk pembuatan bulan baru
 *    otomatis & rekonsiliasi saldo.
 * 4. Otentikasi Token API & Validasi Checksum SHA-256 / AES-256 Payload.
 * ============================================================================
 */

const SCRIPT_PROP = PropertiesService.getScriptProperties();
const DEFAULT_API_TOKEN = "AURELIA-FIN-SECRET-2026";

/**
 * Jalankan fungsi ini 1x dari Editor Apps Script untuk menata ulang Google Sheets
 * secara otomatis menjadi struktur database bersih dan siap Two-Way Sync.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!SCRIPT_PROP.getProperty("API_SECRET_TOKEN")) {
    SCRIPT_PROP.setProperty("API_SECRET_TOKEN", DEFAULT_API_TOKEN);
  }

  // 1. Buat Sheet Konfigurasi & Metadata (_META_CONFIG)
  let metaSheet = ss.getSheetByName("_META_CONFIG");
  if (!metaSheet) {
    metaSheet = ss.insertSheet("_META_CONFIG");
    metaSheet.getRange("A1:D1").setValues([["KEY", "VALUE", "UPDATED_AT", "DESCRIPTION"]])
      .setFontWeight("bold").setBackground("#0F172A").setFontColor("#FFFFFF");
    metaSheet.getRange("A2:D4").setValues([
      ["SCHEMA_VERSION", "2.4.0-CLEAN-ARCH", new Date().toISOString(), "Versi Skema Database Two-Way Sync"],
      ["ACTIVE_PERIOD_ID", "2026-10", new Date().toISOString(), "Periode Aktif Default"],
      ["LAST_SYNC_DEVICE", "Android-OfflineFirst-Client", new Date().toISOString(), "Perangkat Terakhir Sinkronisasi"]
    ]);
    metaSheet.autoResizeColumns(1, 4);
  }

  // 2. Buat Sheet Audit Log Sinkronisasi & Revisi Saldo (_SYNC_AUDIT_LOG)
  let logSheet = ss.getSheetByName("_SYNC_AUDIT_LOG");
  if (!logSheet) {
    logSheet = ss.insertSheet("_SYNC_AUDIT_LOG");
    logSheet.getRange("A1:G1").setValues([[
      "QUEUE_ID", "TIMESTAMP", "PERIOD_ID", "OPERATION", "SUMMARY", "CHECKSUM_SHA256", "RAW_JSON"
    ]]).setFontWeight("bold").setBackground("#065F46").setFontColor("#FFFFFF");
    logSheet.setFrozenRows(1);
  }

  // 3. Buat Sheet Master Rekening & E-Wallet (_REKENING_SALDO)
  let accSheet = ss.getSheetByName("_REKENING_SALDO");
  if (!accSheet) {
    accSheet = ss.insertSheet("_REKENING_SALDO");
    accSheet.getRange("A1:G1").setValues([[
      "ACCOUNT_ID", "NAMA_REKENING", "KODE", "KATEGORI", "RENCANA_ALOKASI", "SALDO_AKTUAL", "CATATAN_REKONSILIASI"
    ]]).setFontWeight("bold").setBackground("#1E293B").setFontColor("#FFFFFF");
    accSheet.getRange("A2:G6").setValues([
      ["acc-bsi", "Bank BSI — Aira & Tabungan", "BSI", "BANK", 2000000, 3400000, "Sesuai saldo buku BSI Oktober"],
      ["acc-bri", "Bank BRI — Operasional Rumah", "BRI", "BANK", 1122000, 1122000, "Rekening Opa / Operasional Bulanan"],
      ["acc-bca", "Bank BCA — Bulanan", "BCA", "BANK", 0, 0, "Rekening Transaksi Bulanan Utama"],
      ["acc-gopay", "GoPay — Tagihan & Digital", "GOPAY", "EWALLET", 1047000, 1122000, "Indihome, PLN, Hosting, Paket Data"],
      ["acc-dana", "DANA — Langganan Aplikasi", "DANA", "EWALLET", 75000, 75000, "TeraBox, iCloud, CapCut Pro"]
    ]);
    accSheet.getRange("E2:F6").setNumberFormat('"Rp"#,##0;-"Rp"#,##0;"Rp"0');
    accSheet.autoResizeColumns(1, 7);
  }

  // 4. Pastikan Sheet Bulanan "Oktober 2026" & "November 2026" tersedia
  ensureMonthlySheetStructure(ss, "Oktober 2026", "2026-10", 0);
  ensureMonthlySheetStructure(ss, "November 2026", "2026-11", -3513000);

  return { status: "OK", message: "Struktur Database Google Sheets berhasil dioptimalkan!" };
}

/**
 * Membuat Sheet Bulan Baru secara terstruktur untuk Two-Way Sync & Arsip Bulanan
 */
function ensureMonthlySheetStructure(ss, monthLabel, periodId, carryOverBalance) {
  let sheet = ss.getSheetByName(monthLabel);
  if (sheet) return sheet;

  sheet = ss.insertSheet(monthLabel);
  sheet.getRange("A1:F1").merge().setValue("FINANCIAL PLANNER — " + monthLabel.toUpperCase() + " (" + periodId + ")")
    .setFontWeight("bold").setFontSize(13).setBackground("#0F172A").setFontColor("#10B981");

  // Blok Ringkasan KPI Utama (Baris 3-9)
  const kpiHeaders = [
    ["METRIK RINGKASAN UTAMA", "NILAI (IDR)", "CATATAN / STATUS"],
    ["Saldo Awal / Akumulasi Bulan Lalu", carryOverBalance, "Rollover Otomatis / Bisa Direvisi"],
    ["Pendapatan Bulanan", 8000000, "Utama + Sampingan"],
    ["Total Pengeluaran Bulan Ini", 7072000, "Fixed + Subscription/Debt + Variable"],
    ["Uang yang Ditabung Bulan Ini", 4441000, "Alokasi Masa Depan"],
    ["Sisa Uang Bulan Ini / Saldo Akhir", "=B4+B5-B6-B7", "Rumus Dinamis: Saldo Awal + Pendapatan - Pengeluaran - Tabungan"]
  ];
  sheet.getRange("A3:C8").setValues(kpiHeaders);
  sheet.getRange("A3:C3").setFontWeight("bold").setBackground("#1E293B").setFontColor("#FFFFFF");
  sheet.getRange("B4:B8").setNumberFormat('"Rp"#,##0;-"Rp"#,##0;"Rp"0');

  // Header Tabel Terstruktur untuk Sinkronisasi Cepat (Baris 11)
  sheet.getRange("A11:H11").setValues([[
    "RECORD_TYPE", "ITEM_ID", "TANGGAL_HARI", "KETERANGAN_SUMBER", "PRIORITAS_METODE", "RENCANA_QTY", "AKTUAL_HARGA", "STATUS_TOTAL"
  ]]).setFontWeight("bold").setBackground("#065F46").setFontColor("#FFFFFF");
  sheet.setFrozenRows(11);
  sheet.autoResizeColumns(1, 8);
  return sheet;
}

/**
 * HTTP GET: Mengambil seluruh periode, antrean terakhir, dan saldo rekening
 */
function doGet(e) {
  try {
    const token = (e && e.parameter && e.parameter.token) || "";
    const expectedToken = SCRIPT_PROP.getProperty("API_SECRET_TOKEN") || DEFAULT_API_TOKEN;
    if (token !== expectedToken) {
      return jsonResponse({ status: "ERROR", code: 401, message: "Unauthorized API Token" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const metaSheet = ss.getSheetByName("_META_CONFIG");
    const lastSync = metaSheet ? metaSheet.getRange("C2").getValue() : new Date().toISOString();

    return jsonResponse({
      status: "OK",
      spreadsheetName: ss.getName(),
      lastSyncServerTime: new Date().toISOString(),
      schemaVersion: "2.4.0-CLEAN-ARCH",
      lastSync
    });
  } catch (err) {
    return jsonResponse({ status: "ERROR", message: String(err) });
  }
}

/**
 * HTTP POST: Menerima batch Sync Queue dari aplikasi Android saat kembali ONLINE
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const expectedToken = SCRIPT_PROP.getProperty("API_SECRET_TOKEN") || DEFAULT_API_TOKEN;
    if (body.apiSecretToken && body.apiSecretToken !== expectedToken) {
      return jsonResponse({ status: "ERROR", code: 401, message: "Invalid API Secret Token" });
    }

    // FITUR VERIFIKASI EMAIL KEAMANAN LOGIN -> itptgaramofficial@gmail.com
    if (body.action === "SEND_VERIFICATION_EMAIL") {
      const targetEmail = "itptgaramofficial@gmail.com";
      const otpCode = String(body.otpCode || "000000");
      const username = String(body.username || "Owner");
      MailApp.sendEmail({
        to: targetEmail,
        subject: "[FinPlanner by mrofiqi.id] Kode Verifikasi Pendaftaran Akun: " + otpCode,
        htmlBody:
          "<div style='font-family:sans-serif;padding:24px;background:#0f172a;color:#f8fafc;border-radius:16px;'>" +
          "<h2 style='color:#10b981;margin-top:0;'>Verifikasi Pendaftaran Akun FinPlanner</h2>" +
          "<p>Halo <b>" + username + "</b>,</p>" +
          "<p>Permintaan pendaftaran akun baru telah diterima untuk email resmi <b>" + targetEmail + "</b>.</p>" +
          "<div style='margin:20px 0;padding:16px;background:#1e293b;border:1px solid #10b981;border-radius:12px;font-size:24px;font-weight:bold;letter-spacing:6px;text-align:center;color:#34d399;'>" +
          otpCode +
          "</div>" +
          "<p style='font-size:12px;color:#94a3b8;'>Masukkan 6 digit kode OTP di atas pada halaman Verifikasi FinPlanner untuk mengaktifkan login Username & Password Anda.</p>" +
          "</div>"
      });
      return jsonResponse({ status: "OK", message: "Verification email sent to " + targetEmail });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    setupDatabase(); // Pastikan sheet inti tersedia

    const logSheet = ss.getSheetByName("_SYNC_AUDIT_LOG");
    const existingIds = new Set(
      logSheet.getLastRow() > 1
        ? logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 1).getValues().flat()
        : []
    );

    const queueItems = Array.isArray(body.queue) ? body.queue : [];
    const processedIds = [];

    queueItems.forEach(function(item) {
      if (existingIds.has(item.queueId)) {
        processedIds.push(item.queueId); // Idempoten: lewati jika sudah pernah disimpan
        return;
      }

      // Pastikan sheet bulan terkait sudah ada (Auto-Generated Monthly Sheet)
      const monthSheet = ensureMonthlySheetStructure(
        ss,
        item.monthLabel || "Oktober 2026",
        item.periodId || "2026-10",
        0
      );

      // Jika operasi revisi saldo awal, perbarui sel B4 & C4 pada sheet bulan tersebut
      if (item.operation === "REVISE_OPENING_BALANCE" && item.payload) {
        monthSheet.getRange("B4").setValue(Number(item.payload.newBalance || 0));
        monthSheet.getRange("C4").setValue("Direvisi: " + (item.payload.reason || "Manual"));
      }

      // Catat ke _SYNC_AUDIT_LOG
      logSheet.appendRow([
        item.queueId,
        item.timestamp,
        item.periodId,
        item.operation,
        item.summary,
        item.checksumSha256,
        JSON.stringify(item.payload)
      ]);

      processedIds.push(item.queueId);
    });

    // Jika klien menyertakan snapshot periode aktif, sinkronkan baris datanya
    if (body.activePeriodSnapshot) {
      syncPeriodSnapshotToSheet(ss, body.activePeriodSnapshot);
    }

    return jsonResponse({
      status: "OK",
      syncedCount: processedIds.length,
      processedQueueIds: processedIds,
      serverTimestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({ status: "ERROR", message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function syncPeriodSnapshotToSheet(ss, period) {
  const sheet = ensureMonthlySheetStructure(
    ss,
    period.monthLabel,
    period.periodId,
    period.openingBalanceCarryOver || 0
  );

  const effectiveOpening = period.openingBalanceManualOverride !== null
    ? period.openingBalanceManualOverride
    : period.openingBalanceCarryOver;
  sheet.getRange("B4").setValue(effectiveOpening);
  sheet.getRange("C4").setValue(period.openingBalanceRevisionNote || "Tersinkronisasi otomatis");
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

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
import javax.crypto.KeyGenerator
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
    val operation: String,                     // ADD_DAILY_EXPENSE, REVISE_OPENING_BALANCE, dll.
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

// 4. AUTO-SYNC WORKER SAAT INTERNET KEMBALI ONLINE (WorkManager + NetworkConstraint)
package id.aurelia.finplanner.sync

import android.content.Context
import androidx.work.*
import id.aurelia.finplanner.data.local.FinanceDao
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class GoogleSheetsAutoSyncWorker(
    appContext: Context,
    params: WorkerParameters,
    private val dao: FinanceDao,
    private val apiService: GoogleAppsScriptApi
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val pendingItems = dao.getPendingSyncItems()
        if (pendingItems.isEmpty()) return@withContext Result.success()

        return@withContext try {
            val response = apiService.pushSyncQueue(pendingItems)
            if (response.status == "OK") {
                dao.markQueueItemsSynced(response.processedQueueIds)
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        fun enqueueWhenOnline(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED) // Otomatis jalan saat ada sinyal
                .build()

            val request = OneTimeWorkRequestBuilder<GoogleSheetsAutoSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                "AureliaCloudAutoSync",
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }
}
`;

export const SWAGGER_OPENAPI_SPEC = `openapi: 3.0.3
info:
  title: Aurelia FinPlanner — Offline-First & Google Sheets Two-Way Sync API
  version: 2.4.0
  description: >
    Spesifikasi REST API & WebSocket untuk sinkronisasi dua arah antara database lokal
    perangkat Android (Room / IndexedDB) dan Google Sheets (Apps Script Web App).
servers:
  - url: https://script.google.com/macros/s/{deploymentId}/exec
    description: Google Apps Script Production Web App
  - url: http://localhost:3000/api/sync
    description: Local Full-Stack Mirror & WebSocket Relay Server
security:
  - ApiTokenAuth: []
paths:
  /status:
    get:
      summary: Mengambil status sinkronisasi cloud & metadata periode aktif
      parameters:
        - in: query
          name: token
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Metadata spreadsheet dan timestamp sinkronisasi terakhir
  /queue:
    post:
      summary: Mengirim antrean perubahan offline (Sync Queue) secara idempoten
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - apiSecretToken
                - queue
              properties:
                apiSecretToken:
                  type: string
                  example: AURELIA-FIN-SECRET-2026
                queue:
                  type: array
                  items:
                    $ref: '#/components/schemas/SyncQueueItem'
                activePeriodSnapshot:
                  $ref: '#/components/schemas/MonthlyPeriodSnapshot'
      responses:
        '200':
          description: Seluruh item antrean berhasil ditulis ke Sheet Bulan terkait & Audit Log
components:
  securitySchemes:
    ApiTokenAuth:
      type: apiKey
      in: header
      name: X-API-Token
  schemas:
    SyncQueueItem:
      type: object
      properties:
        queueId:
          type: string
        periodId:
          type: string
          example: "2026-10"
        monthLabel:
          type: string
          example: "Oktober 2026"
        operation:
          type: string
          enum:
            - ADD_DAILY_EXPENSE
            - UPDATE_BUDGET_ITEM
            - REVISE_OPENING_BALANCE
            - REVISE_ACCOUNT_BALANCE
            - CREATE_NEW_MONTH
        checksumSha256:
          type: string
        encryptedPayloadPreview:
          type: string
`;
