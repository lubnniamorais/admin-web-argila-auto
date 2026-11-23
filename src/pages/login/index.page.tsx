import { zodResolver } from '@hookform/resolvers/zod';
import Head from 'next/head';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z as zod } from 'zod';

import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/Form/Button';
import { ForgotPassword } from '@/components/Form/ForgotPassword';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/hooks/auth';
import { withSSRGuest } from '@/utils/withSSRGuest';

const loginFormSchema = zod.object({
  email: zod
    .string()
    .min(1, 'Informe o e-mail')
    .email('Informe um e-mail válido'),
  password: zod.string().min(1, 'Informe a senha'),
});

type ILoginFormData = zod.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const { signIn } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ILoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  // Bug real corrigido em 22/11/2026: antes, um 402 (assinatura vencida)
  // em GET /users/me subia até aqui e travava a pessoa na tela de login
  // pra sempre, sem jeito de chegar numa tela que resolvesse o bloqueio.
  // `signIn` (ver hooks/auth.tsx) já trata o 402 internamente e navega
  // pra `/assinatura-pendente` sozinho — o catch abaixo só sobra pra
  // erro de credencial de verdade (401) ou falha de rede.
  async function handleSignIn({ email, password }: ILoginFormData) {
    try {
      await signIn({ email, password });
    } catch {
      toast.error('E-mail ou senha inválidos. Tente novamente.', {
        position: 'bottom-center',
        autoClose: 5000,
      });
    }
  }

  return (
    <AuthShell>
      <Head>
        <title>Entrar | ArgilaAuto</title>
      </Head>

      <div className='mb-5 flex justify-center'>
        <Logo size={30} />
      </div>

      <h1 className='font-display text-center text-2xl font-bold'>
        Bem-vindo de volta
      </h1>

      <form onSubmit={handleSubmit(handleSignIn)} noValidate>
        <InputFormControl
          control={control}
          name='email'
          label='E-mail'
          type='email'
          placeholder='voce@suaoficina.com.br'
        />

        <InputFormControl
          control={control}
          name='password'
          label='Senha'
          type='password'
          placeholder='••••••••'
        />

        <div className='mt-2.5 text-right'>
          <ForgotPassword href='/forgot-password'>
            Esqueceu a senha?
          </ForgotPassword>
        </div>

        <Button type='submit' disabled={isSubmitting} className='mt-5'>
          Entrar
        </Button>
      </form>

      <p className='mt-4 text-center text-[13px] text-text-muted'>
        Não tem conta?{' '}
        <Link href='/signup' className='font-bold text-clay-deep'>
          Criar agora
        </Link>
      </p>
    </AuthShell>
  );
}

export const getServerSideProps = withSSRGuest(async () => {
  return {
    props: {},
  };
});
