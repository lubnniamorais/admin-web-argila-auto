// `OrderStatus` da API (ver openapi.yaml, schema ServiceOrder) — sequência
// estrita PENDING_QUOTE -> AWAITING_APPROVAL -> APPROVED -> IN_PROGRESS ->
// AWAITING_PART -> READY_FOR_PICKUP -> COMPLETED, mais REJECTED (só sai de
// AWAITING_APPROVAL, pode voltar pra lá) e CANCELED (final, de qualquer
// status não-final) — ver CLAUDE.md, seção "Status da OS".
export type IOrderStatus =
  | 'PENDING_QUOTE'
  | 'AWAITING_APPROVAL'
  | 'REJECTED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'AWAITING_PART'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELED';

// Cor de cada status, usando as 4 semânticas definidas no CLAUDE.md:
// good (concluído/pronto), warn (aguardando algo), info (aprovado/em
// execução), crit (cancelado/recusado). PENDING_QUOTE ainda não tem
// urgência nenhuma associada, por isso fica neutro (mesma paleta do
// texto/superfície secundária, não uma das 4 semânticas).
export const ORDER_STATUS_LABEL: Record<IOrderStatus, string> = {
  PENDING_QUOTE: 'Orçamento pendente',
  AWAITING_APPROVAL: 'Aguardando aprovação',
  REJECTED: 'Recusado',
  APPROVED: 'Aprovado',
  IN_PROGRESS: 'Em execução',
  AWAITING_PART: 'Aguardando peça',
  READY_FOR_PICKUP: 'Pronto para retirada',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
};

export const ORDER_STATUS_BADGE_CLASSNAME: Record<IOrderStatus, string> = {
  PENDING_QUOTE: 'bg-surface-2 text-text-muted',
  AWAITING_APPROVAL: 'bg-warn-soft text-warn',
  REJECTED: 'bg-crit-soft text-crit',
  APPROVED: 'bg-info-soft text-info',
  IN_PROGRESS: 'bg-info-soft text-info',
  AWAITING_PART: 'bg-warn-soft text-warn',
  READY_FOR_PICKUP: 'bg-good-soft text-good',
  COMPLETED: 'bg-good-soft text-good',
  CANCELED: 'bg-crit-soft text-crit',
};
