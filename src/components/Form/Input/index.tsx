import { Eye, EyeSlash } from 'phosphor-react';
import { forwardRef, InputHTMLAttributes, useState } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, name, className, type, ...rest }, ref) => {
    const inputId = id ?? name;

    // Botão de mostrar/esconder senha (ícone Eye/EyeSlash) — decisão
    // confirmada com o usuário (23/11/2026): não tinha como conferir se
    // digitou a senha certo em nenhum dos 5 campos de senha do projeto
    // (Login, Signup, Redefinir senha x2, Convidar pra equipe). Centralizado
    // aqui no `Input` compartilhado (em vez de duplicado em cada tela) —
    // qualquer `type='password'` novo já nasce com o botão, de graça.
    const isPasswordField = type === 'password';
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    return (
      <div className='mt-4'>
        <label
          htmlFor={inputId}
          className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
        >
          {label}
        </label>

        <div className='relative'>
          <input
            id={inputId}
            name={name}
            ref={ref}
            type={
              isPasswordField ? (isPasswordVisible ? 'text' : 'password') : type
            }
            className={`w-full rounded-[9px] border border-border-strong bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1 ${
              isPasswordField ? 'pr-10' : ''
            } ${className ?? ''}`}
            {...rest}
          />

          {isPasswordField && (
            <button
              type='button'
              onClick={() => setIsPasswordVisible((previous) => !previous)}
              aria-label={
                isPasswordVisible ? 'Esconder senha' : 'Mostrar senha'
              }
              className='absolute top-1/2 right-3 -translate-y-1/2 text-text-muted transition-colors hover:text-clay'
            >
              {isPasswordVisible ? <EyeSlash size={17} /> : <Eye size={17} />}
            </button>
          )}
        </div>

        {error && <p className='mt-1.5 text-xs text-danger'>{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
