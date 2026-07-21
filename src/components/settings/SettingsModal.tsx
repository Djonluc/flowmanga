import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, BookOpen, Download, Palette, Search } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import clsx from 'clsx';

import { GeneralSettings } from './GeneralSettings';
import { ReaderSettings } from './ReaderSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { DownloadSettings } from './DownloadSettings';
import { AmbientSettings } from './AmbientSettings';
import { SourcesSettings } from './SourcesSettings';
import { AutomationSettings } from './AutomationSettings';
import { UpdateSettings } from './UpdateSettings';
import { MangaIntelligenceDebugger } from './MangaIntelligenceDebugger';
import { AboutSettings } from './AboutSettings';
import { Headphones, Globe, Sparkles, RefreshCw, ShieldAlert, Brain, Info } from 'lucide-react';

type SettingsTab = 'general' | 'reader' | 'appearance' | 'audio' | 'downloads' | 'sources' | 'automation' | 'updates' | 'intelligence' | 'about';

export const SettingsModal = () => {
    const { isSettingsOpen, toggleSettings } = useSettingsStore();
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [searchQuery, setSearchQuery] = useState('');

    const tabGroups = [
        {
            group: 'Core',
            items: [
                { id: 'general', label: 'General', icon: Settings },
                { id: 'reader', label: 'Reader', icon: BookOpen },
                { id: 'appearance', label: 'Appearance', icon: Palette },
            ]
        },
        {
            group: 'Content',
            items: [
                { id: 'sources', label: 'Sources', icon: Globe },
                { id: 'downloads', label: 'Downloads', icon: Download },
                { id: 'automation', label: 'Automation', icon: Sparkles },
            ]
        },
        {
            group: 'Advanced',
            items: [
                { id: 'audio', label: 'Audio', icon: Headphones },
                { id: 'updates', label: 'Updates', icon: RefreshCw },
                { id: 'intelligence', label: 'Intelligence', icon: Brain },
                { id: 'about', label: 'About', icon: Info },
            ]
        }
    ];

    const filteredGroups = tabGroups.map(group => ({
        ...group,
        items: group.items.filter(item => 
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.id.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(group => group.items.length > 0);

    const activeTabLabel = tabGroups.flatMap(g => g.items).find(t => t.id === activeTab)?.label;

    return (
        <AnimatePresence>
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleSettings}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Window */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-5xl h-[80vh] bg-surface rounded-[32px] border border-border-strong shadow-cinematic flex overflow-hidden"
                    >
                        {/* Sidebar */}
                        <div className="w-64 bg-surface-elevated border-r border-border-subtle p-6 flex flex-col gap-2">
                            <h2 className="text-2xl font-black text-foreground italic tracking-tighter mb-8 px-4">
                                SETTINGS
                            </h2>
                            <div className="relative mb-6 px-4">
                                <div className="absolute inset-y-0 left-7 flex items-center pointer-events-none">
                                    <Search size={14} className="text-foreground-muted" />
                                </div>
                                <input 
                                    type="text"
                                    placeholder="Search settings..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-surface/50 border border-border-subtle rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto no-scrollbar">
                                {filteredGroups.map((group, gIdx) => (
                                    <div key={group.group} className={clsx("mb-6 px-4", gIdx === 0 ? "" : "border-t border-border-subtle/50 pt-4")}>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground-dim mb-3 pl-2">
                                            {group.group}
                                        </h4>
                                        <div className="flex flex-col gap-1">
                                            {group.items.map((tab) => {
                                                const Icon = tab.icon;
                                                const isActive = activeTab === tab.id;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setActiveTab(tab.id as SettingsTab)}
                                                        className={clsx(
                                                            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-bold tracking-wide",
                                                            isActive 
                                                                ? "bg-accent text-white shadow-lg shadow-accent-glow/20" 
                                                                : "text-foreground-dim hover:bg-surface-raised hover:text-foreground"
                                                        )}
                                                    >
                                                        <Icon size={16} />
                                                        <span>{tab.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col min-w-0 bg-surface">
                            <div className="flex items-center justify-between p-4 sm:p-6 lg:p-8 border-b border-border-subtle">
                                <h3 className="text-xl font-black text-foreground uppercase tracking-widest">
                                    {activeTabLabel}
                                </h3>
                                <button 
                                    onClick={toggleSettings}
                                    className="p-2 rounded-full hover:bg-surface-elevated text-foreground-dim hover:text-foreground transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8">
                                <div className={clsx(activeTab === 'appearance' ? "max-w-5xl" : "max-w-2xl", "mx-auto space-y-8")}>
                                    {activeTab === 'general' && <GeneralSettings />}
                                    {activeTab === 'reader' && <ReaderSettings />}
                                    {activeTab === 'audio' && <AmbientSettings />}
                                    {activeTab === 'appearance' && <AppearanceSettings />}
                                    {activeTab === 'downloads' && <DownloadSettings />}
                                    {activeTab === 'automation' && <AutomationSettings />}
                                    {activeTab === 'sources' && <SourcesSettings />}
                                    {activeTab === 'updates' && <UpdateSettings />}
                                    {activeTab === 'intelligence' && <MangaIntelligenceDebugger />}
                                    {activeTab === 'about' && <AboutSettings />}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
