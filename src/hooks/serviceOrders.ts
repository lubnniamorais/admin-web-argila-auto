import { useQueries, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/apiClient';
import { IOrderStatus } from '@/utils/orderStatus';

// Espelha ServiceOrderItem do openapi.yaml (api-argila-auto) — NÃO traz
// nome de peça/serviço resolvido (só `part_id`/`service_id`), diferente
// de `customer`/`vehicle` na própria OS — o presenter do lado da equipe
// não enriquece isso (só o presenter do cliente final e o de
// report-data fazem). Resolver o nome pra exibir é responsabilidade de
// quem usa este tipo (ver `ordens-de-servico/index.page.tsx`).
export interface IServiceOrderItem {
  id: string;
  service_order_id: string;
  type: 'PART' | 'SERVICE';
  part_id: string | null;
  service_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  stock_deducted: boolean;
}

export interface IServiceOrderCustomerSummary {
  id: string;
  name: string;
}

export interface IServiceOrderVehicleSummary {
  id: string;
  plate: string | null;
  brand: string;
  model: string;
  year: number | null;
}

export type IUrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Espelha o schema ServiceOrder do openapi.yaml — snake_case, sem
// conversão. Alguns campos (aprovação/rejeição pelo cliente, nota
// fiscal, link público) existem no schema real mas ainda não são usados
// por nenhuma tela deste admin — fora do escopo desta 1ª entrega do
// Kanban (ver CLAUDE.md, "Ordens de Serviço").
export interface IServiceOrder {
  id: string;
  workshop_id: string;
  order_number: number;
  order_code: string;
  customer_id: string;
  vehicle_id: string;
  customer: IServiceOrderCustomerSummary;
  vehicle: IServiceOrderVehicleSummary;
  status: IOrderStatus;
  current_mileage: number;
  customer_complaint: string;
  diagnosis: string | null;
  total_amount: number;
  received_at: string;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  ai_urgency_suggestion: IUrgencyLevel | null;
  ai_urgency_reason: string | null;
  ai_urgency_generated_at: string | null;
  mechanic_urgency_feedback: IUrgencyLevel | null;
  mechanic_urgency_feedback_at: string | null;
  created_at: string;
  updated_at: string;
  items: IServiceOrderItem[];
}

export interface IUseServiceOrdersParams {
  status?: IOrderStatus;
  searchParam?: string;
  page?: number;
  perPage?: number;
}

export interface IUseServiceOrdersResult {
  serviceOrders: IServiceOrder[];
  totalCount: number;
}

// Lista de OS — usada pela Lista de Ordens de Serviço (única view desde
// 03/11/2026, Kanban removido) e, futuramente, pela tela de Orçamentos
// (mesmo endpoint, outro filtro de status).
export function useServiceOrders({
  status,
  searchParam,
  page = 1,
  perPage = 20,
}: IUseServiceOrdersParams) {
  return useQuery({
    queryKey: ['service-orders', { status, searchParam, page, perPage }],
    queryFn: async (): Promise<IUseServiceOrdersResult> => {
      const response = await api.get('/service-orders', {
        params: {
          status,
          searchParam: searchParam || undefined,
          page,
          perPage,
        },
      });

      return {
        serviceOrders: response.data.service_orders,
        totalCount: Number(response.headers['x-total-count-registers'] ?? 0),
      };
    },
  });
}

// `ServiceOrderItem` só traz `part_id`/`service_id` (ver comentário no
// tipo acima) — resolve o nome pra exibir no modal de detalhes com uma
// chamada por item (GET /parts/{id} ou /services/{id}), deduplicada por
// id e cacheada pelo TanStack Query (reabrir o mesmo modal, ou ver a
// mesma peça em itens diferentes, não refaz a chamada). Poucos itens por
// OS na prática (1 a poucas unidades), por isso N chamadas pequenas em
// vez de buscar o catálogo inteiro só pra resolver alguns nomes.
export function useServiceOrderItemNames(items: IServiceOrderItem[]) {
  const partIds = [
    ...new Set(
      items
        .filter((item) => item.type === 'PART' && item.part_id)
        .map((item) => item.part_id as string)
    ),
  ];
  const serviceIds = [
    ...new Set(
      items
        .filter((item) => item.type === 'SERVICE' && item.service_id)
        .map((item) => item.service_id as string)
    ),
  ];

  const partQueries = useQueries({
    queries: partIds.map((id) => ({
      queryKey: ['parts', id],
      queryFn: async (): Promise<{ id: string; name: string }> => {
        const response = await api.get(`/parts/${id}`);

        return { id, name: response.data.part.name };
      },
    })),
  });

  const serviceQueries = useQueries({
    queries: serviceIds.map((id) => ({
      queryKey: ['services', id],
      queryFn: async (): Promise<{ id: string; name: string }> => {
        const response = await api.get(`/services/${id}`);

        return { id, name: response.data.service.name };
      },
    })),
  });

  const names: Record<string, string> = {};

  for (const query of [...partQueries, ...serviceQueries]) {
    if (query.data) {
      names[query.data.id] = query.data.name;
    }
  }

  return names;
}
