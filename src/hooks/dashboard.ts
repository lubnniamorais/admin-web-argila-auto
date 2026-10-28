import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/apiClient';
import { IOrderStatus } from '@/utils/orderStatus';

// Espelha GET /service-orders/summary (ADMIN/RECEPTIONIST only — ver
// openapi.yaml, api-argila-auto). Corpo da resposta é o próprio objeto,
// sem chave de envelope.
export interface IServiceOrdersSummary {
  open_orders_count: number;
  current_month_average_ticket: number;
}

export function useServiceOrdersSummary() {
  return useQuery({
    queryKey: ['service-orders', 'summary'],
    queryFn: async (): Promise<IServiceOrdersSummary> => {
      const response = await api.get('/service-orders/summary');

      return response.data;
    },
  });
}

// Espelha GET /parts/low-stock (quantity <= minimum_stock, sem paginação).
export interface ILowStockPart {
  id: string;
  name: string;
  quantity: number;
  minimum_stock: number;
}

export function useLowStockParts() {
  return useQuery({
    queryKey: ['parts', 'low-stock'],
    queryFn: async (): Promise<ILowStockPart[]> => {
      const response = await api.get('/parts/low-stock');

      return response.data.parts;
    },
  });
}

// Espelha GET /service-order-payments/monthly-report?months= — sempre um
// item por mês (zero-fill), do mais antigo pro mais recente.
export interface IMonthlyPaymentsReportItem {
  month: string;
  total_received: number;
}

export function useMonthlyPaymentsReport(months = 6) {
  return useQuery({
    queryKey: ['service-order-payments', 'monthly-report', months],
    queryFn: async (): Promise<IMonthlyPaymentsReportItem[]> => {
      const response = await api.get('/service-order-payments/monthly-report', {
        params: { months },
      });

      return response.data.months;
    },
  });
}

// Espelha GET /service-orders?page=&perPage= — ordenado por received_at
// desc por padrão (sem precisar de sortBy), já com customer/vehicle
// resolvidos (ver schema ServiceOrder).
export interface IRecentServiceOrder {
  id: string;
  order_code: string;
  status: IOrderStatus;
  total_amount: number;
  customer: { id: string; name: string };
  vehicle: { id: string; plate: string; brand: string; model: string };
}

export interface IRecentServiceOrdersResult {
  serviceOrders: IRecentServiceOrder[];
  // Header x-total-count-registers — total de OS da workshop (sem filtro
  // de status), usado no KPI "OS em aberto" pra mostrar "de X no total".
  totalCount: number;
}

export function useRecentServiceOrders(perPage = 5) {
  return useQuery({
    queryKey: ['service-orders', 'recent', perPage],
    queryFn: async (): Promise<IRecentServiceOrdersResult> => {
      const response = await api.get('/service-orders', {
        params: { page: 1, perPage },
      });

      return {
        serviceOrders: response.data.service_orders,
        totalCount: Number(response.headers['x-total-count-registers'] ?? 0),
      };
    },
  });
}

// Espelha GET /vehicles/preventive-maintenance-insight — exclusivo do
// plano Pro (403 no Básico). `enabled` controla a chamada pra nunca
// disparar pra uma workshop Básica (ver uso em dashboard/index.page.tsx).
export interface IPreventiveMaintenanceInsightItem {
  vehicle: {
    id: string;
    brand: string;
    model: string;
    year: number | null;
  };
  categories: Array<{
    category: string;
    km_remaining: number | null;
    status: 'DUE_SOON' | 'OVERDUE';
  }>;
}

export function usePreventiveMaintenanceInsight(enabled: boolean) {
  return useQuery({
    queryKey: ['vehicles', 'preventive-maintenance-insight'],
    queryFn: async (): Promise<IPreventiveMaintenanceInsightItem[]> => {
      const response = await api.get(
        '/vehicles/preventive-maintenance-insight'
      );

      return response.data.vehicles;
    },
    enabled,
  });
}
