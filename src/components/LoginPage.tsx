"use client";

import { useAuth } from "./AuthProvider";
import { ArrowRight, Shield, Zap, Brain, Map } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center min-h-[500px]">
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

              {/* Email/Password form */}
              <form onSubmit={handleSubmit} className="max-w-sm space-y-3 mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
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
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-accent text-bg text-xs font-medium tracking-wider uppercase hover:bg-text transition-colors disabled:opacity-50"
                >
                  {loading ? "..." : mode === "signin" ? "Log in" : "Create account"}
                  <ArrowRight size={14} />
                </button>
              </form>

              {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
              {success && <p className="text-xs text-green-400 mb-2">{success}</p>}

              <p className="text-[10px] text-text-dim">
                {mode === "signin" ? (
                  <>No account? <button onClick={() => setMode("signup")} className="text-text hover:underline">Sign up</button></>
                ) : (
                  <>Already have an account? <button onClick={() => setMode("signin")} className="text-text hover:underline">Log in</button></>
                )}
              </p>
            </div>

            {/* Right — logo */}
            <div className="flex items-center justify-center">
              <div className="w-[500px] h-[500px] flex items-center justify-center">
                <img src="/graphene.png" alt="Graphene" className="w-[450px] h-[450px] invert opacity-90" style={{ clipPath: "inset(4%)" }} />
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
    </div>
  );
}
