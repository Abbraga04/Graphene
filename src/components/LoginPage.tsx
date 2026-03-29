"use client";

import { useAuth } from "./AuthProvider";
import { ArrowRight, Shield, Zap, Brain, Map } from "lucide-react";
import { useState, useRef, useEffect } from "react";

function AsciiLogo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = 500, H = 500;
    canvas.width = W;
    canvas.height = H;

    // Load logo and sample it
    const img = new Image();
    img.src = "/graphene.png";
    let logoPixels: Uint8ClampedArray | null = null;
    const SAMPLE = 200;

    img.onload = () => {
      const tmp = document.createElement("canvas");
      tmp.width = SAMPLE;
      tmp.height = SAMPLE;
      const tc = tmp.getContext("2d")!;
      // Draw with inset to skip the border/edge pixels
      const inset = 10;
      tc.fillStyle = "#fff";
      tc.fillRect(0, 0, SAMPLE, SAMPLE);
      tc.drawImage(img, inset, inset, SAMPLE - inset * 2, SAMPLE - inset * 2);
      logoPixels = tc.getImageData(0, 0, SAMPLE, SAMPLE).data;
    };

    const chars = " .,:;+*?%S#@";
    const CELL = 8;
    const cols = Math.floor(W / CELL);
    const rows = Math.floor(H / CELL);

    // Precompute random char offsets for shimmer
    const charOffsets = new Float32Array(cols * rows);
    for (let i = 0; i < charOffsets.length; i++) {
      charOffsets[i] = Math.random() * Math.PI * 2;
    }

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, W, H);

      if (!logoPixels) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.font = `${CELL}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Map grid position to logo pixel
          const lx = Math.floor((col / cols) * SAMPLE);
          const ly = Math.floor((row / rows) * SAMPLE);
          const idx = (ly * SAMPLE + lx) * 4;
          const r = logoPixels[idx], g = logoPixels[idx + 1], b = logoPixels[idx + 2];
          const brightness = (r + g + b) / 3;

          // Logo is dark on white — invert: dark pixels = logo shape
          const logoVal = 1 - brightness / 255;

          if (logoVal < 0.15) continue; // skip background and faint edges

          // Animated shimmer
          const shimmer = Math.sin(time * 2 + charOffsets[row * cols + col]) * 0.15;
          const wave = Math.sin(col * 0.3 + time * 1.5) * 0.05 + Math.sin(row * 0.25 + time * 1.2) * 0.05;
          const val = Math.max(0, Math.min(1, logoVal + shimmer + wave));

          // Pick character based on brightness
          const charIdx = Math.floor(val * (chars.length - 1));
          const ch = chars[charIdx];

          // Color: white with varying alpha
          const alpha = 0.3 + val * 0.7;
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;

          const x = col * CELL + CELL / 2;
          const y = row * CELL + CELL / 2;
          ctx.fillText(ch, x, y);
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <canvas ref={canvasRef} className="w-[500px] h-[500px]" />;
}

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"landing" | "signin" | "signup">("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }

    const result = mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password);

    if (result.error) {
      setError(result.error);
    } else if (mode === "signup") {
      setSuccess("Check your email to confirm your account.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-2">
          <img src="/graphene.png" alt="Graphene" className="w-5 h-5 invert" style={{ clipPath: "inset(4%)" }} />
          <span className="text-sm font-bold tracking-[0.15em] uppercase text-accent">Graphene</span>
        </div>
        <div className="flex items-center gap-3">
          <iframe
            src="https://ghbtns.com/github-btn.html?user=lance116&repo=Graphene&type=star&count=true&size=large"
            frameBorder="0"
            scrolling="0"
            width="130"
            height="30"
            title="GitHub Stars"
            className="mt-0.5"
          />
          <button
            onClick={() => { setMode("signin"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="text-xs px-4 py-2 text-text-dim hover:text-text transition-colors tracking-wider"
          >
            Log in
          </button>
          <button
            onClick={() => { setMode("signup"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="flex items-center gap-2 text-xs px-5 py-2 bg-accent text-bg font-medium tracking-wider hover:bg-text transition-colors"
          >
            Sign up <ArrowRight size={12} />
          </button>
        </div>
      </nav>

      {/* Hero — split layout */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pt-20 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-center min-h-[500px]">
            {/* Left — text */}
            <div>
              <h1 className="text-5xl font-bold text-accent leading-[1.1] tracking-tight mb-6">
                Open-source research<br />
                paper management.
              </h1>
              <p className="text-base text-text-dim leading-relaxed mb-8 max-w-md">
                Collect, read, and track academic papers in one place.
                AI-powered summaries, a knowledge graph, and a
                built-in legitness detector.
              </p>

              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/lance116/Graphene"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-accent text-bg text-xs font-medium tracking-wider uppercase hover:bg-text transition-colors"
                >
                  Star on GitHub <ArrowRight size={14} />
                </a>
                <button
                  onClick={() => setMode("signin")}
                  className="flex items-center gap-2 px-6 py-3 border border-border text-text text-xs font-medium tracking-wider uppercase hover:bg-surface-2 transition-colors"
                >
                  Log in
                </button>
              </div>
              <p className="text-[10px] text-text-dim mt-3">
                Free and open source. Self-host with your own API key.
              </p>
            </div>

            {/* Right — ASCII dithered logo */}
            <div className="flex items-center justify-center">
              <AsciiLogo />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="max-w-7xl mx-auto px-8 py-20 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: Map, title: "Knowledge Graph", desc: "A visual map of every paper you've read with category clusters and connections between them." },
              { icon: Brain, title: "AI Summaries & Chat", desc: "Get instant summaries and ask questions about any paper. Full context, no hallucination." },
              { icon: Shield, title: "Legitness Score", desc: "AI rates each paper on honesty, rigor, novelty, and credibility. Know what you're reading." },
              { icon: Zap, title: "Track Everything", desc: "Paste any arXiv link or PDF. Mark as read, take notes, sort by date, category, or score." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border border-border p-6">
                <Icon size={20} className="text-text-dim mb-4" />
                <h3 className="text-xs font-bold tracking-wider uppercase text-accent mb-2">{title}</h3>
                <p className="text-[11px] text-text-dim leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative overflow-hidden bg-surface">
        <div className="h-24 bg-gradient-to-b from-bg to-surface" />
        <div className="max-w-6xl mx-auto px-8 pt-8 pb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <img src="/graphene.png" alt="Graphene" className="w-6 h-6 invert" style={{ clipPath: "inset(4%)" }} />
              <span className="text-xs text-text-dim">Graphene &copy; {new Date().getFullYear()}</span>
            </div>
            <a href="https://github.com/lance116/Graphene" target="_blank" rel="noopener noreferrer" className="text-sm text-text-dim hover:text-text transition-colors">GitHub Project</a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-8 overflow-hidden pointer-events-none select-none" style={{ height: "clamp(85px, 12vw, 155px)" }}>
          <p className="font-bold leading-[0.82] text-white/[0.04]" style={{ fontSize: "clamp(130px, 16vw, 260px)", letterSpacing: "-0.03em" }}>
            Graphene
          </p>
        </div>
      </footer>
      {/* Login Modal */}
      {mode === "signin" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-border p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-accent">Log in</h2>
              <button onClick={() => setMode("landing")} className="text-xs text-text-dim hover:text-text text-lg">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                autoFocus
                className="w-full bg-bg border border-border px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-hover"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="w-full bg-bg border border-border px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-hover"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-accent text-bg text-xs font-medium tracking-wider uppercase hover:bg-text transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Log in"}
              </button>
            </form>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            {success && <p className="text-xs text-green-400 mt-3">{success}</p>}
            <p className="text-[10px] text-text-dim mt-4">
              No account? <button onClick={() => { setMode("signup"); }} className="text-text hover:underline">Sign up</button>
            </p>
          </div>
        </div>
      )}

      {/* Signup Modal */}
      {mode === "signup" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-border p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-accent">Sign up</h2>
              <button onClick={() => setMode("landing")} className="text-xs text-text-dim hover:text-text text-lg">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                autoFocus
                className="w-full bg-bg border border-border px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-hover"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 characters)"
                required
                minLength={6}
                className="w-full bg-bg border border-border px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-hover"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                minLength={6}
                className="w-full bg-bg border border-border px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-hover"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-accent text-bg text-xs font-medium tracking-wider uppercase hover:bg-text transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Create account"}
              </button>
            </form>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            {success && <p className="text-xs text-green-400 mt-3">{success}</p>}
            <p className="text-[10px] text-text-dim mt-4">
              Already have an account? <button onClick={() => setMode("signin")} className="text-text hover:underline">Log in</button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
