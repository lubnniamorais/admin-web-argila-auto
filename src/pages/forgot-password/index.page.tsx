import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ArrowLeft, PaperPlaneTilt } from 'phosphor-react';
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

const forgotPasswordFormSchema = zod.object({
  email: zod
    .string()
    .trim()
    .min(1, 'Informe o e-mail')
    .email('Informe um e-mail válido'),
});

type IForgotPasswordFormData = zod.infer<typeof forgotPasswordFormSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const { control, handleSubmit } = useForm<IForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: '' },
  });

  // MUTATION SEND FORGOT PASSWORD EMAIL
  //
  // "isSuccess" vem do próprio useMutation — nada de guardar isso em
  // estado local separado (useState), já que o TanStack Query já
  // rastreia sozinho se a última chamada terminou bem. POST
  // /password/forgot sempre devolve 204, exista ou não uma conta com
  // esse e-mail (decisão de segurança da API contra enumeração de
  // e-mail — ver openapi.yaml) — por isso não existe um "e-mail não
  // encontrado" pra tratar aqui, só o estado de "link enviado"
  // (genérico) de propósito.
  const {
    mutateAsync: sendForgotPasswordEmailMutate,
    isPending: isLoadingSendEmail,
    isSuccess: isEmailSent,
  } = useMutation({
    mutationFn: async ({ email }: IForgotPasswordFormData) => {
      await api.post('/password/forgot', { email });
    },
  });
  // END MUTATION SEND FORGOT PASSWORD EMAIL

  // FUNCTIONS
  const handleForgotPassword: SubmitHandler<IForgotPasswordFormData> =
    useCallback(
      async (formData) => {
        try {
          await sendForgotPasswordEmailMutate(formData);
        } catch {
          // Único jeito de cair aqui é falha de rede/servidor de verdade
          // (503 = APP_WEB_URL não configurada no servidor, por exemplo) —
          // o caso "e-mail não existe" nunca chega no catch, a API
          // devolve 204 igual.
          toast.error(
            'Não foi possível enviar o link agora. Tente novamente em instantes.',
            { position: 'bottom-center', autoClose: 5000 }
          );
        }
      },
      [sendForgotPasswordEmailMutate]
    );
  // END FUNCTIONS

  return (
    <AuthShell>
      <Head>
        <title>Esqueci minha senha | ArgilaAuto</title>
      </Head>

      <div className='mb-5 flex justify-center'>
        <Logo size={30} />
      </div>

      {/*
        2 estados: "isEmailSent" vem direto do "isSuccess" do useMutation
        (não é estado nosso) — assim que o POST /password/forgot resolve,
        troca o formulário pelo painel de confirmação genérico. Como a
        API sempre devolve 204 (exista ou não a conta, ver comentário na
        mutation acima), não existe um terceiro estado de "e-mail não
        encontrado" pra tratar aqui.
      */}
      {isEmailSent ? (
        <div className='text-center'>
          <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-good'>
            <PaperPlaneTilt size={26} weight='bold' />
          </div>
          <h1 className='font-display text-2xl font-bold'>
            Verifique seu e-mail
          </h1>
          <p className='mt-2 text-[13px] leading-relaxed text-text-muted'>
            Se existir uma conta com esse e-mail, você vai receber um link pra
            redefinir a senha em instantes. O link expira em 1 hora.
          </p>
        </div>
      ) : (
        <>
          <h1 className='font-display text-center text-2xl font-bold'>
            Esqueceu sua senha?
          </h1>
          <p className='mt-1 text-center text-[13px] text-text-muted'>
            Informe o e-mail da sua conta e mandamos um link pra redefinir a
            senha.
          </p>

          <form
            onSubmit={handleSubmit(handleForgotPassword)}
            noValidate
            className='mt-6'
          >
            <InputFormControl
              control={control}
              name='email'
              label='E-mail'
              type='email'
              placeholder='voce@suaoficina.com.br'
            />

            <Button
              type='submit'
              disabled={isLoadingSendEmail}
              className='mt-5'
            >
              {isLoadingSendEmail ? 'Enviando...' : 'Enviar link'}
            </Button>
          </form>
        </>
      )}

      <div className='mt-5 text-center'>
        <button
          type='button'
          onClick={() => router.push('/login')}
          className='inline-flex items-center gap-1.5 text-[13px] font-bold text-clay-deep'
        >
          <ArrowLeft size={14} />
          Voltar para o login
        </button>
      </div>
    </AuthShell>
  );
}

export const getServerSideProps = withSSRGuest(async () => {
  return {
    props: {},
  };
});
