import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/apiClient';

// Espelha o schema User do openapi.yaml (api-argila-auto) — mesmo schema
// que GET /users/me devolve (ver IUser em hooks/auth.tsx), só que aqui é
// usado pra listar a EQUIPE inteira da workshop, não o usuário logado.
export interface ITeamUser {
  id: string;
  workshop_id: string | null;
  name: string;
  email: string;
  avatar_url: string | null;
  active: boolean;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'RECEPTIONIST' | 'MECHANIC';
  created_at: string;
  updated_at: string;
}

export interface IUseUsersParams {
  page: number;
  perPage: number;
  // Texto livre — API busca por nome/e-mail (ver GET /users, parâmetro
  // searchParam).
  searchParam?: string;
  // A tela /equipe é ADMIN only (ver usePermissions, canManageTeam) —
  // mesmo padrão de usePreventiveMaintenanceInsight/
  // useServiceOrdersSummary (hooks/dashboard.ts): nunca dispara a chamada
  // pra quem não deveria estar vendo esta tela, mesmo que GET /users em
  // si não tenha restrição de papel na API (só create/update/delete são
  // ADMIN only). Default true pra não quebrar quem não passa a flag.
  enabled?: boolean;
}

export interface IUseUsersResult {
  users: ITeamUser[];
  // Header x-total-count-registers — total de usuários da workshop que
  // batem o filtro atual, usado pela Pagination.
  totalCount: number;
}

// Lista de usuários da equipe — mesmo racional de useCustomers (busca e
// paginação controladas pela própria página via `params`, que entra na
// queryKey). GET /users já filtra ?active=true por padrão (igual
// /customers e /parts), então a lista nunca mostra usuário removido.
export function useUsers({
  page,
  perPage,
  searchParam,
  enabled = true,
}: IUseUsersParams) {
  return useQuery({
    queryKey: ['users', { page, perPage, searchParam }],
    queryFn: async (): Promise<IUseUsersResult> => {
      const response = await api.get('/users', {
        params: {
          page,
          perPage,
          searchParam: searchParam || undefined,
        },
      });

      return {
        users: response.data.users,
        totalCount: Number(response.headers['x-total-count-registers'] ?? 0),
      };
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}
