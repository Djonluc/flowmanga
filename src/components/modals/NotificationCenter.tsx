import { motion, AnimatePresence } from 'framer-motion';
import { useModalStore } from '../../stores/useModalStore';
import { Bell, X, Download, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

// Default system notifications for first-time setup
const DEFAULT_NOTIFICATIONS = [
    { id: 1, type: 'success', title: 'Welcome to FlowManga', message: 'Your reading environment has been initialized and is ready for exploration.', time: 'Just now', read: false },
    { id: 2, type: 'discovery', title: 'Discovery Engine Online', message: 'The recommendation engine is active. Your feeds will naturally evolve as you read.', time: 'Just now', read: false },
];

export const NotificationCenter = () => {
    const { isNotificationCenterOpen, closeNotificationCenter } = useModalStore();
    const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);

    if (!isNotificationCenterOpen) return null;

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAllRead = () => {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const getIcon = (type: string) => {
        switch(type) {
            case 'success': return <CheckCircle2 size={16} className="text-green-400" />;
            case 'discovery': return <Sparkles size={16} className="text-indigo-400" />;
            case 'warning': return <AlertTriangle size={16} className="text-amber-400" />;
            default: return <Bell size={16} className="text-foreground-dim" />;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" 
                onClick={closeNotificationCenter} 
            />
            
            <motion.div 
                initial={{ opacity: 0, x: 300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 300 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-full max-w-sm h-full bg-[#0A0A0A]/90 backdrop-blur-3xl border-l border-white/10 shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Bell size={20} className="text-foreground" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-[#0A0A0A]" />
                            )}
                        </div>
                        <h2 className="text-lg font-bold text-foreground tracking-tight">Notifications</h2>
                    </div>
                    
                    <button 
                        onClick={closeNotificationCenter}
                        className="p-2 text-foreground-dim hover:text-foreground hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Actions */}
                {unreadCount > 0 && (
                    <div className="px-6 py-3 border-b border-white/5 flex justify-end bg-white/[0.02]">
                        <button 
                            onClick={markAllRead}
                            className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            Mark all as read
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                            <Bell size={40} className="mb-4 text-foreground-muted" />
                            <p className="text-sm font-medium text-foreground-dim">You're all caught up!</p>
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <motion.div 
                                key={notif.id}
                                layout
                                className={clsx(
                                    "p-4 rounded-2xl border transition-all cursor-pointer group",
                                    notif.read 
                                        ? "bg-white/[0.02] border-transparent" 
                                        : "bg-white/[0.05] border-white/10 shadow-lg"
                                )}
                                onClick={() => {
                                    setNotifications(notifications.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                }}
                            >
                                <div className="flex gap-3">
                                    <div className={clsx(
                                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                                        notif.read ? "bg-white/5" : "bg-white/10"
                                    )}>
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className={clsx("text-xs font-bold truncate pr-2", notif.read ? "text-foreground-dim" : "text-foreground")}>
                                                {notif.title}
                                            </h4>
                                            <span className="text-[9px] font-bold text-foreground-muted uppercase tracking-widest flex-shrink-0">
                                                {notif.time}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-foreground-dim font-medium leading-snug">
                                            {notif.message}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </motion.div>
        </div>
    );
};
