import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/apiClient';
import { IMaintenanceCategory } from '@/utils/maintenanceCategory';

// Espelha o schema Service do openapi.yaml — diferente de Part, GET
// /services NÃO filtra por `active` (devolve ativos e inativos sempre,
// decisão da própria API, ver CLAUDE.md dela) — por isso a tela precisa
// mostrar um badge de status nesta aba, o que não é necessário em Peças
// (a lista ali já só traz active:true por padrão).
export interface IService {
  id: string;
  workshop_id: string;
  name: string;
  description: string | null;
  default_price: number;
  active: boolean;
  maintenance_category: IMaintenanceCategory;
  created_at: string;
}

export interface IUseServicesParams {
  page: number;
  perPage: number;
  // Texto livre — API busca por nome/etc (ver GET /services, parâmetro
  // `searchParam`).
  searchParam?: string;
}

export interface IUseServicesResult {
  services: IService[];
  // Header x-total-count-registers — total de serviços da workshop que
  // batem o filtro atual (ativos e inativos), usado pela Pagination.
  totalCount: number;
}

// Lista de serviços do catálogo pra aba "Serviços" de Produtos — mesmo
// racional de useParts/useCustomers.
export function useServices({
  page,
  perPage,
  searchParam,
}: IUseServicesParams) {
  return useQuery({
    queryKey: ['services', { page, perPage, searchParam }],
    queryFn: async (): Promise<IUseServicesResult> => {
      const response = await api.get('/services', {
        params: {
          page,
          perPage,
          searchParam: searchParam || undefined,
        },
      });

      return {
        services: response.data.services,
        totalCount: Number(response.headers['x-total-count-registers'] ?? 0),
      };
    },
    placeholderData: keepPreviousData,
  });
}
