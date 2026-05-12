import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-accent text-white shadow-[0_0_15px_var(--color-accent-glow)] hover:bg-accent/90',
      secondary: 'bg-white/10 text-foreground hover:bg-white/20 border border-white/5',
      ghost: 'bg-transparent text-foreground-dim hover:text-foreground hover:bg-white/10',
      danger: 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-[40px] px-6 text-sm font-bold uppercase tracking-widest',
      lg: 'h-12 px-8 text-base font-black uppercase tracking-[0.2em]',
      icon: 'h-[40px] w-[40px] flex items-center justify-center p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-[12px] transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
