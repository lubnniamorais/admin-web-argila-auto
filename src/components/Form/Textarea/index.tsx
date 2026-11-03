import { forwardRef, TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

// Mesmo visual/estrutura de Form/Input — só troca `<input>` por
// `<textarea>` pra texto livre mais longo (ex.: queixa do cliente,
// diagnóstico da OS).
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, name, className, rows = 3, ...rest }, ref) => {
    const textareaId = id ?? name;

    return (
      <div className='mt-4'>
        <label
          htmlFor={textareaId}
          className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
        >
          {label}
        </label>

        <textarea
          id={textareaId}
          name={name}
          ref={ref}
          rows={rows}
          className={`w-full resize-y rounded-[9px] border border-border-strong bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1 ${
            className ?? ''
          }`}
          {...rest}
        />

        {error && <p className='mt-1.5 text-xs text-danger'>{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
