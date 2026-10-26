import Head from 'next/head';
import Link from 'next/link';

import { AuthShell } from '@/components/AuthShell';
import { buttonClassName } from '@/components/Form/Button';
import { Logo } from '@/components/Logo';
import { withSSRGuest } from '@/utils/withSSRGuest';

export default function WelcomePage() {
  return (
    <AuthShell>
      <Head>
        <title>ArgilaAuto</title>
      </Head>

      <div className='mb-6 flex justify-center'>
        <Logo size={34} />
      </div>

      <h1 className='font-display text-center text-2xl font-bold'>
        Gestão de oficina, moldada pra você
      </h1>

      <p className='mt-1.5 text-center text-[13px] leading-relaxed text-text-muted'>
        Orçamento, estoque e ordem de serviço num só lugar — com a confiança da
        Argila Tecnologia por trás.
      </p>

      <Link href='/login' className={buttonClassName('primary', 'mt-6')}>
        Entrar
      </Link>

      <Link href='/signup' className={buttonClassName('ghost', 'mt-2.5')}>
        Criar conta grátis
      </Link>
    </AuthShell>
  );
}

export const getServerSideProps = withSSRGuest(async () => {
  return {
    props: {},
  };
});
