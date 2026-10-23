import {
  GetServerSideProps,
  GetServerSidePropsContext,
  GetServerSidePropsResult,
} from 'next';
import { parseCookies } from 'nookies';

// NOTE - FUNÇÃO PARA USUÁRIO NÃO AUTENTICADOS
function withSSRGuest<P extends { [key: string]: any }>(
  fn: GetServerSideProps<P>,
) {
  return async (
    context: GetServerSidePropsContext,
  ): Promise<GetServerSidePropsResult<P>> => {
    const cookies = parseCookies(context);

    const token = cookies['autismo:token'];

    if (token) {
      return {
        redirect: {
          destination: '/dashboard',
          permanent: false,
        },
      };

      /** NOTE -
       * O permanent é por causa do HTTP Code (301, 302, ...) para o browser
       * entender se é um redirecionamento que sempre vai acontecer ou se aconteceu
       * devido uma condição
       */
    }

    try {
      return await fn(context);
    } catch (err) {
      return {
        redirect: {
          destination: '/error',
          permanent: false,
        },
      };
    }
  };
}

export { withSSRGuest };
