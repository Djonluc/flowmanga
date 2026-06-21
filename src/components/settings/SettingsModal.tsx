import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, BookOpen, Download, Palette } from 'lucide-react';
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
import { Headphones, Globe, Sparkles, RefreshCw, ShieldAlert } from 'lucide-react';

type SettingsTab = 'general' | 'reader' | 'appearance' | 'audio' | 'downloads' | 'sources' | 'automation' | 'updates';

export const SettingsModal = () => {
    const { isSettingsOpen, toggleSettings } = useSettingsStore();
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'reader', label: 'Reader', icon: BookOpen },
        { id: 'audio', label: 'Audio', icon: Headphones },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'downloads', label: 'Downloads', icon: Download },
        { id: 'automation', label: 'Automation', icon: Sparkles },
        { id: 'sources', label: 'Sources', icon: Globe },
        { id: 'updates', label: 'Updates', icon: RefreshCw },
    ];

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
                            
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as SettingsTab)}
                                        className={clsx(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold uppercase tracking-wide",
                                            isActive 
                                                ? "bg-accent text-white shadow-lg shadow-accent-glow/20" 
                                                : "text-foreground-dim hover:bg-surface-raised hover:text-foreground"
                                        )}
                                    >
                                        <Icon size={18} />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col min-w-0 bg-surface">
                            <div className="flex items-center justify-between p-8 border-b border-border-subtle">
                                <h3 className="text-xl font-black text-foreground uppercase tracking-widest">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h3>
                                <button 
                                    onClick={toggleSettings}
                                    className="p-2 rounded-full hover:bg-surface-elevated text-foreground-dim hover:text-foreground transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                <div className="max-w-2xl mx-auto space-y-8">
                                    {activeTab === 'general' && <GeneralSettings />}
                                    {activeTab === 'reader' && <ReaderSettings />}
                                    {activeTab === 'audio' && <AmbientSettings />}
                                    {activeTab === 'appearance' && <AppearanceSettings />}
                                    {activeTab === 'downloads' && <DownloadSettings />}
                                    {activeTab === 'automation' && <AutomationSettings />}
                                    {activeTab === 'sources' && <SourcesSettings />}
                                    {activeTab === 'updates' && <UpdateSettings />}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
