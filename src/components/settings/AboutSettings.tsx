import { AppVersionService } from '../../services/AppVersionService';
import { Github, Twitter, Heart, Code2, CheckCircle2, ChevronRight, Activity, Terminal } from 'lucide-react';

export const AboutSettings = () => {
    return (
        <div className="flex flex-col gap-8 pb-12 w-full max-w-5xl mx-auto">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter">About FlowManga</h2>
                    <p className="text-foreground-dim font-bold tracking-wide mt-1">Built by Djonluc for the ultimate reading experience.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Developer Profile Card */}
                <div className="glass-panel p-8 rounded-[32px] border border-border-subtle relative overflow-hidden group lg:col-span-2">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent/10 blur-[80px] rounded-full group-hover:bg-accent/20 transition-colors" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full group-hover:bg-purple-500/20 transition-colors" />
                    
                    <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                        <div className="w-32 h-32 rounded-[32px] bg-accent/10 border-2 border-accent/20 flex flex-col items-center justify-center text-accent shadow-[0_0_30px_rgba(168,85,247,0.15)] flex-shrink-0">
                            <Terminal size={40} className="mb-2" />
                            <span className="font-black tracking-widest text-xs uppercase">Creator</span>
                        </div>
                        <div className="flex-1 text-center md:text-left space-y-4">
                            <div>
                                <h3 className="text-3xl font-black text-foreground tracking-tight">Djonluc (DjonStNix)</h3>
                                <p className="text-accent text-sm font-bold uppercase tracking-widest mt-1">Lead Developer & Architect</p>
                            </div>
                            <p className="text-foreground-dim text-sm font-medium leading-relaxed max-w-2xl">
                                FlowManga is a passion project built from the ground up to provide a premium, dynamic, and uncompromised offline-first reading experience. 
                                It leverages modern technologies like Tauri, React 19, and local intelligence engines to keep everything lightning fast and fully within your control.
                            </p>
                            <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
                                <SocialLink icon={<Github size={16} />} label="GitHub" url="https://github.com/Djonluc" />
                                <SocialLink icon={<Twitter size={16} />} label="Twitter" url="#" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tech Stack Card */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full" />
                     <div className="flex items-center gap-4 mb-6 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <Code2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-foreground font-black text-lg">Tech Stack</h3>
                            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Powered By</p>
                        </div>
                     </div>
                     <div className="space-y-3 relative z-10">
                        <TechItem name="Tauri framework" desc="Native OS Integration & Rust Backend" />
                        <TechItem name="React 19" desc="Concurrent UI Rendering" />
                        <TechItem name="Framer Motion" desc="Fluid Cinematic Animations" />
                        <TechItem name="TailwindCSS" desc="Utility-first styling" />
                        <TechItem name="SQLite" desc="Local AI Intelligence & Storage" />
                     </div>
                </div>

                {/* System Info Card */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full" />
                     <div className="flex items-center gap-4 mb-6 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h3 className="text-foreground font-black text-lg">System Status</h3>
                            <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Version Info</p>
                        </div>
                     </div>
                     <div className="space-y-4 relative z-10 bg-black/20 p-5 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                            <span className="text-foreground-dim text-sm font-bold">App Version</span>
                            <span className="text-emerald-400 font-mono font-bold">v{AppVersionService.getCurrentVersion()}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                            <span className="text-foreground-dim text-sm font-bold">Environment</span>
                            <span className="text-foreground font-mono font-bold">Production</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-foreground-dim text-sm font-bold">Local DB</span>
                            <span className="text-emerald-400 font-mono font-bold flex items-center gap-2">
                                <CheckCircle2 size={14} /> Synced
                            </span>
                        </div>
                     </div>
                </div>

            </div>
            
            <div className="text-center mt-8">
                <p className="text-foreground-muted text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    Made with <Heart size={12} className="text-red-500" /> by Djonluc
                </p>
            </div>
        </div>
    );
};

const SocialLink = ({ icon, label, url }: { icon: React.ReactNode, label: string, url: string }) => (
    <a 
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-foreground-dim hover:text-foreground border border-white/5 hover:border-white/20 transition-all font-bold text-xs uppercase tracking-widest"
    >
        {icon}
        {label}
    </a>
);

const TechItem = ({ name, desc }: { name: string, desc: string }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated border border-border-subtle group-hover:border-white/10 transition-colors">
        <span className="text-foreground font-bold text-sm">{name}</span>
        <span className="text-foreground-muted text-[10px] uppercase tracking-widest font-black hidden sm:block">{desc}</span>
    </div>
);
