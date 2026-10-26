import Link from 'next/link';
import { ReactNode } from 'react';

import { Logo } from '@/components/Logo';
import { Menubar } from '@/components/Menubar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/auth';
import { useWorkshop } from '@/hooks/workshop';

// Mesmo ponto de corte usado pelo Menubar (ver Menubar/index.tsx, mesma
// explicação sobre por que as classes "max-[880px]:..." abaixo têm que
// aparecer por extenso, não montadas via `${algumaConstante}:...` — o
// Tailwind só gera CSS pra classes que aparecem como texto literal no
// arquivo). Tem que ser o MESMO valor (880px) nos dois componentes, senão
// a sidebar encolhe num tamanho que não bate com o menu colapsado.

// A API devolve o papel do usuário em inglês (ver IUser em hooks/auth.tsx,
// que espelha o enum `role` do schema User) — só o rótulo exibido aqui é
// traduzido, o valor que trafega com a API continua em inglês.
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  RECEPTIONIST: 'Recepção',
  MECHANIC: 'Mecânico',
};

const PLAN_LABEL: Record<string, string> = {
  BASIC: 'Básico',
  PRO: 'Pro',
};

// "Carla Souza" -> "CS" (iniciais do primeiro e do último nome), pro avatar
// do rodapé da sidebar — mesmo critério visual do protótipo.
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  // Botões extras da topbar, específicos de cada tela (ex.: "+ Nova Ordem
  // de Serviço" no Dashboard) — nenhuma tela usa isso ainda.
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Casco comum de todas as telas autenticadas: sidebar (marca, oficina/plano,
 * navegação, usuário logado) + topbar (título da tela + tema) + área de
 * conteúdo. Equivalente ao `.app`/`.sidebar`/`main` do protótipo.
 *
 * Toda página que usa este componente deve estar protegida por
 * `withSSRAuth` (ver utils/withSSRAuth.ts) — o AppShell não verifica
 * autenticação sozinho, só assume que `useAuth()` já tem um usuário.
 */
export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: AppShellProps) {
  const { user, signOut } = useAuth();
  const { data: workshop } = useWorkshop();

  const isPro = workshop?.subscription.plan === 'PRO';

  return (
    <div className='flex min-h-screen'>
      {/* ===== SIDEBAR =====
          Fundo sempre escuro (clay-deep no claro, quase-preto no escuro) —
          por isso usa cores fixas (var(--clay-deep) / #241B14, texto
          #F7E9DC) em vez dos tokens "foreground/background" normais, que
          mudam com o tema da página. Abaixo de 880px (COLLAPSE_BREAKPOINT,
          mesmo valor do protótipo) a sidebar encolhe pra 76px, mostrando só
          ícones — mesmo critério do Menubar, que cuida da navegação. */}
      <aside className='sticky top-0 flex h-screen w-60 max-[880px]:w-[76px] flex-none flex-col gap-4 bg-[var(--clay-deep)] p-3.5 text-[#F7E9DC] dark:bg-[#241B14]'>
        <div className='flex items-center px-1.5 pt-0.5 max-[880px]:justify-center'>
          {/* Lockup completo (ícone + "ArgilaAuto") some no colapso, dando
              lugar só ao selo (iconOnly) — ver explicação na prop iconOnly
              de Logo/index.tsx. */}
          <Logo size={26} variant='dark' className='max-[880px]:hidden' />
          <Logo
            size={26}
            variant='dark'
            iconOnly
            className='hidden max-[880px]:inline-block'
          />
        </div>

        {/* Tenant box: nome da oficina + badge do plano atual — some no
            colapso (não cabe/não faz sentido só com ícones, igual ao
            protótipo: .tenant-box { display:none } nesse breakpoint). */}
        <div className='max-[880px]:hidden rounded-[10px] border border-white/10 bg-black/20 p-2.5'>
          <div className='truncate text-[12.5px] font-bold text-white'>
            {workshop?.name ?? '—'}
          </div>
          <div className='mt-2 flex items-center justify-between'>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                isPro
                  ? 'bg-[#F0DCC8] text-clay-deep'
                  : 'bg-white/15 text-[#F7E9DC]'
              }`}
            >
              {workshop ? PLAN_LABEL[workshop.subscription.plan] : '—'}
            </span>

            {/* Checkout de upgrade de verdade ainda não existe neste admin
                — por ora só leva pra Configurações (onde a gestão de
                assinatura vai morar), em vez de simular uma ação que
                ainda não foi construída. */}
            {workshop && !isPro && (
              <Link
                href='/configuracoes'
                className='text-[10.5px] font-bold text-[#F0DCC8] underline'
              >
                Fazer upgrade →
              </Link>
            )}
          </div>
        </div>

        {/* Navegação — componente próprio, cuida sozinho do colapso de
            cada item/grupo (ver Menubar/index.tsx). */}
        <Menubar />

        {/* Rodapé: usuário logado + sair. No colapso, esconde nome/papel
            (igual ao protótipo: .who { display:none }) e centraliza
            avatar + botão de sair. */}
        <div className='flex items-center gap-2.5 border-t border-white/15 pt-3 max-[880px]:justify-center'>
          <div className='flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white'>
            {user ? getInitials(user.name) : '—'}
          </div>
          <div className='min-w-0 flex-1 leading-tight max-[880px]:hidden'>
            <div className='truncate text-xs font-bold text-white'>
              {user?.name ?? '—'}
            </div>
            <div className='text-[10.5px] text-white/60'>
              {user ? ROLE_LABEL[user.role] : '—'}
            </div>
          </div>
          <button
            type='button'
            title='Sair'
            onClick={signOut}
            className='text-white/70 hover:text-white'
          >
            ⏻
          </button>
        </div>
      </aside>

      {/* ===== CONTEÚDO ===== */}
      <main className='flex min-w-0 flex-1 flex-col'>
        <div className='sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4'>
          <div>
            <h1 className='font-display text-xl font-bold'>{title}</h1>
            {subtitle && (
              <div className='mt-0.5 text-[12.5px] text-text-muted'>
                {subtitle}
              </div>
            )}
          </div>

          <div className='flex items-center gap-2.5'>
            <ThemeToggle />
            {actions}
          </div>
        </div>

        <div className='px-6 py-5 pb-12'>{children}</div>
      </main>
    </div>
  );
}
