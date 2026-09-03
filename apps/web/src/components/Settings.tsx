"use client";

import { useEffect, useState } from "react";
import { X, User, Palette, Bot, Cpu, Swords, Keyboard, Shield } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "general", label: "General", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "models", label: "Models", icon: Cpu },
  { id: "arena", label: "Arena", icon: Swords },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "privacy", label: "Privacy", icon: Shield },
];

function GeneralSettings() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-text-primary mb-1">About</h3>
      <p className="text-xs text-text-muted leading-relaxed">
        Agent Arena sends one prompt to two agents, lets them analyse, discuss, plan, and
        review each other, then reports the outcome honestly — live models when the server
        can run them, an explicitly labeled demo otherwise.
      </p>
    </div>
  );
}

function AppearanceSettings() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-text-primary mb-1">Theme</h3>
      <p className="text-xs text-text-muted">Agent Arena uses the Osaka Jade dark theme. Theming options are not available yet.</p>
    </div>
  );
}

function AgentSettings() {
  const { agents } = useStore();
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-text-primary">Connected Agents</h3>
      {agents.map((agent) => (
        <div key={agent.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border-subtle">
          <div className="flex items-center gap-3">
            <span className={cn(
              "w-2 h-2 rounded-full",
              agent.status === "online" ? "bg-status-success" : "bg-text-disabled"
            )} />
            <div>
              <p className="text-sm text-text-primary">{agent.name}</p>
              <p className="text-[11px] text-text-muted">{agent.provider}{agent.model ? ` · ${agent.model}` : ""}</p>
            </div>
          </div>
          <span className="text-[11px] text-text-disabled">{agent.status === "online" ? "Connected" : "Not configured"}</span>
        </div>
      ))}
    </div>
  );
}

function ModelSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Model Configuration</h3>
        <p className="text-xs text-text-muted mb-4">Configure model parameters for each agent</p>
        <div className="p-4 bg-background rounded-lg border border-border-subtle">
          <p className="text-sm text-text-muted">Configure API keys and model preferences in your environment variables or config file.</p>
        </div>
      </div>
    </div>
  );
}

function ArenaSettings() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-text-primary mb-1">Arena</h3>
      <p className="text-xs text-text-muted leading-relaxed">
        Each arena runs one build/review round within an 8-minute budget. Which agents run
        live (and which models) is configured on the server via the ARENA_MODELS environment
        variable; this panel is read-only.
      </p>
    </div>
  );
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "\u2318" : "Ctrl";

const SHORTCUTS = [
  { action: "Command palette", keys: "K" },
  { action: "New arena", keys: "N" },
  { action: "Search sessions", keys: "F" },
  { action: "Settings", keys: "," },
];

function ShortcutSettings() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-primary mb-3">Keyboard Shortcuts</h3>
      {SHORTCUTS.map((item) => (
        <div key={item.action} className="flex items-center justify-between py-2">
          <span className="text-sm text-text-secondary">{item.action}</span>
          <kbd className="text-[11px] text-text-muted font-mono px-2 py-1 rounded bg-background border border-border-subtle">{MOD} {item.keys}</kbd>
        </div>
      ))}
      <p className="text-[11px] text-text-disabled pt-2">{MOD} K also opens the palette from anywhere, including while a session is open.</p>
    </div>
  );
}

function PrivacySettings() {
  const { clearHistory } = useStore();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-text-primary mb-1">Privacy</h3>
      <p className="text-xs text-text-muted leading-relaxed">
        Session transcripts are stored only in this browser's local storage. Nothing is
        uploaded or shared.
      </p>
      <button
        onClick={() => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          clearHistory();
          setConfirming(false);
        }}
        className={cn(
          "px-3 py-1.5 rounded-lg border text-xs transition-colors",
          confirming
            ? "bg-red-500/10 border-red-400/50 text-red-400"
            : "border-border-subtle text-text-secondary hover:text-red-400 hover:border-red-400/40"
        )}
      >
        {confirming ? "Click again to confirm" : "Clear session history"}
      </button>
    </div>
  );
}

export function Settings() {
  const { settingsOpen, closeSettings } = useStore();
  const [activeCategory, setActiveCategory] = useState("general");

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, closeSettings]);

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-150" onClick={closeSettings} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[70vh] bg-elevated border border-border-subtle rounded-2xl shadow-2xl shadow-black/40 flex overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 ease-out">
        {/* Sidebar */}
        <div className="w-44 border-r border-border-subtle p-2 space-y-0.5 flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2 mb-2">
            <span className="text-sm font-medium text-text-primary">Settings</span>
            <button onClick={closeSettings} className="p-1 rounded text-text-muted hover:text-text-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  activeCategory === cat.id
                    ? "bg-jade/10 text-jade-light"
                    : "text-text-secondary hover:bg-hover-surface hover:text-text-primary"
                )}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeCategory === "general" && <GeneralSettings />}
          {activeCategory === "appearance" && <AppearanceSettings />}
          {activeCategory === "agents" && <AgentSettings />}
          {activeCategory === "models" && <ModelSettings />}
          {activeCategory === "arena" && <ArenaSettings />}
          {activeCategory === "shortcuts" && <ShortcutSettings />}
          {activeCategory === "privacy" && <PrivacySettings />}
        </div>
      </div>
    </div>
  );
}
