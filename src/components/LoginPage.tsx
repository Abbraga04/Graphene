"use client";

import { useAuth } from "./AuthProvider";
import { ArrowRight, Shield, Zap, Brain, Map } from "lucide-react";
import { useEffect, useRef } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
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

    const bayer = [
      [0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],
      [12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
      [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],
      [15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21],
    ];

    // Build the logo geometry: 6 blades, each a quad (4 vertices)
    // Outer hex vertices and inner hex vertices (offset by 1)
    const R = 140, r = 60, depth = 30;
    const N = 6;

    function hexPt(radius: number, i: number, z: number): [number, number, number] {
      const a = (Math.PI * 2 * i) / N - Math.PI / 2;
      return [Math.cos(a) * radius, Math.sin(a) * radius, z];
    }

    // Each blade: outer[i] → outer[i+1] → inner[i+2] → inner[i+1]
    // Front and back faces + 4 side faces per blade
    type Face = { verts: [number, number, number][]; brightness: number };

    function buildFaces(zFront: number, zBack: number): Face[] {
      const faces: Face[] = [];
      for (let i = 0; i < N; i++) {
        const i1 = (i + 1) % N;
        const i2 = (i + 2) % N;

        const of0 = hexPt(R, i, zFront);
        const of1 = hexPt(R, i1, zFront);
        const if1 = hexPt(r, i1, zFront);
        const if2 = hexPt(r, i2, zFront);

        const ob0 = hexPt(R, i, zBack);
        const ob1 = hexPt(R, i1, zBack);
        const ib1 = hexPt(r, i1, zBack);
        const ib2 = hexPt(r, i2, zBack);

        // Front face
        faces.push({ verts: [of0, of1, if2, if1], brightness: 1.0 });
        // Back face
        faces.push({ verts: [ob1, ob0, ib1, ib2], brightness: 0.3 });
        // Side: outer edge
        faces.push({ verts: [of0, of1, ob1, ob0], brightness: 0.5 });
        // Side: inner edge
        faces.push({ verts: [if1, if2, ib2, ib1], brightness: 0.4 });
        // Side: left
        faces.push({ verts: [of0, if1, ib1, ob0], brightness: 0.6 });
        // Side: right
        faces.push({ verts: [of1, if2, ib2, ob1], brightness: 0.55 });
      }
      return faces;
    }

    const allFaces = buildFaces(-depth / 2, depth / 2);

    function rotY(p: [number, number, number], a: number): [number, number, number] {
      return [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
    }
    function rotX(p: [number, number, number], a: number): [number, number, number] {
      return [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];
    }
    function project(p: [number, number, number]): [number, number] {
      const fov = 500;
      const s = fov / (fov + p[2] + 250);
      return [p[0] * s + W / 2, p[1] * s + H / 2];
    }

    let time = 0;

    const render = () => {
      time += 0.008;
      const ry = time;
      const rx = Math.sin(time * 0.6) * 0.35;

      const tmp = document.createElement("canvas");
      tmp.width = W; tmp.height = H;
      const tc = tmp.getContext("2d")!;

      // Sort faces by average z depth (painter's algorithm)
      const transformed = allFaces.map((face) => {
        const xVerts = face.verts.map((v) => {
          let p = rotX(v, rx);
          p = rotY(p, ry);
          return p;
        });
        const avgZ = xVerts.reduce((s, v) => s + v[2], 0) / xVerts.length;
        const projected = xVerts.map(project);

        // Simple backface culling via cross product
        const [a, b, c] = projected;
        const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

        return { projected, avgZ, brightness: face.brightness, visible: cross > 0 };
      });

      transformed.sort((a, b) => b.avgZ - a.avgZ);

      for (const face of transformed) {
        if (!face.visible) continue;
        const b = Math.floor(face.brightness * 200);
        tc.fillStyle = `rgb(${b},${b},${b})`;
        tc.strokeStyle = `rgb(${Math.min(255, b + 40)},${Math.min(255, b + 40)},${Math.min(255, b + 40)})`;
        tc.lineWidth = 1;
        tc.beginPath();
        face.projected.forEach(([x, y], i) => i === 0 ? tc.moveTo(x, y) : tc.lineTo(x, y));
        tc.closePath();
        tc.fill();
        tc.stroke();
      }

      // Dithering pass
      const imgData = tc.getImageData(0, 0, W, H);
      const d = imgData.data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (avg < 3) { d[i + 3] = 0; continue; }
          const threshold = (bayer[y % 8][x % 8] / 64) * 255;
          const on = avg > threshold * 0.7;
          d[i] = d[i + 1] = d[i + 2] = 255;
          d[i + 3] = on ? Math.min(255, Math.round(avg * 1.8)) : 0;
        }
      }
      tc.putImageData(imgData, 0, 0);

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(tmp, 0, 0);

      // Glow
      ctx.globalCompositeOperation = "screen";
      ctx.filter = "blur(4px)";
      ctx.globalAlpha = 0.25;
      ctx.drawImage(tmp, 0, 0);
      ctx.filter = "blur(12px)";
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

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

export default function LoginPage() {
  const { signInWithGithub, signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-hidden">
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
      <footer className="border-t border-border px-8 pt-12 pb-24 relative overflow-hidden">
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

        {/* Big background text — absolute, no extra height */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none overflow-hidden" style={{ height: "clamp(80px, 10vw, 140px)" }}>
          <p
            className="font-bold leading-[0.85] text-white/[0.05] text-center w-full"
            style={{ fontSize: "clamp(100px, 12vw, 200px)", letterSpacing: "-0.02em" }}
          >
            Graphene
          </p>
        </div>
      </footer>
    </div>
  );
}
