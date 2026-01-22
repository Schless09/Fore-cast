import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center rounded-lg font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0e1a] disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary:
      'btn-casino-gold',
    secondary:
      'bg-[#1a1f2e] text-[#e8eaed] hover:bg-[#252b3d] border border-[#fbbf24]/20 hover:border-[#fbbf24]/40',
    outline:
      'border-2 border-[#fbbf24] text-[#fbbf24] hover:bg-[#fbbf24]/10 focus:ring-[#fbbf24]/50 backdrop-blur-sm',
    ghost:
      'text-[#e8eaed] hover:bg-[#1a1f2e]/50 focus:ring-[#fbbf24]/50',
    danger:
      'bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white hover:from-[#dc2626] hover:to-[#b91c1c] shadow-lg shadow-red-500/30',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
}
