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
import { Headphones } from 'lucide-react';

type SettingsTab = 'general' | 'reader' | 'appearance' | 'audio' | 'downloads';

export const SettingsModal = () => {
    const { isSettingsOpen, toggleSettings } = useSettingsStore();
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    if (!isSettingsOpen) return null;

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'reader', label: 'Reader', icon: BookOpen },
        { id: 'audio', label: 'Audio', icon: Headphones },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'downloads', label: 'Downloads', icon: Download },
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
                        className="relative w-full max-w-5xl h-[80vh] bg-[#0A0A0A] rounded-[32px] border border-white/10 shadow-2xl flex overflow-hidden"
                    >
                        {/* Sidebar */}
                        <div className="w-64 bg-white/5 border-r border-white/5 p-6 flex flex-col gap-2">
                            <h2 className="text-2xl font-black text-white italic tracking-tighter mb-8 px-4">
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
                                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                                                : "text-neutral-400 hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        <Icon size={18} />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A]">
                            <div className="flex items-center justify-between p-8 border-b border-white/5">
                                <h3 className="text-xl font-black text-white uppercase tracking-widest">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h3>
                                <button 
                                    onClick={toggleSettings}
                                    className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
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
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
