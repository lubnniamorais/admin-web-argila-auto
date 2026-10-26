import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, name, className, ...rest }, ref) => {
    const inputId = id ?? name;

    return (
      <div className='mt-4'>
        <label
          htmlFor={inputId}
          className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
        >
          {label}
        </label>

        <input
          id={inputId}
          name={name}
          ref={ref}
          className={`w-full rounded-[9px] border border-border-strong bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1 ${
            className ?? ''
          }`}
          {...rest}
        />

        {error && <p className='mt-1.5 text-xs text-danger'>{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
