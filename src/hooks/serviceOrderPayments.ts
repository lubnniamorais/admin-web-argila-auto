import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/apiClient';
import { IPaymentMethod } from '@/utils/paymentMethod';
import { IPaymentStatus } from '@/utils/paymentStatus';

// Espelha o schema ServiceOrderPayment do openapi.yaml — snake_case, sem
// conversão. `paid_at` só vem preenchido depois de POST .../confirm;
// `canceled_at` NÃO apaga `paid_at` quando um PAID é estornado — fica o
// histórico completo (pago em X, estornado em Y), ver "Pagamentos em
// Ordens de Serviço".
export interface IServiceOrderPayment {
  id: string;
  service_order_id: string;
  amount: number;
  payment_method: IPaymentMethod;
  status: IPaymentStatus;
  paid_at: string | null;
  canceled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
}

// Lista de pagamentos de UMA OS — sub-lista pequena (poucos registros na
// prática), por isso sem paginação, mesmo critério já documentado na API
// (GET /service-orders/:id/payments). `enabled: !!orderId` evita a
// chamada enquanto o ServiceOrderDetailsModal ainda não tem uma OS aberta
// (order === null).
export function useServiceOrderPayments(orderId: string | undefined) {
  return useQuery({
    queryKey: ['service-order-payments', orderId],
    queryFn: async (): Promise<IServiceOrderPayment[]> => {
      const response = await api.get(`/service-orders/${orderId}/payments`);

      return response.data.payments;
    },
    enabled: !!orderId,
  });
}
