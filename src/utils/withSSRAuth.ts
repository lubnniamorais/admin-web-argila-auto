import {
  GetServerSideProps,
  GetServerSidePropsContext,
  GetServerSidePropsResult,
} from 'next';
import { destroyCookie, parseCookies } from 'nookies';

import { AuthTokenError } from '@/lib/errors/AuthTokenError';

type IWithSSRAuthOptions = {
  permissions?: string[];
  roles?: string[];
};

function withSSRAuth<P extends { [key: string]: any }>(
  fn: GetServerSideProps<P>,
  options?: IWithSSRAuthOptions,
) {
  return async (
    context: GetServerSidePropsContext,
  ): Promise<GetServerSidePropsResult<P>> => {
    const cookies = parseCookies(context);

    const token = cookies['autismo:token'];

    if (!token) {
      return {
        redirect: {
          destination: '/',
          permanent: false,
        },
      };
    }

    // if (options) {
    //   const user = decode<{ permissions: string[]; role: string }>(token);

    //   const { permissions, roles } = options;

    //   const userHaveValidPermissions = validateUserPermissions({
    //     user,
    //     permissions,
    //     roles,
    //   });

    //   if (!userHaveValidPermissions) {
    //     return {
    //       redirect: {
    //         destination: '/dashboard',
    //         permanent: false,
    //       },
    //     };
    //   }
    // }

    try {
      return await fn(context);
    } catch (err) {
      if (err instanceof AuthTokenError) {
        destroyCookie(context, 'autismo:token', { path: '/' });
        destroyCookie(context, 'autismo:refresh_token', { path: '/' });

        return {
          redirect: {
            destination: '/',
            permanent: false,
          },
        };
      }

      return {
        redirect: {
          destination: '/error',
          permanent: false,
        },
      };
    }
  };
}

export { withSSRAuth };
