"use client";

import { useState } from "react";
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
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Default Agent</h3>
        <p className="text-xs text-text-muted mb-2">Choose which agent to use by default</p>
        <select className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg text-sm text-text-primary outline-none focus:border-border-active">
          <option>Arena (multi-agent)</option>
          <option>Claude</option>
          <option>GPT</option>
          <option>Gemini</option>
        </select>
      </div>
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Language</h3>
        <select className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg text-sm text-text-primary outline-none focus:border-border-active">
          <option>English</option>
          <option>Spanish</option>
          <option>Japanese</option>
        </select>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Theme</h3>
        <p className="text-xs text-text-muted mb-2">Agent Arena uses the Osaka Jade dark theme</p>
        <div className="flex gap-2">
          <div className="w-16 h-10 rounded-lg bg-[#111C18] border-2 border-jade cursor-pointer" title="Osaka Jade (active)" />
          <div className="w-16 h-10 rounded-lg bg-gray-900 border border-border-subtle cursor-not-allowed opacity-40" title="Coming soon" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Font Size</h3>
        <input type="range" min="13" max="18" defaultValue="15" className="w-full accent-jade" />
        <div className="flex justify-between text-[10px] text-text-disabled mt-1">
          <span>Small</span>
          <span>Default</span>
          <span>Large</span>
        </div>
      </div>
    </div>
  );
}

function AgentSettings() {
  const { agents } = useStore();
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-text-primary">Connected Agents</h3>
      {agents.filter((a) => a.id !== "arena" && a.id !== "judge").map((agent) => (
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

export function Settings() {
  const { settingsOpen, closeSettings } = useStore();
  const [activeCategory, setActiveCategory] = useState("general");

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeSettings} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[70vh] bg-elevated border border-border-subtle rounded-2xl shadow-2xl shadow-black/40 flex overflow-hidden">
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
          {activeCategory === "models" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-1">Model Configuration</h3>
                <p className="text-xs text-text-muted mb-4">Configure model parameters for each agent</p>
                <div className="p-4 bg-background rounded-lg border border-border-subtle">
                  <p className="text-sm text-text-muted">Configure API keys and model preferences in your environment variables or config file.</p>
                </div>
              </div>
            </div>
          )}
          {activeCategory === "arena" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-1">Arena Settings</h3>
                <p className="text-xs text-text-muted mb-4">Configure how the arena evaluates agent responses</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-text-primary">Max Rounds</label>
                    <input type="number" defaultValue={5} className="w-full mt-1 px-3 py-2 bg-background border border-border-subtle rounded-lg text-sm text-text-primary outline-none focus:border-border-active" />
                  </div>
                  <div>
                    <label className="text-sm text-text-primary">Timeout (minutes)</label>
                    <input type="number" defaultValue={10} className="w-full mt-1 px-3 py-2 bg-background border border-border-subtle rounded-lg text-sm text-text-primary outline-none focus:border-border-active" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="accent-jade" />
                    <label className="text-sm text-text-primary">Enable judge evaluation</label>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeCategory === "shortcuts" && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-primary mb-3">Keyboard Shortcuts</h3>
              {[
                { action: "Command palette", keys: "⌘ K" },
                { action: "New arena", keys: "⌘ N" },
                { action: "Settings", keys: "⌘ ," },
                { action: "Search sessions", keys: "⌘ F" },
                { action: "Send message", keys: "Enter" },
                { action: "New line", keys: "Shift + Enter" },
              ].map((item) => (
                <div key={item.action} className="flex items-center justify-between py-2">
                  <span className="text-sm text-text-secondary">{item.action}</span>
                  <kbd className="text-[11px] text-text-muted font-mono px-2 py-1 rounded bg-background border border-border-subtle">{item.keys}</kbd>
                </div>
              ))}
            </div>
          )}
          {activeCategory === "privacy" && (
            <div className="space-y-6">
              <h3 className="text-sm font-medium text-text-primary mb-3">Privacy</h3>
              <div className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="accent-jade" />
                <label className="text-sm text-text-primary">Store conversation history locally</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="accent-jade" />
                <label className="text-sm text-text-primary">Share usage data to improve Arena</label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
