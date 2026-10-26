import { ReactNode } from 'react';

interface AuthShellProps {
  children: ReactNode;
  wide?: boolean;
}

/**
 * Moldura compartilhada das telas de autenticação (Welcome, Login, Signup):
 * card centralizado com dois círculos decorativos ao fundo, igual ao
 * protótipo (.auth-wrap / .auth-card).
 */
export function AuthShell({ children, wide }: AuthShellProps) {
  return (
    <main className='relative flex min-h-screen items-center justify-center overflow-hidden p-6'>
      <div
        aria-hidden
        className='pointer-events-none absolute -top-[120px] -right-[120px] h-[480px] w-[480px] rounded-full opacity-50'
        style={{ border: '36px solid var(--clay-soft)' }}
      />
      <div
        aria-hidden
        className='pointer-events-none absolute -bottom-[160px] -left-[160px] h-[420px] w-[420px] rounded-full opacity-50'
        style={{ border: '28px solid var(--steel-soft)' }}
      />

      <div
        className={`relative z-10 w-full rounded-[20px] border border-border bg-surface p-9 shadow-[0_24px_60px_-24px_rgba(43,36,32,0.28)] ${
          wide ? 'max-w-[480px]' : 'max-w-[420px]'
        }`}
      >
        {children}
      </div>
    </main>
  );
}
