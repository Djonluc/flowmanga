import { Globe, ExternalLink, ShieldCheck, Zap, AlertTriangle, Search, Sparkles, Activity, Clock } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { sourceRegistry } from '../../services/sources/registry';

export const SourcesSettings = () => {
    const { 
        showAdultContent, 
        setShowAdultContent, 
        excludedTags, 
        setExcludedTags, 
        coloredOnly, 
        toggleColoredOnly,
        booruAuth,
        setBooruAuth
    } = useSettingsStore();
    const [tagInput, setTagInput] = useState(excludedTags?.join(', ') || '');
    
    const providers = sourceRegistry.list();

    const handleOpenSite = async (url: string) => {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'healthy':
            case 'peak condition':
            case 'operational':
            case 'active':
                return 'bg-emerald-500';
            case 'slow':
            case 'timeout':
            case 'low chakra':
                return 'bg-amber-500';
            case 'error':
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
        if (!providerEnabled) return 'Sealed';
        if (!status) return 'In Hiding';
        
        switch (status.toLowerCase()) {
            case 'healthy': return 'Peak Condition';
            case 'operational': return 'Active';
            case 'slow': return 'Low Chakra';
            case 'timeout': return 'Exhausted';
            case 'error': return 'Retired';
            case 'shutdown': return 'Fallen';
            default: return status.charAt(0).toUpperCase() + status.slice(1);
        }
    };

    return (
        <div className="space-y-8 pb-12">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                    <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
                        Active Roster (Sources)
                    </h4>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map((source) => {
                    const isSealed = source.isEnabled === false;
                    const status = isSealed ? 'sealed' : 'operational';

                    return (
                        <div 
                            key={source.id}
                            className={clsx(
                                "group p-6 rounded-[32px] border transition-all duration-500 flex flex-col gap-6",
                                isSealed 
                                    ? "bg-black/40 border-rose-900/20 grayscale opacity-60" 
                                    : "bg-white/5 border-white/5 hover:border-blue-500/20"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center uppercase font-black text-xs transition-all duration-500",
                                        isSealed 
                                            ? "bg-rose-500/10 text-rose-500/40" 
                                            : "bg-white/5 text-foreground/40 group-hover:bg-blue-500/10 group-hover:text-blue-500"
                                    )}>
                                        {source.id.slice(0, 2)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-foreground text-base font-bold tracking-tight">
                                            {source.name}
                                            {isSealed && <span className="ml-2 text-[8px] text-rose-500 uppercase tracking-widest font-black">Sealed</span>}
                                        </span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={clsx("w-1.5 h-1.5 rounded-full", getStatusColor(status))} />
                                            <span className={clsx("text-[8px] font-black uppercase tracking-widest", status === 'unknown' ? 'text-foreground-dim' : getStatusColor(status).replace('bg-', 'text-'))}>
                                                {getStatusText(status, source.isEnabled !== false)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {!isSealed && (
                                    <button 
                                        onClick={() => handleOpenSite(`https://${source.domains[0]}`)}
                                        className="p-3 bg-white/5 hover:bg-white/10 text-foreground/40 hover:text-foreground rounded-xl transition-all active:scale-90"
                                    >
                                        <ExternalLink size={16} />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
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
                                    isSealed || status === 'error' || status === 'shutdown' ? "bg-rose-500/10 text-rose-500/60" : "bg-emerald-500/10 text-emerald-500/60"
                                )} title={isSealed ? "Source Sealed" : (status === 'error' || status === 'shutdown' ? "Source Maintenance" : "Download Ready")}>
                                    <ShieldCheck size={12} />
                                    <span className="text-[8px] font-black uppercase">
                                        {isSealed ? 'Banished' : (status === 'error' || status === 'shutdown' ? 'Retraining' : 'On Duty')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-8 rounded-[40px] bg-blue-600/5 border border-blue-500/10 flex items-center gap-6">
                <div className="w-16 h-16 rounded-3xl bg-blue-600/20 flex items-center justify-center text-blue-500">
                    <Zap size={32} />
                </div>
                <div className="flex-1">
                    <h5 className="text-foreground font-black uppercase tracking-widest text-xs mb-1 italic">Unified Aggregation Engine</h5>
                    <p className="text-foreground-dim text-xs font-medium leading-relaxed">
                    Metadata and discovery are powered by the MangaDex API and registered source providers. Sources are validated at registration time to ensure stability.
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

                {providers.filter(p => p.capabilities.authentication).map(p => (
                    <div key={`auth-${p.id}`} className="group bg-white/5 p-6 rounded-[32px] border border-white/5 flex flex-col gap-6 hover:border-amber-500/20 transition-all duration-500">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <ShieldCheck size={28} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-1">Secure Protocol</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-foreground text-base font-bold tracking-tight">{p.name} API Access</span>
                                    <button 
                                        onClick={() => handleOpenSite(p.capabilities.authUrl || `https://${p.domains[0]}`)}
                                        className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 group/link"
                                    >
                                        Get API Key
                                        <ExternalLink size={10} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                    </button>
                                </div>
                                <p className="text-foreground-muted text-[10px] font-medium mt-1">
                                    Gelbooru and other DAPI sources now require mandatory authentication. Enter your User ID and API Key from your account settings.
                                </p>
                            </div>
                        </div>

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
