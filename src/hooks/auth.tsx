import Router from 'next/router';
import { destroyCookie, parseCookies, setCookie } from 'nookies';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { api } from '@/lib/apiClient';

interface IUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  enabled: boolean;
}

interface IAuthState {
  user: IUser;
}

interface IAuthCredentials {
  email: string;
  password: string;
}

interface IAuthContextData {
  loadingAuthenticated: boolean;
  user: IUser;
  signIn: ({ email, password }: IAuthCredentials) => Promise<void>;
  signOut: () => void;
  updateUser: (user: IUser) => void;
  updateToken: () => Promise<void>;
}

interface IAuthProviderProps {
  children: ReactNode;
}

export function signOut(): void {
  destroyCookie(undefined, 'autismo:token', {
    path: '/',
  });
  destroyCookie(undefined, 'autismo:refresh_token', {
    path: '/',
  });

  Router.push('/');
}

export const AuthContext = createContext({} as IAuthContextData);

const AuthProvider = ({ children }: IAuthProviderProps) => {
  const [data, setData] = useState<IAuthState>({} as IAuthState);
  const [isLoadingAuthenticated, setIsLoadingAuthenticated] = useState(false);

  // FUNCTIONS
  const signIn = useCallback(async ({ email, password }: IAuthCredentials) => {
    const response = await api.post('/sessions', {
      email,
      password,
    });

    const { token, refresh_token } = response.data;

    /** NOTE
     *
     * maxAge: quanto tempo queremos armazenar o cookie, manter salvo no navegador.
     * path: diz quais caminhos da aplicação vai ter acesso ao cookie. Quando colocamos a
     * barra "/" falamos que qualquer endereço da aplicação vai ter acesso ao cookie.
     * Fazemos isso quando é um cookie que vai ser usado de forma global.
     *
     */
    setCookie(undefined, 'autismo:token', token, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    setCookie(undefined, 'autismo:refresh_token', refresh_token, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    api.defaults.headers.Authorization = `Bearer ${token}`;

    Router.push('/dashboard');
  }, []);

  const updateUser = useCallback((user: IUser) => {
    setData({
      user,
    });
  }, []);

  const updateToken = useCallback(async () => {
    const { 'autismo:refresh_token': refreshToken } = parseCookies();

    if (refreshToken) {
      const response = await api.post('/sessions/refresh', {
        refresh_token: refreshToken,
      });

      const { token, refresh_token } = response.data;

      /** NOTE
       *
       * maxAge: quanto tempo queremos armazenar o cookie, manter salvo no navegador.
       * path: diz quais caminhos da aplicação vai ter acesso ao cookie. Quando colocamos a
       * barra "/" falamos que qualquer endereço da aplicação vai ter acesso ao cookie.
       * Fazemos isso quando é um cookie que vai ser usado de forma global.
       *
       */
      setCookie(undefined, 'autismo:token', token, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });

      setCookie(undefined, 'autismo:refresh_token', refresh_token, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });

      api.defaults.headers.Authorization = `Bearer ${token}`;
    }
  }, []);
  // END FUNCTIONS

  useEffect(() => {
    const { 'autismo:token': token } = parseCookies();

    if (token) {
      setIsLoadingAuthenticated(true);

      api
        .get('/users/me')
        .then((response) => {
          const userData = response.data.user;

          setData({
            user: userData,
          });

          // console.log('No auth dentro do effect: ', userData);

          setIsLoadingAuthenticated(false);
        })
        .catch(() => {
          signOut();
        });
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loadingAuthenticated: isLoadingAuthenticated,
        user: data.user,
        signIn,
        signOut,
        updateUser,
        updateToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

function useAuth(): IAuthContextData {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export { AuthProvider, useAuth };
