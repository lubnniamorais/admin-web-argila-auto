// Mesmo enum PaymentStatus do openapi.yaml (api-argila-auto) —
// PARTIALLY_PAID existe no schema mas nenhum fluxo da API usa hoje (ver
// comentário em ServiceOrderPayment lá: pagamento parcial de verdade é
// feito com VÁRIOS registros, não um único marcado como parcial). Mapeado
// aqui mesmo assim, por completude — nunca deve aparecer na prática.
export type IPaymentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELED';

export const PAYMENT_STATUS_LABEL: Record<IPaymentStatus, string> = {
  PENDING: 'Pendente',
  PARTIALLY_PAID: 'Parcialmente pago',
  PAID: 'Pago',
  CANCELED: 'Cancelado',
};

// Mesmas cores semânticas do resto do projeto (ver orderStatus.ts):
// pendente = aguardando (warn), pago = concluído (good), cancelado =
// erro/cancelado (crit).
export const PAYMENT_STATUS_BADGE_CLASSNAME: Record<IPaymentStatus, string> = {
  PENDING: 'bg-warn-soft text-warn',
  PARTIALLY_PAID: 'bg-info-soft text-info',
  PAID: 'bg-good-soft text-good',
  CANCELED: 'bg-crit-soft text-crit',
};
