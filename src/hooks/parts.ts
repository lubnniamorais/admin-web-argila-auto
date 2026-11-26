import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/apiClient';
import { IMaintenanceCategory } from '@/utils/maintenanceCategory';

// Espelha o schema Part do openapi.yaml (api-argila-auto) — snake_case,
// sem conversão. `active` adicionado em 30/10/2026 (ver CLAUDE.md da
// API, "Part.active — desativação de peça, sem exclusão de verdade") —
// mesmo padrão de Service.active, mas sem anonimização (peça não tem
// dado pessoal). GET /parts só traz `active:true` por padrão; `active:
// false` só aparece com o switch "Mostrar removidas" ligado (ver
// /produtos, aba Peças).
export interface IPart {
  id: string;
  workshop_id: string;
  sku: string;
  oem_code: string | null;
  name: string;
  description: string | null;
  cost_price: number;
  sale_price: number;
  quantity: number;
  minimum_stock: number;
  active: boolean;
  maintenance_category: IMaintenanceCategory;
  created_at: string;
  updated_at: string;
}

export interface IUsePartsParams {
  page: number;
  perPage: number;
  // Texto livre — API busca por nome/sku/etc (ver GET /parts, parâmetro
  // `searchParam`).
  searchParam?: string;
  // 'false' pra ver as peças desativadas — ver switch "Mostrar
  // removidas" na aba Peças de /produtos. Omitido, a API assume 'true'
  // sozinha (mesmo padrão de /customers e /users).
  active?: 'false';
}

export interface IUsePartsResult {
  parts: IPart[];
  // Header x-total-count-registers — total de peças ativas da workshop
  // que batem o filtro atual, usado pela Pagination.
  totalCount: number;
}

// Lista de peças do estoque pra aba "Peças" de Produtos — busca e
// paginação controladas pela própria página via `params`, mesmo racional
// de useCustomers (hooks/customers.ts).
export function useParts({
  page,
  perPage,
  searchParam,
  active,
}: IUsePartsParams) {
  return useQuery({
    queryKey: ['parts', { page, perPage, searchParam, active }],
    queryFn: async (): Promise<IUsePartsResult> => {
      const response = await api.get('/parts', {
        params: {
          page,
          perPage,
          searchParam: searchParam || undefined,
          active,
        },
      });

      return {
        parts: response.data.parts,
        totalCount: Number(response.headers['x-total-count-registers'] ?? 0),
      };
    },
    // Mantém a página anterior na tela enquanto a nova carrega, em vez de
    // piscar um estado vazio/loading a cada clique de paginação ou letra
    // digitada na busca.
    placeholderData: keepPreviousData,
  });
}
