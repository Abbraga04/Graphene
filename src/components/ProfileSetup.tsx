"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function ProfileSetup({
  onComplete,
  onDismiss,
  getToken,
}: {
  onComplete: () => void;
  onDismiss: () => void;
  getToken: () => Promise<string | null>;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || username.trim().length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/profiles/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          display_name: displayName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create profile");
        return;
      }
      onComplete();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface border border-border p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-accent tracking-wider uppercase">
            Set Up Profile
          </h2>
          <button onClick={onDismiss} className="text-text-dim hover:text-text">
            <X size={14} />
          </button>
        </div>
        <p className="text-[10px] text-text-dim mb-4">
          Pick a username to star papers, show up in the community, and share your reading list.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-[9px] text-text-dim tracking-[0.2em] uppercase block mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9_-]/gi, "").toLowerCase())}
              placeholder="e.g. researcher42"
              className="w-full bg-bg border border-border px-3 py-2 text-xs text-text focus:outline-none focus:border-border-hover"
            />
          </div>
          <div>
            <label className="text-[9px] text-text-dim tracking-[0.2em] uppercase block mb-1">
              Display Name <span className="text-text-dim">(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-bg border border-border px-3 py-2 text-xs text-text focus:outline-none focus:border-border-hover"
            />
          </div>

          {error && (
            <p className="text-[10px] text-red-400">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || !username.trim()}
            className="w-full py-2 bg-accent text-bg text-xs tracking-wider uppercase font-medium hover:bg-text disabled:opacity-30 transition-colors"
          >
            {saving ? "Creating..." : "Create Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
