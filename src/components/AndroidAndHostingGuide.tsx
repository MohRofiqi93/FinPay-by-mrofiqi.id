import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderGit2,
  Globe,
  PackageCheck,
  Server,
  Smartphone,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const GITHUB_WORKFLOW_SUMMARY = `# File ini SUDAH OTOMATIS ADA di project Anda:
# Lokasi: .github/workflows/build-android-apk-aab.yml
#
# Setiap kali Anda push/simpan kode ke GitHub, server GitHub Actions
# otomatis membuatkan 4 file siap pakai di menu "Actions" -> "Artifacts":
# 1. FinPlanner-mrofiqi-release.apk     (Sudah Signed — Langsung Install di HP Android!)
# 2. FinPlanner-mrofiqi-debug.apk       (Versi Debug APK)
# 3. FinPlanner-mrofiqi-release.aab     (Android App Bundle untuk Google Play Store)
# 4. rumahweb-cpanel-mrofiqi-id.zip     (Siap Upload & Extract di cPanel Rumahweb mrofiqi.id)`;

const HTACCESS_CODE = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{HTTPS} off
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>`;

export const AndroidAndHostingGuide: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeGuideTab, setActiveGuideTab] = useState<'APK_AAB' | 'RUMAHWEB' | 'PWABUILDER'>('APK_AAB');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showManualInstallTip, setShowManualInstallTip] = useState(false);

  const handleCopy = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <section
      id="android-hosting-center"
      className="rounded-2xl bg-slate-900 border border-emerald-500/40 p-6 space-y-5"
    >
      {/* HEADER & TOMBOL INSTALL LANGSUNG DI HP ANDROID */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3">
          <Smartphone className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Pusat Build Android (.APK & .AAB) + Tutorial Hosting Rumahweb (mrofiqi.id)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Project ini sudah dilengkapi <strong>GitHub Actions Auto-Builder (.apk & .aab)</strong>, konfigurasi <strong>Capacitor Android (`id.mrofiqi.finplanner`)</strong>, serta <strong>`.htaccess` cPanel Rumahweb</strong>.
            </p>
          </div>
        </div>

        {/* Tombol In-App Install PWA / Android */}
        <div className="flex items-center gap-2">
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Install Langsung di HP Sekarang</span>
            </button>
          )}
          {!isInstalled && !isInstallable && (
            <button
              type="button"
              onClick={() => setShowManualInstallTip((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{isIOS ? 'Cara Install di iPhone' : 'Cara Install Instan di HP Android'}</span>
            </button>
          )}
          {isInstalled && (
            <span className="text-xs font-mono text-emerald-400">
              Terinstal di Perangkat
            </span>
          )}
        </div>
      </div>

      {showManualInstallTip && (
        <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 text-xs text-slate-300 space-y-1.5">
          <p className="font-semibold text-emerald-400">
            Cara Install Langsung Tanpa Menunggu Build APK (10 Detik):
          </p>
          <p>
            1. Buka alamat website aplikasi ini (atau nanti setelah online di <strong>https://fin.mrofiqi.id</strong>) menggunakan browser <strong>Google Chrome</strong> di HP Android Anda.
          </p>
          <p>
            2. Ketuk ikon <strong>Titik Tiga (⋮)</strong> di pojok kanan atas Chrome, lalu pilih <strong>"Tambahkan ke Layar Utama" / "Install Aplikasi"</strong>. Aplikasi langsung terpasang dengan ikon <strong>FinPlanner</strong> di menu HP Anda dan bisa dibuka <strong>100% Offline</strong>!
          </p>
        </div>
      )}

      {/* TAB PILIHAN TUTORIAL */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveGuideTab('APK_AAB')}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeGuideTab === 'APK_AAB'
              ? 'bg-emerald-500 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>1. Ambil File .APK & .AAB via GitHub (Otomatis)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveGuideTab('RUMAHWEB')}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeGuideTab === 'RUMAHWEB'
              ? 'bg-emerald-500 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>2. Tutorial Hosting Rumahweb (mrofiqi.id)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveGuideTab('PWABUILDER')}
          className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeGuideTab === 'PWABUILDER'
              ? 'bg-emerald-500 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>3. Alternatif 1-Klik .APK & .AAB (PWABuilder)</span>
        </button>
      </div>

      {/* ISI TAB 1: GITHUB ACTIONS AUTO BUILDER (.APK & .AAB) */}
      {activeGuideTab === 'APK_AAB' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
            <p className="font-semibold text-emerald-300 text-sm">
              Kabar Baik: Anda TIDAK Perlu Install Android Studio di Laptop!
            </p>
            <p className="text-slate-300 leading-relaxed">
              Karena Anda sudah punya akun <strong>GitHub</strong>, kami sudah menanamkan robot pembuat APK & AAB otomatis di dalam project ini (file <code>.github/workflows/build-android-apk-aab.yml</code> dan <code>capacitor.config.json</code> dengan Package ID <code>id.mrofiqi.finplanner</code>).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-mono text-emerald-400 font-semibold">LANGKAH 1</span>
              <h3 className="text-sm font-semibold text-slate-100">Simpan ke GitHub Anda</h3>
              <p className="text-slate-400 leading-relaxed">
                Klik tombol <strong>Export / Sync to GitHub</strong> di pojok atas AI Studio (atau upload file project ini ke Repository baru di akun GitHub Anda, misalnya <code>finplanner-mrofiqi</code>).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-mono text-amber-300 font-semibold">LANGKAH 2</span>
              <h3 className="text-sm font-semibold text-slate-100">Buka Menu "Actions" di GitHub</h3>
              <p className="text-slate-400 leading-relaxed">
                Buka repository Anda di GitHub.com → klik tab <strong>Actions</strong> di bagian atas. Anda akan melihat proses <strong>"Build Android APK & AAB + Paket Hosting Rumahweb"</strong> berjalan otomatis selama ±3 menit hingga centang hijau.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-mono text-sky-400 font-semibold">LANGKAH 3</span>
              <h3 className="text-sm font-semibold text-slate-100">Download .APK, .AAB & .ZIP</h3>
              <p className="text-slate-400 leading-relaxed">
                Klik hasil proses yang sudah centang hijau tersebut, gulir ke bagian paling bawah (<strong>Artifacts</strong>), lalu klik <strong>Paket-Lengkap-APK-AAB-dan-Hosting-mrofiqi-id</strong> untuk mengunduh:
              </p>
              <ul className="text-slate-300 font-mono text-[11px] space-y-1 pt-1">
                <li>• FinPlanner-mrofiqi-release.apk</li>
                <li>• FinPlanner-mrofiqi-release.aab</li>
                <li>• rumahweb-cpanel-mrofiqi-id.zip</li>
              </ul>
            </div>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
            <code>{GITHUB_WORKFLOW_SUMMARY}</code>
          </pre>
        </div>
      )}

      {/* ISI TAB 2: TUTORIAL HOSTING RUMAHWEB (mrofiqi.id) */}
      {activeGuideTab === 'RUMAHWEB' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Tutorial Lengkap Upload ke Hosting Rumahweb (Domain: mrofiqi.id)
                </h3>
              </div>
              <span className="font-mono text-[11px] text-emerald-400">
                new.clientzone.rumahweb.com
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <p className="font-semibold text-emerald-400">
                  Tahap 1: Login Clientzone Rumahweb & Masuk cPanel
                </p>
                <ol className="list-decimal list-inside text-slate-300 space-y-1 leading-relaxed">
                  <li>Buka <strong>https://new.clientzone.rumahweb.com/</strong> dan login dengan akun Anda.</li>
                  <li>Pilih menu <strong>Hosting</strong> di sebelah kiri → klik tombol <strong>Manage</strong> pada layanan hosting <code>mrofiqi.id</code>.</li>
                  <li>Klik tombol <strong>Login to cPanel</strong>.</li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <p className="font-semibold text-amber-300">
                  Tahap 2: Buat Subdomain Khusus (Rekomendasi: fin.mrofiqi.id)
                </p>
                <ol className="list-decimal list-inside text-slate-300 space-y-1 leading-relaxed">
                  <li>Di dalam cPanel, cari menu <strong>Domains</strong> → klik <strong>Create A New Domain</strong>.</li>
                  <li>Ketik <code>fin.mrofiqi.id</code> (atau <code>planner.mrofiqi.id</code>).</li>
                  <li>Hilangkan centang <em>"Share document root"</em> agar foldernya terpisah rapi di <code>fin.mrofiqi.id</code>, lalu klik <strong>Submit</strong>.</li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <p className="font-semibold text-sky-400">
                  Tahap 3: Upload File ZIP ke File Manager cPanel
                </p>
                <ol className="list-decimal list-inside text-slate-300 space-y-1 leading-relaxed">
                  <li>Di cPanel, buka menu <strong>File Manager</strong> → masuk ke folder <code>fin.mrofiqi.id</code> (atau <code>public_html</code> jika ingin di domain utama).</li>
                  <li>Klik tombol <strong>Upload</strong> di bagian atas → pilih file <strong><code>rumahweb-cpanel-mrofiqi-id.zip</code></strong> yang Anda dapat dari GitHub Actions (atau hasil perintah <code>npm run build</code> folder <code>dist</code>).</li>
                  <li>Klik kanan pada file <code>.zip</code> tersebut → pilih <strong>Extract</strong>.</li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <p className="font-semibold text-emerald-400">
                  Tahap 4: Selesai! Aplikasi Online & Bisa Diakses di HP/Laptop
                </p>
                <ol className="list-decimal list-inside text-slate-300 space-y-1 leading-relaxed">
                  <li>Buka <strong>https://fin.mrofiqi.id</strong> di browser HP atau laptop Anda.</li>
                  <li>File <code>.htaccess</code> sudah otomatis terpasang sehingga SSL HTTPS, mode Offline (Service Worker), dan Auto-Sync Google Sheets langsung berjalan lancar!</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">
              Isi file <code>public/.htaccess</code> (sudah otomatis disertakan di dalam hasil build):
            </span>
            <button
              type="button"
              onClick={() => handleCopy(HTACCESS_CODE, 'htaccess')}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === 'htaccess' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'htaccess' ? 'Tersalin' : 'Salin .htaccess'}</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
            <code>{HTACCESS_CODE}</code>
          </pre>
        </div>
      )}

      {/* ISI TAB 3: PWABUILDER 1-CLICK APK & AAB */}
      {activeGuideTab === 'PWABUILDER' && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
          <h3 className="text-sm font-semibold text-slate-100">
            Cara Alternatif Paling Mudah: Buat .APK & .AAB dari Website mrofiqi.id lewat PWABuilder (Resmi Microsoft)
          </h3>
          <p className="text-slate-300 leading-relaxed">
            Aplikasi ini sudah kami lengkapi dengan standar penuh <strong>Web App Manifest (`manifest.webmanifest`)</strong>, <strong>Service Worker Offline</strong>, dan <strong>Ikon 192px & 512px Maskable</strong>. Begitu website Anda aktif di <code>https://fin.mrofiqi.id</code>:
          </p>
          <ol className="list-decimal list-inside text-slate-300 space-y-2 leading-relaxed">
            <li>
              Buka situs gratis <strong>https://www.pwabuilder.com</strong> di browser Anda.
            </li>
            <li>
              Masukkan alamat domain Anda (misal: <code>https://fin.mrofiqi.id</code>) lalu klik <strong>Start</strong>.
            </li>
            <li>
              Klik tombol <strong>Package for Stores</strong> → pada bagian <strong>Android</strong> klik <strong>Generate Package</strong>.
            </li>
            <li>
              Anda akan langsung mendapatkan 1 file ZIP berisi <strong>file `.apk`</strong> (siap dikirim via WhatsApp/Telegram ke HP Android Anda dan langsung di-install!) serta <strong>file `.aab`</strong> beserta kunci penandatanganannya (*Signing Key*).
            </li>
          </ol>
        </div>
      )}
    </section>
  );
};
