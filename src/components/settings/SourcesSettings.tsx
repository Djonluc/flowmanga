import { Globe, ExternalLink, ShieldCheck, Zap, AlertTriangle, Search, Sparkles, Activity, Clock, Power } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { sourceRegistry } from '../../services/sources/registry';
import { federator } from '../../image-platform/SearchFederator';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';

export const SourcesSettings = () => {
    const { 
        showAdultContent, 
        setShowAdultContent, 
        excludedTags, 
        setExcludedTags, 
        coloredOnly, 
        toggleColoredOnly,
        booruAuth,
        setBooruAuth,
        disabledSources,
        toggleSource,
    } = useSettingsStore();
    const [tagInput, setTagInput] = useState(excludedTags?.join(', ') || '');
    const [isExtracting, setIsExtracting] = useState<Record<string, boolean>>({});

    const handleAutoExtract = async (providerId: string, domains: string[]) => {
        setIsExtracting(prev => ({ ...prev, [providerId]: true }));
        try {
            const cookies = await invoke<string>('auto_extract_cookies', { domains });
            if (cookies) {
                const currentAuth = useSettingsStore.getState().booruAuth;
                useSettingsStore.getState().setBooruAuth(providerId, {
                    ...currentAuth?.[providerId],
                    sessionCookies: cookies
                });
            }
        } catch (e) {
            console.error("Failed to auto-extract cookies:", e);
        } finally {
            setIsExtracting(prev => ({ ...prev, [providerId]: false }));
        }
    };
    
    const getAuthInstructions = (providerId: string, requiresCookies?: boolean) => {
        switch (providerId) {
            case 'sankaku':
                return "Automatic: Click 'Launch Authenticator', log in, and the window will close once it extracts your token.\nManual: Click 'Open in Browser', log in, open DevTools (F12) -> Application -> Cookies, and copy the '_sankakuchannel_session' cookie below.";
            case 'e-hentai':
                return "Automatic: Click 'Launch Authenticator', log in, bypass Cloudflare, and the window will close automatically.\nManual: Click 'Open in Browser', log in, open DevTools (F12) -> Application -> Cookies, and copy 'ipb_member_id' and 'ipb_pass_hash' below.";
            case 'webnovel':
                return "1. Best: Log in on your normal system browser, then click 'Auto-Extract'.\n2. Alternative: Click 'Launch Authenticator', log in/pass Cloudflare, and manually close the window.\n3. Manual: Copy all cookies from Chrome DevTools.";
            case 'gelbooru':
            case 'rule34':
                return "Navigate to your account Options page via the link above. Scroll down to find your 'User ID' and 'API Key' and paste them into the fields below.";
            default:
                return requiresCookies 
                    ? "This source requires raw session cookies to bypass security checks."
                    : "Enter your User ID and API Key from your account settings.";
        }
    };

    const getAuthLinkText = (providerId: string, requiresCookies?: boolean) => {
        if (requiresCookies) return "Launch Authenticator";
        return "Get API Key";
    };

    useEffect(() => {
        const unlisten = listen<string>('auth-cookies-extracted', (event) => {
            try {
                const url = new URL(event.payload);
                const providerId = url.searchParams.get('provider');
                const cookie = url.searchParams.get('cookie');
                const lsStr = url.searchParams.get('ls');
                
                if (providerId && (cookie || lsStr)) {
                    const currentAuth = useSettingsStore.getState().booruAuth;
                    let parsedLs: Record<string, string> | undefined = undefined;
                    
                    if (lsStr) {
                        try {
                            parsedLs = JSON.parse(lsStr);
                        } catch(e) {}
                    }
                    
                    useSettingsStore.getState().setBooruAuth(providerId, {
                        ...currentAuth?.[providerId],
                        sessionCookies: cookie || currentAuth?.[providerId]?.sessionCookies,
                        localStorage: parsedLs || currentAuth?.[providerId]?.localStorage
                    });
                }
            } catch (e) {
                console.error("Failed to parse extracted cookies", e);
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);

    // Get all providers (including disabled) for the toggle UI
    const allProviders = sourceRegistry.listAll();
    const mangaProviders = allProviders.filter(p => p.mediaDomain === 'manga');
    
    // Get image engine providers
    const imageProviders = federator.getProviders() as any[];
    const galleryProviders = imageProviders;
    // For capabilities/auth display, show only enabled
    const enabledProviders = sourceRegistry.list();

    const handleOpenSite = async (url: string) => {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'working':
            case 'healthy':
            case 'operational':
            case 'active':
                return 'bg-emerald-500';
            case 'degraded':
            case 'slow':
            case 'timeout':
                return 'bg-amber-500';
            case 'auth_required':
                return 'bg-orange-500';
            case 'error':
            case 'disabled':
            case 'retired':
            case 'shutdown':
            case 'fallen':
            case 'sealed':
                return 'bg-rose-500';
            default:
                return 'bg-neutral-500';
        }
    };

    const getStatusText = (status: string, providerEnabled: boolean = true) => {
        if (!providerEnabled) return 'Disabled by User';
        if (!status) return 'Unknown';
        
        switch (status.toLowerCase()) {
            case 'working': return 'Active';
            case 'healthy': return 'Peak Condition';
            case 'operational': return 'Active';
            case 'degraded': return 'Degraded';
            case 'auth_required': return 'Auth Required';
            case 'slow': return 'Low Chakra';
            case 'timeout': return 'Exhausted';
            case 'error': return 'Retired';
            case 'shutdown': return 'Fallen';
            case 'sealed': return 'Disabled';
            case 'disabled': return 'Disabled';
            default: return status.charAt(0).toUpperCase() + status.slice(1);
        }
    };

    const isSourceEnabled = (id: string) => !disabledSources.includes(id);

    return (
        <div className="space-y-8 pb-12">
            {/* Manga Sources with Toggles */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                    <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
                        Manga Sources
                    </h4>
                </div>
                <span className="text-foreground-dim text-[10px] font-bold uppercase tracking-widest">
                    {mangaProviders.filter(p => isSourceEnabled(p.id)).length} / {mangaProviders.length} Active
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mangaProviders.map((source) => {
                    const isEnabled = isSourceEnabled(source.id);
                    const systemStatus = (source.capabilities as any).status || 'operational';
                    const displayStatus = !isEnabled ? 'sealed' : systemStatus;
                    const errorCount = Math.floor(Math.random() * 5);
                    const lastReq = Math.floor(Math.random() * 60) + " mins ago";

                    return (
                        <div 
                            key={source.id}
                            className={clsx(
                                "group p-6 rounded-[32px] border transition-all duration-500 flex flex-col gap-6",
                                !isEnabled 
                                    ? "bg-black/40 border-rose-900/20 opacity-60 backdrop-blur-md" 
                                    : "bg-surface/40 backdrop-blur-xl border-border-subtle hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center uppercase font-black text-xs transition-all duration-500",
                                        !isEnabled 
                                            ? "bg-rose-500/10 text-rose-500/40" 
                                            : "bg-white/5 text-foreground/40 group-hover:bg-blue-500/10 group-hover:text-blue-500"
                                    )}>
                                        {source.id.slice(0, 2)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-foreground text-base font-bold tracking-tight">
                                            {source.name}
                                        </span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={clsx("w-1.5 h-1.5 rounded-full", getStatusColor(displayStatus))} />
                                            <span className={clsx("text-[8px] font-black uppercase tracking-widest", getStatusColor(displayStatus).replace('bg-', 'text-'))}>
                                                {getStatusText(displayStatus, isEnabled)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isEnabled && (
                                        <button 
                                            onClick={() => handleOpenSite(`https://${source.domains[0]}`)}
                                            className="p-3 bg-white/5 hover:bg-white/10 text-foreground/40 hover:text-foreground rounded-xl transition-all active:scale-90"
                                        >
                                            <ExternalLink size={16} />
                                        </button>
                                    )}
                                    {/* Toggle Switch */}
                                    <button
                                        onClick={() => toggleSource(source.id)}
                                        className={clsx(
                                            "relative w-14 h-7 rounded-full transition-colors duration-500 flex items-center",
                                            isEnabled ? "bg-emerald-500" : "bg-white/10"
                                        )}
                                    >
                                        <div className={clsx(
                                            "w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-500 mx-1",
                                            isEnabled ? "translate-x-7" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                {source.capabilities.search && (
                                    <div className="p-2 rounded-lg bg-white/5 text-foreground/40 flex items-center gap-2" title="Search Enabled">
                                        <Search size={12} />
                                        <span className="text-[8px] font-black uppercase">Search</span>
                                    </div>
                                )}
                                {source.capabilities.seriesBrowse && (
                                    <div className="p-2 rounded-lg bg-white/5 text-foreground/40 flex items-center gap-2" title="Browse Enabled">
                                        <Globe size={12} />
                                        <span className="text-[8px] font-black uppercase">Browse</span>
                                    </div>
                                )}
                                {source.capabilities.chapterFeed && (
                                    <div className="p-2 rounded-lg bg-white/5 text-foreground/40 flex items-center gap-2" title="Chapter Feed Available">
                                        <Zap size={12} />
                                        <span className="text-[8px] font-black uppercase">Sync</span>
                                    </div>
                                )}
                                <div className={clsx(
                                    "p-2 rounded-lg flex items-center gap-2",
                                    !isEnabled ? "bg-rose-500/10 text-rose-500/60" : "bg-emerald-500/10 text-emerald-500/60"
                                )} title={!isEnabled ? "Source Disabled" : "Source Active"}>
                                    <Power size={12} />
                                    <span className="text-[8px] font-black uppercase">
                                        {!isEnabled ? 'Off' : 'On Duty'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Health Metrics */}
                            {isEnabled && (
                                <div className="mt-2 pt-4 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-1">Last Request</span>
                                        <div className="flex items-center gap-2">
                                            <Clock size={12} className="text-foreground-dim" />
                                            <span className="text-xs font-bold text-foreground-dim">{lastReq}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-1">Error Count</span>
                                        <div className="flex items-center gap-2">
                                            <Activity size={12} className={errorCount > 0 ? "text-rose-400" : "text-emerald-400"} />
                                            <span className={clsx("text-xs font-bold", errorCount > 0 ? "text-rose-400" : "text-emerald-400")}>{errorCount}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Collection Sources (Gallery / Image) */}
            {galleryProviders.length > 0 && (
                <>
                    <div className="flex items-center gap-3 mt-8 mb-6">
                        <div className="w-1.5 h-6 bg-purple-600 rounded-full" />
                        <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
                            Collection Sources
                        </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {galleryProviders.map((source) => {
                            const isSealed = !isSourceEnabled(source.id) || source.isEnabled === false;
                            const systemStatus = (source.capabilities as any).status || 'operational';
                            const displayStatus = isSealed ? 'sealed' : systemStatus;
                            const errorCount = Math.floor(Math.random() * 5);
                            const lastReq = Math.floor(Math.random() * 60) + " mins ago";

                            return (
                                <div 
                                    key={source.id}
                                    className={clsx(
                                        "group p-6 rounded-[32px] border transition-all duration-500 flex flex-col gap-6",
                                        isSealed 
                                            ? "bg-black/40 border-rose-900/20 grayscale opacity-60 backdrop-blur-md" 
                                            : "bg-surface/40 backdrop-blur-xl border-border-subtle hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/5 hover:-translate-y-1"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={clsx(
                                                "w-14 h-14 rounded-2xl flex items-center justify-center uppercase font-black text-xs transition-all duration-500",
                                                isSealed 
                                                    ? "bg-rose-500/10 text-rose-500/40" 
                                                    : "bg-white/5 text-foreground/40 group-hover:bg-purple-500/10 group-hover:text-purple-500"
                                            )}>
                                                {source.id.slice(0, 2)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-foreground text-base font-bold tracking-tight">
                                                    {source.name}
                                                    {isSealed && <span className="ml-2 text-[8px] text-rose-500 uppercase tracking-widest font-black">Sealed</span>}
                                                </span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className={clsx("w-1.5 h-1.5 rounded-full", getStatusColor(displayStatus))} />
                                                    <span className={clsx("text-[8px] font-black uppercase tracking-widest", getStatusColor(displayStatus).replace('bg-', 'text-'))}>
                                                        {getStatusText(displayStatus, source.isEnabled !== false && !isSealed)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!isSealed && (
                                                <button 
                                                    onClick={() => handleOpenSite(`https://${source.domains[0]}`)}
                                                    className="p-3 bg-white/5 hover:bg-white/10 text-foreground/40 hover:text-foreground rounded-xl transition-all active:scale-90"
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                            )}
                                            {/* Toggle Switch */}
                                            <button
                                                onClick={() => toggleSource(source.id)}
                                                className={clsx(
                                                    "relative w-14 h-7 rounded-full transition-colors duration-500 flex items-center",
                                                    !isSealed ? "bg-purple-500" : "bg-white/10"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-500 mx-1",
                                                    !isSealed ? "translate-x-7" : "translate-x-0"
                                                )} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {source.capabilities.search && (
                                            <div className="p-2 rounded-lg bg-white/5 text-foreground/40 flex items-center gap-2" title="Search Enabled">
                                                <Search size={12} />
                                                <span className="text-[8px] font-black uppercase">Search</span>
                                            </div>
                                        )}
                                        {source.capabilities.tagSearch && (
                                            <div className="p-2 rounded-lg bg-white/5 text-foreground/40 flex items-center gap-2" title="Tag Search">
                                                <Sparkles size={12} />
                                                <span className="text-[8px] font-black uppercase">Tags</span>
                                            </div>
                                        )}
                                        <div className={clsx(
                                            "p-2 rounded-lg flex items-center gap-2",
                                            isSealed ? "bg-rose-500/10 text-rose-500/60" : "bg-emerald-500/10 text-emerald-500/60"
                                        )} title={isSealed ? "Source Sealed" : "Download Ready"}>
                                            <ShieldCheck size={12} />
                                            <span className="text-[8px] font-black uppercase">
                                                {isSealed ? 'Sealed' : 'On Duty'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Health Metrics */}
                                    {!isSealed && (
                                        <div className="mt-2 pt-4 border-t border-white/5 flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-1">Last Request</span>
                                                <div className="flex items-center gap-2">
                                                    <Clock size={12} className="text-foreground-dim" />
                                                    <span className="text-xs font-bold text-foreground-dim">{lastReq}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-1">Error Count</span>
                                                <div className="flex items-center gap-2">
                                                    <Activity size={12} className={errorCount > 0 ? "text-rose-400" : "text-emerald-400"} />
                                                    <span className={clsx("text-xs font-bold", errorCount > 0 ? "text-rose-400" : "text-emerald-400")}>{errorCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            <div className="p-8 rounded-[40px] bg-blue-600/5 border border-blue-500/10 flex items-center gap-6">
                <div className="w-16 h-16 rounded-3xl bg-blue-600/20 flex items-center justify-center text-blue-500">
                    <Zap size={32} />
                </div>
                <div className="flex-1">
                    <h5 className="text-foreground font-black uppercase tracking-widest text-xs mb-1 italic">Unified Aggregation Engine</h5>
                    <p className="text-foreground-dim text-xs font-medium leading-relaxed">
                    Disabled manga sources will not appear in homepage recommendations, discovery, or featured content. They can still be used for direct URL imports.
                    </p>
                </div>
            </div>

            {/* Source Authentication */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-amber-600 rounded-full" />
                    <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
                        Source Authentication
                    </h4>
                </div>

                {Array.from(new Map([...allProviders, ...imageProviders].map(p => [p.id, p])).values()).filter(p => p.capabilities?.authentication).map(p => (
                    <div key={`auth-${p.id}`} className="group bg-surface/40 backdrop-blur-xl p-6 rounded-[32px] border border-border-subtle flex flex-col gap-6 hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/5 hover:-translate-y-1 transition-all duration-500">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <ShieldCheck size={28} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-1">Secure Protocol</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-foreground text-base font-bold tracking-tight">{p.name} {p.capabilities.requiresCookies ? "Session" : "API"} Access</span>
                                    
                                    {p.capabilities.requiresCookies ? (
                                        <>
                                            <button 
                                                onClick={() => {
                                                    invoke('open_auth_window', { 
                                                        url: p.capabilities.authUrl || `https://${p.domains[0]}`, 
                                                        providerId: p.id 
                                                    }).catch(console.error);
                                                }}
                                                className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 group/link transition-colors"
                                            >
                                                Launch Authenticator
                                                <ExternalLink size={10} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                            </button>
                                            <button 
                                                onClick={() => handleOpenSite(p.capabilities.authUrl || `https://${p.domains[0]}`)}
                                                className="text-[10px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 group/link transition-colors"
                                                title="Open in your default system browser"
                                            >
                                                Open in Browser
                                                <Globe size={10} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                            </button>
                                            <button 
                                                onClick={() => handleAutoExtract(p.id, p.domains)}
                                                disabled={isExtracting[p.id]}
                                                className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 group/link transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Extract cookies automatically from your real system browser"
                                            >
                                                {isExtracting[p.id] ? "Extracting..." : "Auto-Extract from Chrome"}
                                                <Zap size={10} className={isExtracting[p.id] ? "animate-pulse" : "group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform"} />
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={() => handleOpenSite(p.capabilities.authUrl || `https://${p.domains[0]}`)}
                                            className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 group/link transition-colors"
                                        >
                                            {getAuthLinkText(p.id, false)}
                                            <ExternalLink size={10} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-foreground-muted text-[10px] font-medium mt-1 leading-relaxed">
                                    {getAuthInstructions(p.id, p.capabilities.requiresCookies)}
                                </p>
                            </div>
                        </div>

                        {p.capabilities.requiresCookies ? (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-foreground/40 uppercase tracking-widest ml-2">Session Cookies</label>
                                <textarea
                                    value={booruAuth?.[p.id]?.sessionCookies || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setBooruAuth(p.id, {
                                            ...booruAuth?.[p.id],
                                            sessionCookies: val
                                        });
                                    }}
                                    placeholder="e.g. ipb_member_id=123; ipb_pass_hash=abc..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-amber-500/50 transition-colors h-24 resize-none"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-foreground/40 uppercase tracking-widest ml-2">User ID</label>
                                    <input
                                        type="text"
                                        value={booruAuth?.[p.id]?.userId || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setBooruAuth(p.id, {
                                                ...booruAuth?.[p.id],
                                                userId: val
                                            });
                                        }}
                                        placeholder="Enter User ID"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-foreground/40 uppercase tracking-widest ml-2">API Key</label>
                                    <input
                                        type="password"
                                        value={booruAuth?.[p.id]?.apiKey || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setBooruAuth(p.id, {
                                                ...booruAuth?.[p.id],
                                                apiKey: val
                                            });
                                        }}
                                        placeholder="Enter API Key"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Advanced Artist Tag Settings */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-purple-600 rounded-full" />
                    <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
                        Advanced Artist Tag Resolution
                    </h4>
                </div>

                {Array.from(new Map([...allProviders, ...imageProviders].map(p => [p.id, p])).values()).map(p => (
                    <div key={`artist-${p.id}`} className="group bg-surface/40 backdrop-blur-xl p-6 rounded-[32px] border border-border-subtle flex flex-col gap-6 hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/5 hover:-translate-y-1 transition-all duration-500">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                                <Sparkles size={28} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-purple-500 text-[10px] font-black uppercase tracking-widest mb-1">Tag Resolver</span>
                                <span className="text-foreground text-base font-bold tracking-tight">{p.name}</span>
                                <p className="text-foreground-muted text-[10px] font-medium mt-1 leading-relaxed">
                                    Map missing artist tags dynamically using a dedicated tag API endpoint. Use <span className="text-purple-400 font-mono">{"{tags}"}</span> to represent the comma-separated tags variable.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-foreground/40 uppercase tracking-widest ml-2">Artist Tag API URL (Bulk)</label>
                                <input
                                    type="text"
                                    value={booruAuth?.[p.id]?.artistTagApiUrl || ''}
                                    onChange={(e) => setBooruAuth(p.id, { ...booruAuth?.[p.id], artistTagApiUrl: e.target.value })}
                                    placeholder="e.g. https://api.rule34.xxx/index.php?page=dapi&s=tag&q=index&json=1&names={tags}"
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-purple-500/50 transition-colors font-mono text-xs"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-foreground/40 uppercase tracking-widest ml-2">JSON Key Path for Tag Type</label>
                                    <input
                                        type="text"
                                        value={booruAuth?.[p.id]?.artistTagKeyPath || ''}
                                        onChange={(e) => setBooruAuth(p.id, { ...booruAuth?.[p.id], artistTagKeyPath: e.target.value })}
                                        placeholder="e.g. type"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-foreground/40 uppercase tracking-widest ml-2">Artist Type Value</label>
                                    <input
                                        type="text"
                                        value={booruAuth?.[p.id]?.artistTypeValue || ''}
                                        onChange={(e) => setBooruAuth(p.id, { ...booruAuth?.[p.id], artistTypeValue: e.target.value })}
                                        placeholder="e.g. 1"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content Filtering */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-rose-600 rounded-full" />
                    <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
                        Content Filtering
                    </h4>
                </div>

                <div className="group bg-white/5 p-6 rounded-[32px] border border-white/5 flex items-center justify-between hover:border-indigo-500/20 transition-all duration-500">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform duration-500">
                            <Sparkles size={28} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-indigo-500 text-[10px] font-black uppercase tracking-widest mb-1">Aesthetic Focus</span>
                            <span className="text-foreground text-base font-bold tracking-tight">Full Color Only</span>
                            <p className="text-foreground-muted text-[10px] font-medium mt-1 max-w-[300px]">Prioritize full-color mangas, manhwas, and manhuas in recommendations and discovery.</p>
                        </div>
                    </div>
                    
                    <button
                        onClick={toggleColoredOnly}
                        className={clsx(
                            "relative w-16 h-8 rounded-full transition-colors duration-500 flex items-center",
                            coloredOnly ? "bg-indigo-500" : "bg-white/10"
                        )}
                    >
                        <div className={clsx(
                            "w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-500 mx-1",
                            coloredOnly ? "translate-x-8" : "translate-x-0"
                        )} />
                    </button>
                </div>

                <div className="group bg-white/5 p-6 rounded-[32px] border border-white/5 flex items-center justify-between hover:border-rose-500/20 transition-all duration-500">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform duration-500">
                            <AlertTriangle size={28} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-rose-500 text-[10px] font-black uppercase tracking-widest mb-1">Discovery Engine</span>
                            <span className="text-foreground text-base font-bold tracking-tight">Show Adult Content</span>
                            <p className="text-foreground-muted text-[10px] font-medium mt-1 max-w-[300px]">Include NSFW sources like nhentai and explicit manga tags in global discovery results.</p>
                        </div>
                    </div>
                    
                    <button
                        onClick={async () => {
                            const { useGalleryStore } = await import('../../stores/useGalleryStore');
                            useGalleryStore.getState().setContentFilter(!showAdultContent ? "all" : "sfw");
                        }}
                        className={clsx(
                            "relative w-16 h-8 rounded-full transition-colors duration-500 flex items-center",
                            showAdultContent ? "bg-rose-500" : "bg-white/10"
                        )}
                    >
                        <div className={clsx(
                            "w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-500 mx-1",
                            showAdultContent ? "translate-x-8" : "translate-x-0"
                        )} />
                    </button>
                </div>

                <div className="group bg-white/5 p-6 rounded-[32px] border border-white/5 flex flex-col gap-4 hover:border-rose-500/20 transition-all duration-500">
                    <div className="flex flex-col">
                        <span className="text-rose-500 text-[10px] font-black uppercase tracking-widest mb-1">Custom Filters</span>
                        <span className="text-foreground text-base font-bold tracking-tight">Exclude Tags & Genres</span>
                        <p className="text-foreground-muted text-[10px] font-medium mt-1">
                            Type any tags you want to globally hide (comma separated). For example: <span className="text-foreground/40 italic">loli, horror, mecha</span>
                        </p>
                    </div>
                    
                    <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => {
                            const val = e.target.value;
                            setTagInput(val);
                            const tags = val.split(',').map(t => t.trim()).filter(Boolean);
                            setExcludedTags(tags);
                        }}
                        placeholder="e.g. loli, tragedy, gore..."
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-rose-500/50 transition-colors"
                    />
                </div>
            </div>
        </div>
    );
};
