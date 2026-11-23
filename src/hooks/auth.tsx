import axios from 'axios';
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
export interface IUser {
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

  // Busca os dados do usuário autenticado (`GET /users/me`) e popula o
  // contexto — extraída pra uma função própria (antes só existia inline
  // dentro do efeito de carregamento inicial, mais abaixo) porque esse
  // efeito roda só UMA vez, na primeira montagem do `AuthProvider`.
  //
  // Bug real corrigido em 01/11/2026: `signIn`/`signUp` levam pro
  // Dashboard com `router.push`/`Router.push` (troca de tela só no
  // React, sem recarregar a página) — o efeito de montagem já tinha
  // rodado antes disso, nesse momento ainda sem token nenhum (a pessoa
  // estava na tela de Welcome/Login/Signup), e nunca rodava de novo
  // depois do login/cadastro. Resultado: `user` ficava `undefined` pra
  // sempre naquela sessão do navegador (sidebar sem nome nem iniciais no
  // rodapé), só aparecendo se a pessoa desse F5 na página manualmente.
  // Chamada agora tanto no efeito de montagem (sessão retomada de um
  // cookie já existente) quanto logo depois de `signIn`/`signUp`
  // confirmarem o token (sessão nova).
  // Bug real corrigido em 22/11/2026: GET /users/me é uma rota comum
  // (não está na lista de isentas de verifyWorkshopSubscriptionAccess,
  // ver api-argila-auto/CLAUDE.md) — quando a workshop está com a
  // assinatura vencida, essa chamada sempre dava 402, e o erro subia
  // sem tratamento nenhum até estourar dentro de signIn, deixando a
  // pessoa travada pra sempre na tela de login (toast "assinatura
  // pendente", sem nenhum jeito de chegar numa tela que resolvesse
  // isso). As rotas de autogestão da própria assinatura (GET
  // /workshops/me, POST /upgrade-to-pro, etc.) são isentas de
  // propósito, exatamente pra oficina conseguir se desbloquear sozinha
  // — só que a UI nunca dava a chance de usá-las. Corrigido tratando o
  // 402 aqui dentro: não relança o erro (token continua salvo, `user`
  // fica undefined), só avisa quem chamou que a assinatura está
  // bloqueada (retorno `true`) pra decidir pra onde navegar (ver
  // signIn) — qualquer outro erro (rede, 500) continua relançado
  // normalmente.
  const fetchAuthenticatedUser = useCallback(async (): Promise<boolean> => {
    try {
      const response = await api.get('/users/me');

      setData({ user: response.data.user });

      return false;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 402) {
        return true;
      }

      throw error;
    }
  }, []);

  const signIn = useCallback(
    async ({ email, password }: IAuthCredentials) => {
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

      const isSubscriptionBlocked = await fetchAuthenticatedUser();

      Router.push(
        isSubscriptionBlocked ? '/assinatura-pendente' : '/dashboard'
      );
    },
    [fetchAuthenticatedUser]
  );

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
  const signUp = useCallback(
    async ({ workshop, user }: ISignUpCredentials) => {
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

      await fetchAuthenticatedUser();
    },
    [fetchAuthenticatedUser]
  );

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

      fetchAuthenticatedUser()
        .then(() => {
          setIsLoadingAuthenticated(false);
        })
        .catch(() => {
          signOut();
        });
    }
  }, [fetchAuthenticatedUser]);

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
