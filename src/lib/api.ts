import axios, { AxiosError } from 'axios';
import { GetServerSidePropsContext } from 'next';
import { parseCookies, setCookie } from 'nookies';

import { signOut } from '@/hooks/auth';

import { AuthTokenError } from './errors/AuthTokenError';

type IPromiseType = {
  onSuccess: (token: string) => void;
  onFailed: (err: AxiosError) => void;
};

let isRefreshing = false; // identifica se o token está sendo atualizado ou não
let failedRequestQueue: IPromiseType[] = [] as IPromiseType[]; // são todas as requisições que falharam por causa do token expirado

// USER IN GET SERVER SIDE RENDERING OU GET STATIC SERVER
export function setupAPIClient(context?: GetServerSidePropsContext) {
  let cookies = parseCookies(context);

  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: {
      Authorization: `Bearer ${cookies['argilaauto:token']}`,
    },
  });

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    (error: AxiosError) => {
      if (error.response) {
        if (error.response.status === 401) {
          cookies = parseCookies(context);

          const refreshToken = cookies['argilaauto:refresh_token'];

          console.log('Erro axios primeiro if', error.response.data);

          /** NOTE
           * O config é basicamente toda configuração da requisição
           * que foi feita para o back-end
           * Dentro dele vai ter todas as informações que é necessária
           * para repetir uma requisição para o back-end
           */
          const originalConfig = error.config;

          console.log('refreshtoken', refreshToken);

          if (!refreshToken) {
            console.log('SEM REFRESH TOKEN => ', 'AQUI');
            signOut();

            return Promise.reject(new AuthTokenError());
          }

          if (!isRefreshing) {
            isRefreshing = true;

            api
              .post('/sessions/refresh', {
                refresh_token: refreshToken,
              })
              .then((response) => {
                const { token, refresh_token } = response.data;

                console.log('Dentro da api', response.data);

                setCookie(context, 'argilaauto:token', token, {
                  maxAge: 60 * 60 * 24 * 30, // 30 dias
                  path: '/',
                });

                // NOTE - maxAge: quanto tempo queremos armazenar, manter salvo no navegador
                setCookie(context, 'argilaauto:refresh_token', refresh_token, {
                  maxAge: 60 * 60 * 24 * 30, // 30 dias
                  path: '/',
                });

                api.defaults.headers.Authorization = `Bearer ${token}`;

                failedRequestQueue.forEach((request) =>
                  request.onSuccess(token)
                );
                failedRequestQueue = [];
              })
              .catch((err) => {
                failedRequestQueue.forEach((request) => request.onFailed(err));
                failedRequestQueue = [];

                if (typeof window !== 'undefined') {
                  signOut();
                }

                signOut();
              });
          }

          return new Promise((resolve, reject) => {
            /** NOTE
             * Vai ter duas propriedades
             *
             * - onSuccess: que vai acontece quando o token tiver finalizado de ser
             * atualizado, o processo de refresh tiver finalizado
             *
             * - onFailed: o que acontece no caso o processo de refresh token tenha dado errado
             */
            failedRequestQueue.push({
              onSuccess: (token: string) => {
                if (originalConfig) {
                  originalConfig.headers.Authorization = `Bearer ${token}`;

                  resolve(api(originalConfig));
                }
              },
              onFailed: (err: AxiosError) => {
                reject(err);
              },
            });
          });
        } else {
          if (typeof window !== 'undefined') {
            // signOut();
            console.log('Error status no interceptor', error.response.status);
          } else {
            return Promise.reject(new AuthTokenError());
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return api;
}
