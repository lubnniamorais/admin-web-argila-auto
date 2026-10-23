import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import Head from 'next/head';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z as zod } from 'zod';

import { Footer } from '@/components/Footer';
import { Button } from '@/components/Form/Button';
import { ForgotPassword } from '@/components/Form/ForgotPassword';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { Heading, Text } from '@/components/Typography';
import { useAuth } from '@/hooks/auth';
import { withSSRGuest } from '@/utils/withSSRGuest';

const loginFormSchema = zod.object({
  email: zod
    .string({ required_error: 'Informe um e-mail válido' })
    .email('Informe um e-mail válido'),
  password: zod
    .string({
      required_error: 'Informe a senha com no mínimo 3 caracteres',
    })
    .min(3, 'Informe a senha com no mínimo 3 caracteres'),
});

type ILoginFormData = zod.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const { signIn } = useAuth();
  // const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ILoginFormData>({
    // resolver: zodResolver(loginFormSchema),
  });

  // FUNCTIONS
  const handleSignIn = useCallback(
    async ({ email, password }: ILoginFormData) => {
      try {
        await signIn({ email, password });
      } catch (err) {
        if (err instanceof AxiosError) {
          if (err.response) {
            toast.error('E-mail ou senha inválida! Tente novamente.', {
              position: 'bottom-center',
              autoClose: 5000,
              closeOnClick: true,
              pauseOnHover: false,
            });

            return;
          }
        }
        toast.error('E-mail ou senha inválida! Tente novamente.', {
          position: 'bottom-center',
          autoClose: 5000,
          closeOnClick: true,
          pauseOnHover: false,
        });
      }
    },
    [signIn]
  );
  // END FUNCTIONS

  return (
    <main className='min-h-screen flex p-5'>
      <Head>
        <title>Autenticação | Meu neném bem</title>
      </Head>

      <section className='w-full mx-auto flex flex-col justify-center items-center'>
        <div className='w-full flex flex-col items-center justify-center mb-8'>
          <Heading size='3xl' color='OFF_WHITE_300'>
            Meu neném bem
          </Heading>

          <Text>Seja bem-vindo(a)! Faça seu login</Text>
        </div>

        <form
          className='w-3/5 bg-DARK_BLUE_600 rounded-lg
          xs:w-11/12 h-96
          sm:w-7/12 
          md:w-7/12
          lg:w-5/12
          xl:w-4/12
          2xl:w-4/12
          3xl:w-3/12'
          onSubmit={handleSubmit(handleSignIn)}
        >
          <InputFormControl
            className='w-full bg-transparent focus:outline-none'
            control={control}
            label='E-mail'
            name='email'
            type='email'
            error={errors.email}
          />

          <InputFormControl
            control={control}
            label='Senha'
            name='password'
            secureEntry
            error={errors.password}
          />

          <ForgotPassword href='/usuarios/esqueceu-senha/'>
            Esqueceu a senha?
          </ForgotPassword>

          <Button type='submit' loading={isSubmitting}>
            Entrar
          </Button>
        </form>

        <Footer />
      </section>
    </main>
  );
}

export const getServerSideProps = withSSRGuest(async () => {
  return {
    props: {},
  };
});
