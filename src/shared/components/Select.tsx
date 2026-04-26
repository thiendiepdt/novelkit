import type { SelectHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  fullWidth?: boolean;
  children: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ fullWidth = false, className = '', children, ...props }, ref) => {
    return (
      <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}>
        <select
          ref={ref}
          className={`appearance-none bg-bg-card border border-border-main text-text-primary rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-gold/50 transition-colors cursor-pointer ${
            fullWidth ? 'w-full' : ''
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
