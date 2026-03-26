import { cn } from '../../lib/utils';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
}

export function Button({ children, className, variant = 'default', size = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        variant === 'default'     && 'bg-slate-900 text-white hover:bg-slate-800',
        variant === 'destructive' && 'bg-red-600 text-white hover:bg-red-700',
        variant === 'outline'     && 'border border-slate-300 bg-white hover:bg-slate-50',
        variant === 'ghost'       && 'hover:bg-slate-100',
        size === 'default' && 'h-9 px-4 py-2 text-sm',
        size === 'sm'      && 'h-7 px-3 text-xs',
        size === 'lg'      && 'h-11 px-8 text-base',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
