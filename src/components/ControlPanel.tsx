import { useSettingsStore } from '../stores/useSettingsStore';
import { useReadingStore } from '../stores/useReadingStore';
import { useTrackerStore } from '../stores/useTrackerStore';
import { BookOpen, MonitorPlay, ArrowDown, Keyboard, Sliders, X, Compass, Zap } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export const ControlPanel = () => {
  // Legacy floating settings panel removed in favor of unified SettingsModal
  return null;
};
