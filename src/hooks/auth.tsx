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

// Espelha o schema `User` do openapi.yaml da API (GET /users/me).
// Importante: os campos vêm em snake_case de verdade na resposta HTTP
// (ex.: "workshop_id", "avatar_url"), não é um typo — por isso o tipo
// também fica em snake_case aqui, pra não precisar converter nada na mão.
interface IUser {
  id: string;
  workshop_id: string | null; // só null pra SUPER_ADMIN, que não pertence a nenhuma workshop
  name: string;
  email: string;
  avatar_url: string | null;
  active: boolean;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'RECEPTIONIST' | 'MECHANIC';
  created_at: string;
  updated_at: string;
}

interface IAuthState {
  user: IUser;
}

interface IAuthCredentials {
  email: string;
  password: string;
}

// Espelha o corpo aceito por POST /workshops/signup (ver openapi.yaml,
// api-argila-auto) — todo campo de endereço é opcional, mesmo padrão de
// cnpj/phone/email.
interface ISignUpCredentials {
  workshop: {
    name: string;
    cnpj?: string | null;
    phone?: string | null;
    email?: string | null;
    addressStreet?: string | null;
    addressNumber?: string | null;
    addressComplement?: string | null;
    addressNeighborhood?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressZipCode?: string | null;
  };
  user: {
    name: string;
    email: string;
    password: string;
  };
}

interface IAuthContextData {
  loadingAuthenticated: boolean;
  user: IUser;
  signIn: ({ email, password }: IAuthCredentials) => Promise<void>;
  signUp: (credentials: ISignUpCredentials) => Promise<void>;
  signOut: () => void;
  updateUser: (user: IUser) => void;
  updateToken: () => Promise<void>;
}

interface IAuthProviderProps {
  children: ReactNode;
}

export function signOut(): void {
  destroyCookie(undefined, 'argilaauto:token', {
    path: '/',
  });
  destroyCookie(undefined, 'argilaauto:refresh_token', {
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
    setCookie(undefined, 'argilaauto:token', token, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    setCookie(undefined, 'argilaauto:refresh_token', refresh_token, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    api.defaults.headers.Authorization = `Bearer ${token}`;

    Router.push('/dashboard');
  }, []);

  // signUp é o cadastro público (POST /workshops/signup) — igual ao
  // login, a API já devolve token/refresh_token na hora (sem precisar
  // logar de novo depois de criar a conta), então salvamos os cookies
  // do mesmo jeito que o signIn faz.
  //
  // Diferença de propósito em relação ao signIn: NÃO redireciona pra
  // lugar nenhum sozinho. Depois de criada a conta, o destino depende do
  // plano escolhido pela pessoa (Básico vai direto pro /dashboard; Pro
  // precisa primeiro chamar POST /workshops/upgrade-to-pro — autenticado,
  // por isso o token já precisa estar salvo e no header aqui — e só
  // depois navegar pro link de pagamento da AbacatePay). Essa decisão é
  // da página de signup (src/pages/signup/index.page.tsx), não do
  // AuthContext.
  const signUp = useCallback(async ({ workshop, user }: ISignUpCredentials) => {
    const response = await api.post('/workshops/signup', {
      workshop,
      user,
    });

    const { token, refresh_token } = response.data;

    setCookie(undefined, 'argilaauto:token', token, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    setCookie(undefined, 'argilaauto:refresh_token', refresh_token, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    api.defaults.headers.Authorization = `Bearer ${token}`;
  }, []);

  const updateUser = useCallback((user: IUser) => {
    setData({
      user,
    });
  }, []);

  const updateToken = useCallback(async () => {
    const { 'argilaauto:refresh_token': refreshToken } = parseCookies();

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
      setCookie(undefined, 'argilaauto:token', token, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });

      setCookie(undefined, 'argilaauto:refresh_token', refresh_token, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });

      api.defaults.headers.Authorization = `Bearer ${token}`;
    }
  }, []);
  // END FUNCTIONS

  useEffect(() => {
    const { 'argilaauto:token': token } = parseCookies();

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
        signUp,
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
