import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Check, XCircle } from 'phosphor-react';
import { useCallback } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z as zod } from 'zod';

import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/Form/Button';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/apiClient';
import { withSSRGuest } from '@/utils/withSSRGuest';

const resetPasswordFormSchema = zod
  .object({
    // Mesmo mínimo exigido pela API (ver PATCH /password/reset).
    password: zod
      .string()
      .min(8, 'A senha precisa ter pelo menos 8 caracteres'),
    passwordConfirmation: zod.string().min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'As senhas não coincidem',
    path: ['passwordConfirmation'],
  });

type IResetPasswordFormData = zod.infer<typeof resetPasswordFormSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();

  // Query string, não parâmetro de rota dinâmica — mas só confiamos nela
  // depois de router.isReady pra não piscar o estado de erro antes da
  // hidratação terminar de ler a URL.
  const tokenFromQuery = router.query.token;
  const token = typeof tokenFromQuery === 'string' ? tokenFromQuery : null;

  const { control, handleSubmit } = useForm<IResetPasswordFormData>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: '', passwordConfirmation: '' },
  });

  // MUTATION RESET PASSWORD
  //
  // "isSuccess" e "error" vêm do próprio useMutation — nada de estado
  // local duplicando o que o TanStack Query já rastreia. "isTokenInvalid"
  // abaixo é só uma leitura de "error" (não um useState): token ausente
  // na URL e token rejeitado pela API (inexistente, de outro tipo, ou
  // expirado) caem no MESMO estado de erro — a API devolve a mesma
  // mensagem genérica pros três casos, de propósito (ver openapi.yaml),
  // então não tem como nem faz sentido distinguir aqui.
  const {
    mutateAsync: resetPasswordMutate,
    isPending: isLoadingReset,
    isSuccess: isResetDone,
    error: resetPasswordError,
  } = useMutation({
    mutationFn: async ({ password }: IResetPasswordFormData) => {
      await api.patch('/password/reset', { token, password });
    },
  });
  // END MUTATION RESET PASSWORD

  // FUNCTIONS
  const handleResetPassword: SubmitHandler<IResetPasswordFormData> =
    useCallback(
      async (formData) => {
        try {
          await resetPasswordMutate(formData);
        } catch (err) {
          // 400 (token inválido/expirado) já vira a tela de erro sozinho,
          // através do "error" acima — nada a fazer aqui além de evitar
          // que o reject suba sem tratamento. Qualquer outra falha (rede,
          // 500) ainda merece um toast, já que não tem UI própria pra ela.
          if (err instanceof AxiosError && err.response?.status === 400) {
            return;
          }

          toast.error('Não foi possível redefinir a senha. Tente novamente.', {
            position: 'bottom-center',
            autoClose: 5000,
          });
        }
      },
      [resetPasswordMutate]
    );
  // END FUNCTIONS

  const isTokenInvalid =
    resetPasswordError instanceof AxiosError &&
    resetPasswordError.response?.status === 400;
  const showInvalidTokenState = router.isReady && (!token || isTokenInvalid);

  return (
    <AuthShell>
      <Head>
        <title>Redefinir senha | ArgilaAuto</title>
      </Head>

      <div className='mb-5 flex justify-center'>
        <Logo size={30} />
      </div>

      {/*
        4 estados mutuamente exclusivos, nessa ordem de prioridade:

        1) !router.isReady → não renderiza nada ainda. router.query só é
           confiável depois que o Next termina de ler a URL no cliente;
           antes disso "token" daria falso-negativo (pareceria ausente) e
           piscaria a tela de erro por uma fração de segundo à toa.

        2) showInvalidTokenState → painel de erro. Junta DOIS motivos no
           mesmo resultado (sem token nenhum na URL, OU a API rejeitou o
           token com 400) — tratados igual de propósito, não tem como
           (nem motivo pra) diferenciar pro usuário. Vem antes do estado
           de sucesso porque também cobre o caso "nunca teve token",
           que tem que barrar o formulário mesmo sem nenhuma tentativa
           de reset ter acontecido ainda.

        3) isResetDone → painel de sucesso. Só é alcançado se (2) for
           falso, ou seja, havia token e ele não foi rejeitado. Vem
           direto do "isSuccess" do useMutation (não é estado nosso).

        4) Nenhum dos anteriores → formulário de nova senha (caso normal:
           tem token na URL, ainda não deu certo nem deu 400).
      */}
      {!router.isReady ? null : showInvalidTokenState ? (
        <div className='text-center'>
          <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-crit-soft text-crit'>
            <XCircle size={28} weight='bold' />
          </div>
          <h1 className='font-display text-2xl font-bold'>
            Link inválido ou expirado
          </h1>
          <p className='mt-2 text-[13px] leading-relaxed text-text-muted'>
            Esse link de redefinição de senha não é mais válido. Peça um novo
            link pra continuar.
          </p>
          <Button
            onClick={() => router.push('/forgot-password')}
            className='mt-5'
          >
            Pedir novo link
          </Button>
        </div>
      ) : isResetDone ? (
        <div className='text-center'>
          <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-good'>
            <Check size={28} weight='bold' />
          </div>
          <h1 className='font-display text-2xl font-bold'>Senha redefinida!</h1>
          <p className='mt-2 text-[13px] leading-relaxed text-text-muted'>
            Sua senha foi alterada. Já dá pra entrar com ela.
          </p>
          <Button onClick={() => router.push('/login')} className='mt-5'>
            Ir para o login
          </Button>
        </div>
      ) : (
        <>
          <h1 className='font-display text-center text-2xl font-bold'>
            Crie uma nova senha
          </h1>
          <p className='mt-1 text-center text-[13px] text-text-muted'>
            Escolha uma senha nova pra sua conta.
          </p>

          <form
            onSubmit={handleSubmit(handleResetPassword)}
            noValidate
            className='mt-6'
          >
            <InputFormControl
              control={control}
              name='password'
              label='Nova senha'
              type='password'
              placeholder='Mínimo 8 caracteres'
            />
            <InputFormControl
              control={control}
              name='passwordConfirmation'
              label='Confirmar nova senha'
              type='password'
              placeholder='Repita a senha'
            />

            <Button type='submit' disabled={isLoadingReset} className='mt-5'>
              {isLoadingReset ? 'Salvando...' : 'Redefinir senha'}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

export const getServerSideProps = withSSRGuest(async () => {
  return {
    props: {},
  };
});
