import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Code2,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Lock,
  ShieldCheck,
  Terminal,
  UserCheck,
} from 'lucide-react';
import { computeLiveKeystrokeSignature, verifyMasterPortalLogin } from '../utils/auth';

interface Modern3DLoginPortalProps {
  onAuthenticated: (sessionSignature: string) => void;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

const PROGRAMMER_CODE_SNIPPETS = [
  {
    module: 'vaultCipher.ts',
    lines: [
      'export async function verifyQuantumSession(token: Uint8Array) {',
      '  const digest = await crypto.subtle.digest("SHA-256", token);',
      '  const matrix = Float64Array.from({ length: 16 }, (_, i) => i * 1.618);',
      '  return { status: "VERIFIED_AES_256_GCM", entropyBits: 256, matrix };',
      '}',
    ],
  },
  {
    module: 'financialEngine.ts',
    lines: [
      'export function computeLiquidLedger(period: MonthlyPeriodData) {',
      '  const netFlow = period.openingBalance + period.totalIncome;',
      '  const allocation = period.fixedCostActual + period.dailyTrackerTotal;',
      '  return { closingBalance: netFlow - allocation - period.savingActual };',
      '}',
    ],
  },
  {
    module: 'cloudSyncStream.ts',
    lines: [
      'export function streamRealtimeLedger(endpoint: string) {',
      '  const sse = new EventSource(`${endpoint}/api/events`);',
      '  sse.addEventListener("SYNC_UPDATED", (pkt) => commitSnapshot(pkt));',
      '  return { protocol: "SSE_HTTP2_TLS1.3", syncState: "ACTIVE" };',
      '}',
    ],
  },
];

export const Modern3DLoginPortal: React.FC<Modern3DLoginPortalProps> = ({ onAuthenticated }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Interactive 3D Mouse Tilt State
  const [tilt, setTilt] = useState<{ rx: number; ry: number; mx: number; my: number }>({
    rx: 0,
    ry: 0,
    mx: 0.5,
    my: 0.5,
  });
  const tiltRef = useRef({ rx: 0, ry: 0 });

  // Programmer Code Typing Animation State
  const [snippetIndex, setSnippetIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeSnippet = PROGRAMMER_CODE_SNIPPETS[snippetIndex];
  const fullSnippetText = useMemo(() => activeSnippet.lines.join('\n'), [activeSnippet]);

  // Cycle and type programmer code snippets smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      setTypedChars((prev) => {
        if (prev < fullSnippetText.length + 18) {
          return prev + 2;
        }
        setSnippetIndex((idx) => (idx + 1) % PROGRAMMER_CODE_SNIPPETS.length);
        return 0;
      });
    }, 45);
    return () => clearInterval(interval);
  }, [fullSnippetText]);

  // 3D Interactive Hypercube, Octahedron & Constellation Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let angleX = 0.4;
    let angleY = 0.6;
    let angleZ = 0.2;

    // Outer cube vertices (-1 to 1)
    const outerCube: Point3D[] = [
      { x: -1, y: -1, z: -1 },
      { x: 1, y: -1, z: -1 },
      { x: 1, y: 1, z: -1 },
      { x: -1, y: 1, z: -1 },
      { x: -1, y: -1, z: 1 },
      { x: 1, y: -1, z: 1 },
      { x: 1, y: 1, z: 1 },
      { x: -1, y: 1, z: 1 },
    ];

    // Inner tesseract core vertices (-0.52 to 0.52)
    const innerCube: Point3D[] = outerCube.map((v) => ({
      x: v.x * 0.52,
      y: v.y * 0.52,
      z: v.z * 0.52,
    }));

    const cubeEdges: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    // Floating 3D programmer nodes
    const orbitalNodes = Array.from({ length: 24 }, (_, i) => {
      const phi = Math.acos(-1 + (2 * i) / 24);
      const theta = Math.sqrt(24 * Math.PI) * phi;
      return {
        x: 1.75 * Math.cos(theta) * Math.sin(phi),
        y: 1.75 * Math.sin(theta) * Math.sin(phi),
        z: 1.75 * Math.cos(phi),
        label: i % 3 === 0 ? `0x${(i + 16).toString(16).toUpperCase()}` : null,
      };
    });

    const rotate3D = (p: Point3D, ax: number, ay: number, az: number): Point3D => {
      // Rotate X
      const cosX = Math.cos(ax);
      const sinX = Math.sin(ax);
      const y1 = p.y * cosX - p.z * sinX;
      const z1 = p.y * sinX + p.z * cosX;

      // Rotate Y
      const cosY = Math.cos(ay);
      const sinY = Math.sin(ay);
      const x2 = p.x * cosY + z1 * sinY;
      const z2 = -p.x * sinY + z1 * cosY;

      // Rotate Z
      const cosZ = Math.cos(az);
      const sinZ = Math.sin(az);
      const x3 = x2 * cosZ - y1 * sinZ;
      const y3 = x2 * sinZ + y1 * cosZ;

      return { x: x3, y: y3, z: z2 };
    };

    const project = (p: Point3D, width: number, height: number, scale: number) => {
      const fov = 4.2;
      const distance = fov / (fov + p.z);
      return {
        x: width / 2 + p.x * scale * distance,
        y: height / 2 + p.y * scale * distance,
        scale: distance,
        z: p.z,
      };
    };

    const renderFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const scale = Math.min(width, height) * 0.24;
      angleX += 0.007 + tiltRef.current.rx * 0.0005;
      angleY += 0.011 + tiltRef.current.ry * 0.0005;
      angleZ += 0.004;

      // Ambient center radial glow
      const centerGlow = ctx.createRadialGradient(
        width / 2,
        height / 2,
        8,
        width / 2,
        height / 2,
        scale * 1.9
      );
      centerGlow.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
      centerGlow.addColorStop(0.45, 'rgba(6, 182, 212, 0.14)');
      centerGlow.addColorStop(0.8, 'rgba(99, 102, 241, 0.06)');
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, width, height);

      // Draw 3D Orbital Rings
      for (let r = 0; r < 2; r++) {
        ctx.beginPath();
        const ringRadius = r === 0 ? 1.55 : 1.9;
        for (let step = 0; step <= 64; step++) {
          const theta = (step / 64) * Math.PI * 2;
          const rawPt: Point3D =
            r === 0
              ? { x: Math.cos(theta) * ringRadius, y: Math.sin(theta) * 0.45, z: Math.sin(theta) * ringRadius }
              : { x: Math.cos(theta) * 0.45, y: Math.cos(theta) * ringRadius, z: Math.sin(theta) * ringRadius };
          const rot = rotate3D(rawPt, angleX * 0.7, angleY * 0.8, angleZ);
          const proj = project(rot, width, height, scale);
          if (step === 0) ctx.moveTo(proj.x, proj.y);
          else ctx.lineTo(proj.x, proj.y);
        }
        ctx.strokeStyle = r === 0 ? 'rgba(6, 182, 212, 0.28)' : 'rgba(168, 85, 247, 0.22)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Project outer & inner tesseract vertices
      const projOuter = outerCube.map((v) =>
        project(rotate3D(v, angleX, angleY, angleZ), width, height, scale)
      );
      const projInner = innerCube.map((v) =>
        project(rotate3D(v, -angleX * 1.2, angleY * 1.3, -angleZ), width, height, scale)
      );

      // Draw 4D hypercube connector struts (outer <-> inner)
      for (let i = 0; i < 8; i++) {
        const grad = ctx.createLinearGradient(
          projOuter[i].x,
          projOuter[i].y,
          projInner[i].x,
          projInner[i].y
        );
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.55)');
        grad.addColorStop(1, 'rgba(99, 102, 241, 0.65)');
        ctx.beginPath();
        ctx.moveTo(projOuter[i].x, projOuter[i].y);
        ctx.lineTo(projInner[i].x, projInner[i].y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }

      // Draw Outer Cube Edges
      cubeEdges.forEach(([a, b]) => {
        const grad = ctx.createLinearGradient(
          projOuter[a].x,
          projOuter[a].y,
          projOuter[b].x,
          projOuter[b].y
        );
        grad.addColorStop(0, 'rgba(16, 185, 129, 0.85)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0.85)');
        ctx.beginPath();
        ctx.moveTo(projOuter[a].x, projOuter[a].y);
        ctx.lineTo(projOuter[b].x, projOuter[b].y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });

      // Draw Inner Cube Edges
      cubeEdges.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(projInner[a].x, projInner[a].y);
        ctx.lineTo(projInner[b].x, projInner[b].y);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Draw Vertex Glow Nodes
      projOuter.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.2 * pt.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#34d399';
        ctx.fill();
      });

      projInner.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5 * pt.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#c084fc';
        ctx.fill();
      });

      // Draw Floating Orbital Programmer Nodes & Hex Addresses
      ctx.font = '600 10px "JetBrains Mono", monospace';
      orbitalNodes.forEach((node, idx) => {
        const rot = rotate3D(node, angleX * 0.45, -angleY * 0.6, angleZ * 0.3);
        const proj = project(rot, width, height, scale);
        const alpha = Math.max(0.18, Math.min(0.85, (proj.scale - 0.65) * 1.4));

        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 2 * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = idx % 2 === 0 ? `rgba(56, 189, 248, ${alpha})` : `rgba(16, 185, 129, ${alpha})`;
        ctx.fill();

        if (node.label) {
          ctx.fillStyle = `rgba(148, 163, 184, ${alpha * 0.85})`;
          ctx.fillText(node.label, proj.x + 6, proj.y + 3);
        }
      });

      animationFrameId = requestAnimationFrame(renderFrame);
    };

    renderFrame();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const ry = (nx - 0.5) * 10;
    const rx = (0.5 - ny) * 10;
    tiltRef.current = { rx, ry };
    setTilt({ rx, ry, mx: nx, my: ny });
  };

  const handleMouseLeave = () => {
    tiltRef.current = { rx: 0, ry: 0 };
    setTilt({ rx: 0, ry: 0, mx: 0.5, my: 0.5 });
  };

  const liveSignature = useMemo(
    () => computeLiveKeystrokeSignature(username, password),
    [username, password]
  );

  const entropyPercent = useMemo(() => {
    const totalLen = username.trim().length + password.length;
    return Math.min(100, Math.round((totalLen / 24) * 100));
  }, [username, password]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const verification = verifyMasterPortalLogin(username, password);
    if (!verification.success) {
      setErrorMessage(
        verification.error || 'Kredensial ID Pengguna atau Kata Sandi tidak dikenali.'
      );
      setShakeTrigger(false);
      setTimeout(() => setShakeTrigger(true), 10);
      return;
    }

    setIsUnlocking(true);
    setTimeout(() => {
      onAuthenticated(verification.sessionSignature || 'sha256:verified');
    }, 320);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="min-h-screen aurora-living-bg text-slate-100 relative overflow-hidden flex flex-col justify-between select-none"
    >
      {/* 3D Perspective Grid Floor & Ambient Living Gradient Lights */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 grid-floor-3d opacity-70" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-36 -left-24 w-[28rem] h-[28rem] rounded-full bg-emerald-500/20 blur-3xl ambient-orb"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-1/4 -right-32 w-[30rem] h-[30rem] rounded-full bg-cyan-500/20 blur-3xl ambient-orb"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-36 left-1/3 w-[28rem] h-[28rem] rounded-full bg-indigo-500/25 blur-3xl ambient-orb"
      />

      {/* Minimal Top Bar */}
      <header className="relative z-20 max-w-7xl w-full mx-auto px-6 py-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-500 to-indigo-600 p-[1px] shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950/90 rounded-[11px] flex items-center justify-center">
              <Cpu className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-white via-emerald-200 to-cyan-300 bg-clip-text text-transparent">
            FinPay Pro Enterprise · mrofiqi.id
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-300 font-mono">
          <span>AES-256-GCM Quantum Vault</span>
          <span aria-hidden="true">·</span>
          <span>Zero-Knowledge Auth</span>
        </div>
      </header>

      {/* Main 2-Column 3D Interactive Stage */}
      <main className="relative z-20 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 lg:py-10 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch perspective-stage-1200">
          {/* LEFT COLUMN (7 COLS): 3D Holographic Hypercube & Programmer Architecture Stage */}
          <section
            aria-label="Visualisasi 3D Arsitektur Sistem"
            style={{
              transform: `rotateX(${tilt.rx * 0.55}deg) rotateY(${tilt.ry * 0.55}deg)`,
              transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="lg:col-span-7 rounded-3xl liquid-glass border border-white/15 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden preserve-3d shadow-2xl"
          >
            {/* Subtle dynamic spotlight following cursor */}
            <div
              aria-hidden="true"
              style={{
                background: `radial-gradient(500px circle at ${tilt.mx * 100}% ${tilt.my * 100}%, rgba(16, 185, 129, 0.15), transparent 60%)`,
              }}
              className="pointer-events-none absolute inset-0"
            />

            {/* Top Headline & Architecture Description */}
            <div className="relative z-10 space-y-3 translate-z-24">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-emerald-300">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span>3D Spatial Financial Architecture</span>
                <span aria-hidden="true">·</span>
                <span>Real-Time Cloud Sync</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-white via-emerald-200 to-cyan-300 bg-clip-text text-transparent">
                Sistem Manajemen &amp; Analitik Keuangan Berbasis Enkripsi 3D
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Gerbang keamanan berlapis dengan komputasi matriks real-time, sinkronisasi brankas
                cloud otomatis, serta perlindungan autentikasi sesi permanen.
              </p>
            </div>

            {/* Interactive 3D Canvas (Tesseract / Hypercube + Orbital Rings) */}
            <div className="relative z-10 my-4 flex flex-col items-center justify-center">
              <canvas
                ref={canvasRef}
                width={520}
                height={270}
                data-testid="login-3d-canvas"
                className="w-full max-w-[520px] h-[230px] sm:h-[260px] rounded-2xl bg-slate-950/45 border border-white/10 shadow-inner"
              />
            </div>

            {/* Live Animated Programmer Code Terminal */}
            <div className="relative z-10 rounded-2xl bg-slate-950/85 border border-emerald-500/25 p-4 font-mono text-xs shadow-xl translate-z-36">
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-semibold text-emerald-300">
                    {activeSnippet.module}
                  </span>
                </div>
                <span className="text-[10px] text-cyan-300">
                  TypeScript 7.0 · WebCrypto Engine
                </span>
              </div>

              <pre className="text-[11px] sm:text-xs leading-relaxed text-slate-200 overflow-x-auto min-h-[92px] whitespace-pre-wrap">
                <code>
                  {fullSnippetText.slice(0, typedChars)}
                  <span className="inline-block w-2 h-3.5 bg-emerald-400 ml-0.5 align-middle animate-pulse" />
                </code>
              </pre>

              <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>Kernel: FinPay-Quantum-3D</span>
                <span>·</span>
                <span>State: Menunggu Otorisasi Kredensial</span>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN (5 COLS): 3D Glassmorphism Login Form Vault */}
          <section
            aria-label="Form Login Pengguna"
            style={{
              transform: `rotateX(${tilt.rx * 0.75}deg) rotateY(${tilt.ry * 0.75}deg)`,
              transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className={`lg:col-span-5 rounded-3xl liquid-glass border border-emerald-400/25 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden preserve-3d shadow-2xl ${
              shakeTrigger ? 'shake-error' : ''
            }`}
          >
            {/* Top Gradient Accent Bar */}
            <div
              aria-hidden="true"
              className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500"
            />

            <div className="space-y-6 relative z-10">
              {/* Vault Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Otorisasi Akses Eksekutif</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Masuk ke Portal FinPay Pro
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Masukkan ID Pengguna dan Kata Sandi rahasia Anda untuk membuka dasbor finansial.
                  </p>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/25 via-cyan-500/20 to-indigo-500/25 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                  <Lock className="w-5 h-5 text-emerald-300" />
                </div>
              </div>

              {/* Error Alert Banner */}
              {errorMessage && (
                <div
                  role="alert"
                  data-testid="login-error-alert"
                  className="rounded-2xl bg-rose-500/15 border border-rose-500/40 p-3.5 flex items-start gap-2.5 text-xs text-rose-200"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-rose-300">Verifikasi Gagal</p>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Unlocking Transition Banner */}
              {isUnlocking && (
                <div
                  role="status"
                  className="rounded-2xl bg-emerald-500/20 border border-emerald-400/50 p-3.5 flex items-center gap-2.5 text-xs text-emerald-200"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
                  <span className="font-semibold">
                    Otorisasi Valid! Membuka enkripsi brankas finansial...
                  </span>
                </div>
              )}

              {/* Login Form (Strictly NO hardcoded credentials or hints displayed) */}
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <label
                    htmlFor="master-login-username"
                    className="block text-xs font-semibold text-slate-200"
                  >
                    ID Pengguna (Username)
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="master-login-username"
                      name="username"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Masukkan ID pengguna"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950/80 border border-white/15 focus:border-emerald-400 focus:outline-none text-sm text-white placeholder-slate-500 font-mono transition-colors select-text"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="master-login-password"
                    className="block text-xs font-semibold text-slate-200"
                  >
                    Kata Sandi (Password)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="master-login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="off"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Masukkan kata sandi"
                      className="w-full pl-10 pr-11 py-3 rounded-2xl bg-slate-950/80 border border-white/15 focus:border-cyan-400 focus:outline-none text-sm text-white placeholder-slate-500 font-mono transition-colors select-text"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Live Programmer Keystroke Entropy & SHA-256 Hash Visualizer */}
                <div className="rounded-2xl bg-slate-950/75 border border-white/10 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Hash Signature</span>
                    </span>
                    <span className="text-emerald-300 truncate max-w-[180px]">
                      {liveSignature}
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      style={{ width: `${entropyPercent}%` }}
                      className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 transition-all duration-200"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Sesi Persistensi: Aktif Permanen</span>
                    <span>Entropi Input: {entropyPercent}%</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500 hover:from-emerald-400 hover:via-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>{isUnlocking ? 'Memverifikasi Kredensial...' : 'Masuk ke Sistem'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Bottom Security Guarantee Note */}
            <div className="pt-5 mt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>Sesi tetap tersimpan hingga tombol Log Out ditekan</span>
              <span className="font-mono text-emerald-400">TLS 1.3</span>
            </div>
          </section>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="relative z-20 max-w-7xl w-full mx-auto px-6 py-4 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 border-t border-white/10">
        <span>FinPay Pro Enterprise · Arsitektur Finansial &amp; Cloud Sync</span>
        <span className="font-mono">mrofiqi.id</span>
      </footer>
    </div>
  );
};
