import { Globe, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import clsx from 'clsx';

const SUPPORTED_SOURCES = [
    {
        name: 'MangaDex',
        url: 'https://mangadex.org',
        description: 'Primary source for high-quality manga and scanlations.',
        status: 'Online',
        type: 'Official API',
        color: 'blue'
    },
    {
        name: 'ManhwaRead',
        url: 'https://manhwaread.com',
        description: 'Extensive library of Manhwa and webtoons.',
        status: 'Online',
        type: 'Scraper',
        color: 'purple'
    },
    {
        name: 'Dragon Ball Multiverse',
        url: 'https://www.dragonball-multiverse.com',
        description: 'The ultimate fan-made sequel to Dragon Ball.',
        status: 'Online',
        type: 'Native Scraper',
        color: 'orange'
    },
    {
        name: 'Blue Lock Manga',
        url: 'https://w45.blue-lock-manga.com',
        description: 'Dedicated source for Blue Lock chapters.',
        status: 'Online',
        type: 'Native Scraper',
        color: 'indigo'
    }
];

export const SourcesSettings = () => {
    const handleOpenSite = async (url: string) => {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
    };

    return (
        <div className="space-y-8 pb-12">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                <h4 className="text-white font-black uppercase tracking-widest text-sm italic">
                    Supported Sources
                </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SUPPORTED_SOURCES.map((source) => (
                    <div 
                        key={source.name}
                        onClick={() => handleOpenSite(source.url)}
                        className="group relative bg-white/5 border border-white/5 rounded-[32px] p-6 hover:bg-white/[0.08] hover:border-blue-500/20 transition-all duration-500 cursor-pointer overflow-hidden"
                    >
                        <div className="relative z-10 flex flex-col gap-4">
                            <div className="flex items-start justify-between">
                                <div className={clsx(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110",
                                    source.color === 'blue' && "bg-blue-500/10 text-blue-500",
                                    source.color === 'purple' && "bg-purple-500/10 text-purple-500",
                                    source.color === 'orange' && "bg-orange-500/10 text-orange-500",
                                    source.color === 'indigo' && "bg-indigo-500/10 text-indigo-500"
                                )}>
                                    <Globe size={24} />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                                        <ShieldCheck size={10} />
                                        {source.status}
                                    </div>
                                    <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">{source.type}</span>
                                </div>
                            </div>

                            <div>
                                <h5 className="text-white font-black uppercase tracking-tighter text-lg flex items-center gap-2">
                                    {source.name}
                                    <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-blue-500" />
                                </h5>
                                <p className="text-neutral-500 text-xs font-medium mt-1 leading-relaxed">
                                    {source.description}
                                </p>
                            </div>
                        </div>

                        {/* Background Decoration */}
                        <div className={clsx(
                            "absolute -bottom-4 -right-4 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity duration-700",
                            source.color === 'blue' && "text-blue-500",
                            source.color === 'purple' && "text-purple-500",
                            source.color === 'orange' && "text-orange-500",
                            source.color === 'indigo' && "text-indigo-500"
                        )}>
                            <Globe size={96} strokeWidth={1} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-8 rounded-[40px] bg-blue-600/5 border border-blue-500/10 flex items-center gap-6">
                <div className="w-16 h-16 rounded-3xl bg-blue-600/20 flex items-center justify-center text-blue-500">
                    <Zap size={32} />
                </div>
                <div className="flex-1">
                    <h5 className="text-white font-black uppercase tracking-widest text-xs mb-1 italic">Adding New Sources</h5>
                    <p className="text-neutral-500 text-xs font-medium leading-relaxed">
                        Sources are added via localized scrapers. If you have a specific site in mind, please request an integration in the feedback panel.
                    </p>
                </div>
            </div>
        </div>
    );
};
