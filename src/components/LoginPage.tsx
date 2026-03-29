"use client";

import { useAuth } from "./AuthProvider";
import { ArrowRight, Shield, Zap, Brain, Map } from "lucide-react";
import { useEffect, useRef } from "react";

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

// Draw hexagon aperture shape procedurally
function drawHexAperture(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, rotation: number) {
  const sides = 6;
  for (let i = 0; i < sides; i++) {
    const a1 = (Math.PI * 2 * i) / sides + rotation;
    const a2 = (Math.PI * 2 * (i + 1)) / sides + rotation;
    const gap = 0.04; // gap between blades

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1 + gap) * outerR, cy + Math.sin(a1 + gap) * outerR);
    ctx.lineTo(cx + Math.cos(a2 - gap) * outerR, cy + Math.sin(a2 - gap) * outerR);
    ctx.lineTo(cx + Math.cos(a2 - gap * 2) * innerR, cy + Math.sin(a2 - gap * 2) * innerR);
    ctx.lineTo(cx + Math.cos(a1 + gap * 2) * innerR, cy + Math.sin(a1 + gap * 2) * innerR);
    ctx.closePath();
    ctx.fill();
  }
}

function DitheredLogo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = 500, H = 500;
    canvas.width = W;
    canvas.height = H;

    const bayer8 = [
      [0,32,8,40,2,34,10,42],
      [48,16,56,24,50,18,58,26],
      [12,44,4,36,14,46,6,38],
      [60,28,52,20,62,30,54,22],
      [3,35,11,43,1,33,9,41],
      [51,19,59,27,49,17,57,25],
      [15,47,7,39,13,45,5,37],
      [63,31,55,23,61,29,53,21],
    ];

    let time = 0;

    const render = () => {
      time += 0.008;
      ctx.clearRect(0, 0, W, H);

      // Draw layers to offscreen canvas
      const tmp = document.createElement("canvas");
      tmp.width = W;
      tmp.height = H;
      const tc = tmp.getContext("2d")!;

      const cx = W / 2, cy = H / 2;
      const layers = 7;

      for (let l = layers; l >= 0; l--) {
        const depth = l / layers;
        const scale = 0.5 + depth * 0.7;
        const rot = time * (0.3 + l * 0.1) + l * 0.12;
        const outerR = 180 * scale;
        const innerR = 100 * scale;
        const brightness = l === 0 ? 1 : 0.1 + (1 - depth) * 0.3;

        tc.fillStyle = `rgba(255,255,255,${brightness})`;
        drawHexAperture(tc, cx, cy, outerR, innerR, rot);
      }

      // Apply ordered dithering
      const imgData = tc.getImageData(0, 0, W, H);
      const d = imgData.data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const avg = d[i]; // already greyscale
          if (avg < 2) { d[i+3] = 0; continue; }

          const threshold = (bayer8[y % 8][x % 8] / 64) * 255;
          const on = avg > threshold;
          d[i] = d[i+1] = d[i+2] = 255;
          d[i+3] = on ? Math.min(255, avg + 60) : 0;
        }
      }
      tc.putImageData(imgData, 0, 0);

      // Draw to main canvas with glow
      ctx.drawImage(tmp, 0, 0);

      // Glow pass
      ctx.globalCompositeOperation = "screen";
      ctx.filter = "blur(8px)";
      ctx.globalAlpha = 0.2;
      ctx.drawImage(tmp, 0, 0);
      ctx.filter = "blur(20px)";
      ctx.globalAlpha = 0.1;
      ctx.drawImage(tmp, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
    />
  );
}

export default function LoginPage() {
  const { signInWithGithub, signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-2">
          <img src="/graphene.png" alt="Graphene" className="w-5 h-5 invert" />
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
            onClick={signInWithGithub}
            className="flex items-center gap-2 text-xs px-4 py-2 text-text-dim hover:text-text transition-colors tracking-wider"
          >
            Log in <GithubIcon size={14} />
          </button>
          <button
            onClick={signInWithGithub}
            className="flex items-center gap-2 text-xs px-5 py-2 bg-accent text-bg font-medium tracking-wider hover:bg-text transition-colors"
          >
            Sign up <ArrowRight size={12} />
          </button>
        </div>
      </nav>

      {/* Hero — split layout */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pt-20 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[500px]">
            {/* Left — text */}
            <div>
              <h1 className="text-5xl font-bold text-accent leading-[1.1] tracking-tight mb-6">
                Your research papers,<br />
                mapped and understood.
              </h1>
              <p className="text-base text-text-dim leading-relaxed mb-8 max-w-md">
                Collect and track academic papers in one place.
                AI-powered summaries, a knowledge graph that
                connects your reading, and a built-in BS detector.
              </p>

              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={signInWithGithub}
                  className="flex items-center gap-2 px-6 py-3 bg-accent text-bg text-xs font-medium tracking-wider hover:bg-text transition-colors"
                >
                  Get started free <ArrowRight size={14} />
                </button>
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-2 px-6 py-3 border border-border text-text text-xs font-medium tracking-wider hover:bg-surface-2 transition-colors"
                >
                  Continue with Google
                </button>
              </div>
              <p className="text-[10px] text-text-dim tracking-wider">
                Free and open source. Bring your own API key.
              </p>
            </div>

            {/* Right — dithered logo */}
            <div className="flex items-center justify-center">
              <div className="w-[420px] h-[420px] relative">
                <DitheredLogo />
              </div>
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
      <footer className="border-t border-border px-8 py-12">
        <div className="max-w-6xl mx-auto flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/graphene.png" alt="Graphene" className="w-5 h-5 invert" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-text-dim">Graphene</span>
            </div>
            <p className="text-[10px] text-text-dim">
              &copy; {new Date().getFullYear()} Graphene. Open source under MIT.
            </p>
          </div>
          <div className="flex gap-16">
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-text-dim mb-3">Project</h4>
              <div className="space-y-2">
                <a href="https://github.com/lance116/Graphene" target="_blank" rel="noopener noreferrer" className="block text-xs text-text-dim hover:text-text transition-colors">GitHub</a>
                <a href="https://github.com/lance116/Graphene/issues" target="_blank" rel="noopener noreferrer" className="block text-xs text-text-dim hover:text-text transition-colors">Issues</a>
                <a href="https://github.com/lance116/Graphene/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="block text-xs text-text-dim hover:text-text transition-colors">License</a>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-text-dim mb-3">Stack</h4>
              <div className="space-y-2">
                <span className="block text-xs text-text-dim">Next.js</span>
                <span className="block text-xs text-text-dim">Supabase</span>
                <span className="block text-xs text-text-dim">Claude Opus 4.6</span>
              </div>
            </div>
          </div>
        </div>

        {/* Big background text — shows top, clips bottom */}
        <div className="w-full mt-12 overflow-hidden" style={{ height: "clamp(60px, 8vw, 110px)" }}>
          <p
            className="font-bold leading-[0.85] select-none text-white/[0.05] text-center w-full"
            style={{ fontSize: "clamp(80px, 10vw, 160px)", letterSpacing: "-0.02em" }}
          >
            Graphene
          </p>
        </div>
      </footer>
    </div>
  );
}
