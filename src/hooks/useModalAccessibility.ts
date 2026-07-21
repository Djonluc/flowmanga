import { useEffect, type RefObject } from 'react';

const focusableSelector = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalAccessibility<T extends HTMLElement>(open: boolean, containerRef: RefObject<T | null>, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(focusableSelector);
    (focusable?.[0] ?? container)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !container) return;
      const elements = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
      if (elements.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [containerRef, onClose, open]);
}
