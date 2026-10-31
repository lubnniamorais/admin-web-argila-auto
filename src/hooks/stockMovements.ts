import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/apiClient';

// Espelha o schema StockMovement do openapi.yaml (api-argila-auto).
// `PURCHASE_IN`/`MANUAL_ADJUSTMENT` só nascem de `POST
// /parts/{id}/stock-movements` (ação manual, ver "Estado atual" do
// CLAUDE.md `/produtos`); `SERVICE_ORDER_OUT`/`SERVICE_ORDER_RETURN` só
// nascem do sistema (baixa/devolução automática ligada a uma OS) — nunca
// aceitos nesse endpoint, mas ainda aparecem no histórico de leitura.
export type IStockMovementType =
  | 'PURCHASE_IN'
  | 'SERVICE_ORDER_OUT'
  | 'SERVICE_ORDER_RETURN'
  | 'MANUAL_ADJUSTMENT';

// Rótulo PT-BR por tipo — usado só no histórico desta tela por enquanto
// (diferente de orderStatus.ts/maintenanceCategory.ts, que já nasceram
// compartilhados entre telas; aqui ainda não há outro lugar que precise).
export const STOCK_MOVEMENT_TYPE_LABEL: Record<IStockMovementType, string> = {
  PURCHASE_IN: 'Entrada por compra',
  SERVICE_ORDER_OUT: 'Baixa automática (OS)',
  SERVICE_ORDER_RETURN: 'Devolução automática (OS)',
  MANUAL_ADJUSTMENT: 'Ajuste de inventário',
};

export interface IStockMovement {
  id: string;
  part_id: string;
  type: IStockMovementType;
  // Delta assinado já aplicado em Part.quantity (positivo soma, negativo
  // subtrai) — mesma convenção pros 4 tipos.
  quantity: number;
  reason: string | null;
  // Preenchido só em SERVICE_ORDER_OUT/SERVICE_ORDER_RETURN.
  service_order_id: string | null;
  created_at: string;
}

// Histórico de movimentações de uma peça — GET /parts/{id}/stock-movements
// não pagina (sub-lista de uma peça específica) e não filtra por role (só
// o POST exige ADMIN/RECEPTIONIST). `enabled: !!partId` evita a chamada
// enquanto o modal de movimento ainda não escolheu uma peça.
export function useStockMovements(partId: string | undefined) {
  return useQuery({
    queryKey: ['parts', partId, 'stock-movements'],
    queryFn: async (): Promise<IStockMovement[]> => {
      const response = await api.get(`/parts/${partId}/stock-movements`);

      return response.data.movements;
    },
    enabled: !!partId,
  });
}
