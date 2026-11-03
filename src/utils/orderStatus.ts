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

// Sequência estrita da máquina de estados (PATCH /service-orders/:id/
// status, ver api-argila-auto/CLAUDE.md) — cada status só avança pro
// próximo, nunca pula nem retrocede.
const SEQUENTIAL_STATUSES: IOrderStatus[] = [
  'PENDING_QUOTE',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'AWAITING_PART',
  'READY_FOR_PICKUP',
  'COMPLETED',
];

// Replica a validação que a API faz de verdade (nunca é a fonte de
// verdade — só evita a pessoa arrastar um cartão pra uma coluna que vai
// voltar com 400) — usado pelo Kanban de Ordens de Serviço pra desabilitar
// colunas inválidas durante o arrasto (decisão confirmada com o usuário
// em 02/11/2026, ver CLAUDE.md). `canCancel` reflete
// usePermissions().canCancelServiceOrder — MECHANIC nunca pode cancelar,
// mesmo de um status que aceitaria CANCELED pra outro papel.
export function getValidNextStatuses(
  current: IOrderStatus,
  canCancel: boolean
): IOrderStatus[] {
  const next: IOrderStatus[] = [];

  if (current === 'REJECTED') {
    // Único jeito de REJECTED não ser terminal: volta pra
    // AWAITING_APPROVAL (reabre o orçamento) — ou cancela de vez.
    next.push('AWAITING_APPROVAL');
  } else {
    const sequenceIndex = SEQUENTIAL_STATUSES.indexOf(current);

    if (
      sequenceIndex !== -1 &&
      sequenceIndex < SEQUENTIAL_STATUSES.length - 1
    ) {
      next.push(SEQUENTIAL_STATUSES[sequenceIndex + 1]);
    }

    // REJECTED só é alcançável a partir de AWAITING_APPROVAL (rejeição
    // registrada pela equipe, por telefone).
    if (current === 'AWAITING_APPROVAL') {
      next.push('REJECTED');
    }
  }

  // CANCELED é alcançável de qualquer status não-final — COMPLETED e
  // CANCELED em si nunca aparecem aqui (nenhuma transição sai deles).
  const isFinal = current === 'COMPLETED' || current === 'CANCELED';

  if (!isFinal && canCancel) {
    next.push('CANCELED');
  }

  return next;
}
