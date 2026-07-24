import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { CheckCircle2, ExternalLink, Gamepad2, Loader2, Radio, Shield } from "lucide-react";
import { useSettingsStore } from "../../stores/useSettingsStore";
import {
  FLOWMANGA_DISCORD_LARGE_IMAGE,
  FLOWMANGA_DISCORD_SMALL_IMAGE,
} from "../../services/DiscordPresenceService";
import { toast } from "../Toast";

const isValidApplicationId = (value: string) => /^\d{17,20}$/.test(value);

const Toggle = ({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between gap-5 rounded-2xl border border-border-subtle bg-surface-elevated p-4 text-left"
  >
    <span>
      <strong className="block text-sm text-foreground">{label}</strong>
      <span className="mt-1 block text-xs leading-relaxed text-foreground-dim">{description}</span>
    </span>
    <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-surface-raised"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </span>
  </button>
);

export const IntegrationsSettings = () => {
  const settings = useSettingsStore();
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const validId = isValidApplicationId(settings.discordApplicationId);

  const togglePresence = async (enabled: boolean) => {
    if (enabled && !validId) {
      toast.error("Enter a valid Discord Application ID first");
      return;
    }
    settings.setDiscordRichPresenceEnabled(enabled);
    if (!enabled) {
      await invoke("clear_discord_presence").catch(() => undefined);
      setConnected(false);
    }
  };

  const testConnection = async () => {
    if (!validId) {
      toast.error("Discord Application ID must contain 17 to 20 digits");
      return;
    }
    setTesting(true);
    try {
      await invoke("set_discord_presence", {
        input: {
          applicationId: settings.discordApplicationId,
          details: "FlowManga connected",
          state: "Ready to read",
          startTimestamp: Math.floor(Date.now() / 1000),
          largeImage: FLOWMANGA_DISCORD_LARGE_IMAGE,
          largeText: "FlowManga — Read. Discover. Flow.",
          smallImage: FLOWMANGA_DISCORD_SMALL_IMAGE,
          smallText: "Discord Rich Presence connected",
        },
      });
      setConnected(true);
      toast.success("Discord Rich Presence connected");
    } catch (error) {
      setConnected(false);
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 pb-12">
      <div>
        <h2 className="text-3xl font-black uppercase tracking-tighter text-foreground">Integrations</h2>
        <p className="mt-1 font-bold text-foreground-dim">Connect FlowManga to desktop services.</p>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-border-subtle bg-surface-elevated">
        <div className="flex items-start gap-4 border-b border-border-subtle p-6">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-400">
            <Gamepad2 size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-black text-foreground">Discord Rich Presence</h3>
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${connected ? "bg-emerald-500/15 text-emerald-500" : "bg-surface-raised text-foreground-dim"}`}>
                {connected ? "Connected" : "Not tested"}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-foreground-dim">
              Shows FlowManga and optional reading details on your Discord profile. Discord desktop must be running.
            </p>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-foreground-dim">Discord Application ID</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              value={settings.discordApplicationId}
              onChange={(event) => {
                settings.setDiscordApplicationId(event.target.value.replace(/\D/g, ""));
                setConnected(false);
              }}
              placeholder="123456789012345678"
              className="mt-2 w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 font-mono text-sm text-foreground outline-none transition focus:border-accent"
            />
            <span className="mt-2 block text-xs leading-relaxed text-foreground-dim">
              This is the public Application ID—not a client secret. A branded FlowManga Discord application and icon are configured in Discord’s Developer Portal.
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={testing || !validId}
              onClick={testConnection}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {testing ? <Loader2 size={15} className="animate-spin" /> : connected ? <CheckCircle2 size={15} /> : <Radio size={15} />}
              Test connection
            </button>
            <button
              type="button"
              onClick={() => void open("https://discord.com/developers/applications")}
              className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-xs font-black uppercase tracking-widest text-foreground"
            >
              Developer Portal <ExternalLink size={14} />
            </button>
          </div>

          <Toggle
            checked={settings.discordRichPresenceEnabled}
            onChange={(enabled) => void togglePresence(enabled)}
            label="Enable Discord Rich Presence"
            description="Publishes activity only while FlowManga has readable pages open."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              checked={settings.discordShareMangaTitle}
              onChange={settings.setDiscordShareMangaTitle}
              label="Share manga title"
              description="Otherwise Discord only says “Reading manga.”"
            />
            <Toggle
              checked={settings.discordShareReadingProgress}
              onChange={settings.setDiscordShareReadingProgress}
              label="Share progress"
              description="Show the current chapter and page number."
            />
          </div>

          <Toggle
            checked={settings.discordShowElapsedTime}
            onChange={settings.setDiscordShowElapsedTime}
            label="Show elapsed reading time"
            description="Starts a Discord activity timer whenever a different manga is opened."
          />

          <div className="flex gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200">
            <Shield size={18} className="shrink-0" />
            Rich Presence is off by default because Discord activity can be visible to friends and server members.
          </div>
        </div>
      </section>
    </div>
  );
};
