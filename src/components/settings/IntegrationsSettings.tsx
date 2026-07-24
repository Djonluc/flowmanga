import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, Gamepad2, Loader2, Radio, Shield } from "lucide-react";
import { useSettingsStore } from "../../stores/useSettingsStore";
import {
  FLOWMANGA_DISCORD_APPLICATION_ID,
  FLOWMANGA_DISCORD_LARGE_IMAGE,
} from "../../services/DiscordPresenceService";
import { toast } from "../Toast";

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
      <span className="mt-1 block text-xs leading-relaxed text-foreground-dim">
        {description}
      </span>
    </span>
    <span
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-surface-raised"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </span>
  </button>
);

export const IntegrationsSettings = () => {
  const settings = useSettingsStore();
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);

  const togglePresence = async (enabled: boolean) => {
    settings.setDiscordRichPresenceEnabled(enabled);
    if (!enabled) {
      await invoke("clear_discord_presence").catch(() => undefined);
      setConnected(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      await invoke("set_discord_presence", {
        input: {
          applicationId: FLOWMANGA_DISCORD_APPLICATION_ID,
          details: "FlowManga connected",
          state: "Ready to read",
          startTimestamp: Math.floor(Date.now() / 1000),
          largeImage: FLOWMANGA_DISCORD_LARGE_IMAGE,
          largeText: "FlowManga — Read. Discover. Flow.",
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
        <h2 className="text-3xl font-black uppercase tracking-tighter text-foreground">
          Integrations
        </h2>
        <p className="mt-1 font-bold text-foreground-dim">
          Connect FlowManga to desktop services.
        </p>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-border-subtle bg-surface-elevated">
        <div className="flex items-start gap-4 border-b border-border-subtle p-6">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-400">
            <Gamepad2 size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-black text-foreground">
                Discord Rich Presence
              </h3>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                  connected
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "bg-surface-raised text-foreground-dim"
                }`}
              >
                {connected ? "Connected" : "Not tested"}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-foreground-dim">
              Shows FlowManga and optional reading details on your Discord
              profile. Discord desktop must be running.
            </p>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <button
            type="button"
            disabled={testing}
            onClick={testConnection}
            className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : connected ? (
              <CheckCircle2 size={15} />
            ) : (
              <Radio size={15} />
            )}
            Test connection
          </button>

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
            Rich Presence is off by default because Discord activity can be
            visible to friends and server members.
          </div>
        </div>
      </section>
    </div>
  );
};
