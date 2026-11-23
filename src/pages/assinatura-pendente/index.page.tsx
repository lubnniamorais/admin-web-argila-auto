import { format } from '@formkit/tempo';
import { useMutation } from '@tanstack/react-query';
import Head from 'next/head';
import { Sparkle } from 'phosphor-react';
import { toast } from 'react-toastify';

import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/Form/Button';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/hooks/auth';
import { useWorkshop } from '@/hooks/workshop';
import { api } from '@/lib/apiClient';
import { withSSRAuth } from '@/utils/withSSRAuth';

// Tela de destino quando a assinatura da workshop está vencida (ver
// hooks/auth.tsx, `fetchAuthenticatedUser`/`signIn` — bug corrigido em
// 22/11/2026). Isolada do AppShell de propósito: o Menubar/tenant box
// dependem de `user.role` (GET /users/me), que fica permanentemente
// indisponível nesse estado (402) — construir essa tela sobre o shell
// normal deixaria a sidebar quebrada/vazia à toa. Usa a mesma moldura
// visual de Welcome/Login (`AuthShell`), mas com `withSSRAuth` (precisa
// do cookie de token, diferente de Welcome/Login que são só-visitante).
//
// Só existe um jeito de chegar aqui com um estado "bloqueado" de verdade
// (ver isWorkshopSubscriptionBlocked.ts na API): plano Básico, trial de
// 7 dias já vencido, sem assinatura paga ativa — o Pro nunca é
// bloqueado. Por isso a tela não precisa da matriz de estados inteira
// que `/configuracoes` mostra (Pro com cancelamento pendente, Pro
// renovando, etc.) — só esse um caso.
export default function AssinaturaPendentePage() {
  const { signOut } = useAuth();
  const { data: workshop, isLoading: isLoadingWorkshop } = useWorkshop();

  // MUTATION UPGRADE TO PRO
  const { mutateAsync: upgradeToProMutate, isPending: isLoadingUpgrade } =
    useMutation({
      mutationFn: async () => {
        const response = await api.post('/workshops/upgrade-to-pro');

        return response.data.checkout_url as string;
      },
      onError: () => {
        toast.error('Não foi possível iniciar o upgrade pro Pro agora.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });
  // END MUTATION UPGRADE TO PRO

  // MUTATION SUBSCRIBE TO BASIC
  const { mutateAsync: subscribeToBasicMutate, isPending: isLoadingSubscribe } =
    useMutation({
      mutationFn: async () => {
        const response = await api.post('/workshops/subscribe-to-basic');

        return response.data.checkout_url as string;
      },
      onError: () => {
        toast.error('Não foi possível iniciar a assinatura do Básico agora.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });
  // END MUTATION SUBSCRIBE TO BASIC

  async function handleUpgradeToPro() {
    try {
      const checkoutUrl = await upgradeToProMutate();

      toast.info('Redirecionando pra página de pagamento da AbacatePay...', {
        position: 'bottom-center',
        autoClose: 3000,
      });

      window.location.href = checkoutUrl;
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  }

  async function handleSubscribeToBasic() {
    try {
      const checkoutUrl = await subscribeToBasicMutate();

      toast.info('Redirecionando pra página de pagamento da AbacatePay...', {
        position: 'bottom-center',
        autoClose: 3000,
      });

      window.location.href = checkoutUrl;
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  }

  return (
    <AuthShell wide>
      <Head>
        <title>Assinatura pendente | ArgilaAuto</title>
      </Head>

      <div className='mb-5 flex justify-center'>
        <Logo size={30} />
      </div>

      <h1 className='font-display text-center text-2xl font-bold'>
        Sua assinatura está pendente
      </h1>

      {isLoadingWorkshop || !workshop ? (
        <p className='mt-3 text-center text-[13px] text-text-muted'>
          Carregando...
        </p>
      ) : (
        <p className='mt-3 text-center text-[13px] leading-relaxed text-text-muted'>
          O teste grátis de{' '}
          <span className='font-semibold text-foreground'>{workshop.name}</span>{' '}
          venceu em{' '}
          {format(workshop.subscription.trial_ends_at, 'DD/MM/YYYY', 'pt-BR')}.
          Assine um plano pra continuar usando o sistema.
        </p>
      )}

      <div className='mt-6 flex flex-col gap-2.5'>
        <Button
          variant='ghost'
          onClick={handleSubscribeToBasic}
          disabled={isLoadingSubscribe || !workshop}
        >
          {isLoadingSubscribe ? 'Abrindo...' : 'Assinar Básico'}
        </Button>

        <Button
          onClick={handleUpgradeToPro}
          disabled={isLoadingUpgrade || !workshop}
        >
          <span className='inline-flex items-center justify-center gap-2'>
            <Sparkle size={16} />
            {isLoadingUpgrade ? 'Abrindo...' : 'Fazer upgrade pro Pro'}
          </span>
        </Button>
      </div>

      <button
        type='button'
        onClick={signOut}
        className='mt-5 block w-full text-center text-[13px] font-semibold text-text-muted underline-offset-2 hover:underline'
      >
        Sair
      </button>
    </AuthShell>
  );
}

export const getServerSideProps = withSSRAuth(async () => {
  return {
    props: {},
  };
});
