import Head from 'next/head';

import { AppShell } from '@/components/AppShell';
import { withSSRAuth } from '@/utils/withSSRAuth';

// Conteúdo de verdade do Dashboard (KPIs, gráfico de faturamento, tabela de
// OS recentes) depende de mudanças que estão sendo feitas na API agora
// (nome do cliente/veículo embutido na OS, endpoint de faturamento mensal
// histórico — ver conversa) — por isso esta página por enquanto só prova
// que o AppShell (sidebar + topbar) funciona de ponta a ponta, autenticado
// de verdade. O conteúdo deste placeholder será substituído, não é a versão
// final da tela.
export default function DashboardPage() {
  return (
    <AppShell title='Dashboard' subtitle='Visão geral da oficina hoje'>
      <Head>
        <title>Dashboard | ArgilaAuto</title>
      </Head>

      <div className='rounded-[10px] border border-border bg-surface p-10 text-center shadow-[0_1px_2px_rgba(43,36,32,0.06),0_8px_24px_-12px_rgba(43,36,32,0.14)]'>
        <h3 className='font-display text-lg font-bold'>
          Conteúdo do Dashboard ainda não implementado
        </h3>
        <p className='mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-text-muted'>
          Esta tela existe só pra validar o casco do app (sidebar, topbar,
          autenticação, tema). Os KPIs, o gráfico de faturamento e a tabela de
          OS recentes entram depois que a API tiver o nome do cliente/veículo na
          OS e o endpoint de faturamento mensal histórico.
        </p>
      </div>
    </AppShell>
  );
}

export const getServerSideProps = withSSRAuth(async () => {
  return {
    props: {},
  };
});
