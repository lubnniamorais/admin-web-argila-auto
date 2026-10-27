import { InputMask as InputMaskIMask } from 'imask';
import { InputHTMLAttributes } from 'react';
import { IMaskInput } from 'react-imask';

// Reconstruído a partir do template antigo (ver CLAUDE.md, "Componentes
// legados ainda quebrados"): a versão original usava `tailwind-variants`
// (lib não instalada) e cores SCREAMING_CASE que não existem nos tokens
// do ArgilaAuto. Reescrito pra espelhar exatamente o `Input` (mesmo
// label/caixa/erro), só trocando o `<input>` nativo pelo `IMaskInput` do
// react-imask (esse sim já era dependência do projeto).
interface InputMaskProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  error?: string;
  mask: string;
  // true (padrão) = guarda só os dígitos digitados; false = guarda com a
  // formatação da máscara (ex: "01310-100", com o traço); 'typed' = valor
  // tipado internamente pelo IMask. Ver uso em InputMaskFormControl.
  unmask?: boolean | 'typed';
  value?: string;
  onAccept: (
    value: string,
    mask: InputMaskIMask<{ [x: string]: unknown }>
  ) => void;
}

export function InputMask({
  label,
  error,
  id,
  name,
  mask,
  unmask = true,
  value,
  className,
  onAccept,
  ...rest
}: InputMaskProps) {
  const inputId = id ?? name;

  return (
    <div className='mt-4'>
      <label
        htmlFor={inputId}
        className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
      >
        {label}
      </label>

      <IMaskInput
        id={inputId}
        name={name}
        mask={mask}
        unmask={unmask}
        value={value}
        onAccept={onAccept}
        className={`w-full rounded-[9px] border border-border-strong bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1 ${
          className ?? ''
        }`}
        {...rest}
      />

      {error && <p className='mt-1.5 text-xs text-danger'>{error}</p>}
    </div>
  );
}
