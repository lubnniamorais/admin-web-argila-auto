import { format } from '@formkit/tempo';

// `OrderStatus` da API (ver openapi.yaml, schema ServiceOrder) — sequência
// estrita pedível PENDING_QUOTE -> AWAITING_APPROVAL -> APPROVED ->
// IN_PROGRESS -> READY_FOR_PICKUP -> COMPLETED, mais REJECTED (só sai de
// AWAITING_APPROVAL, pode voltar pra lá), CANCELED (final, de qualquer
// status não-final) e AWAITING_PART (desde 28/11/2026, NUNCA pedido
// manualmente — só a API decide aterrissar a OS lá sozinha, por falta de
// estoque; ver getValidNextStatuses) — ver CLAUDE.md, seção "Status da OS".
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

// Espelha `missing_parts` na resposta 200 de PATCH /service-orders/:id/
// status (openapi.yaml, api-argila-auto) — só presente quando a
// transição pedida (IN_PROGRESS ou READY_FOR_PICKUP) esbarrou em falta de
// estoque de alguma peça e a OS aterrissou em AWAITING_PART sozinha (ver
// CLAUDE.md da API, "Aguardando peça automático", 28/11/2026).
export interface IMissingPart {
  part_id: string;
  part_name: string;
  part_sku: string;
  missing_quantity: number;
}

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
// próximo, nunca pula nem retrocede. AWAITING_PART saiu dessa lista em
// 28/11/2026 (decisão confirmada com o usuário, "Aguardando peça
// automático") — não é mais um destino que a equipe escolhe manualmente:
// a própria API decide aterrissar a OS lá sozinha quando falta estoque de
// alguma peça ao tentar IN_PROGRESS ou READY_FOR_PICKUP. Por isso
// IN_PROGRESS avança direto pra READY_FOR_PICKUP aqui (pulando
// AWAITING_PART de propósito) — ver o caso especial de AWAITING_PART como
// ORIGEM logo abaixo, em getValidNextStatuses.
const SEQUENTIAL_STATUSES: IOrderStatus[] = [
  'PENDING_QUOTE',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'READY_FOR_PICKUP',
  'COMPLETED',
];

// Replica a validação que a API faz de verdade (nunca é a fonte de
// verdade — só evita a pessoa escolher, no `<select>` "Mudar status" da
// Lista, uma opção que a API ia rejeitar com 400) — usada em Ordens de
// Serviço pra popular as opções desse seletor. Nasceu pensada pro Kanban
// (removido em 03/11/2026, ver CLAUDE.md), mas a lógica continua a mesma,
// só mudou pra onde ela é consultada. `canCancel` reflete
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
  } else if (current === 'AWAITING_PART') {
    // Nunca é pedido manualmente (ver comentário em SEQUENTIAL_STATUSES)
    // — mas a OS pode estar aqui (a API colocou sozinha), e o jeito de
    // tentar sair é pedir o próximo passo normal da sequência
    // (READY_FOR_PICKUP). Se a peça ainda estiver faltando, a API
    // simplesmente mantém a OS em AWAITING_PART de novo.
    next.push('READY_FOR_PICKUP');
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

// `estimated_delivery_date` é sempre meia-noite UTC do dia escolhido (ver
// `new Date(inputValue).toISOString()` em `ordens-de-servico/index.page.tsx`
// e `ServiceOrderDetailsModal`, no submit do form) — é um DIA, não um
// instante de verdade. Reconstruir isso com `new Date(iso)` e formatar/
// comparar no fuso LOCAL do navegador (ex.: `format(new Date(iso), ...)`,
// como este arquivo fazia antes) desloca a data em 1 dia pra trás em
// qualquer fuso atrás de UTC (ex.: Brasil, UTC-3: meia-noite UTC de
// "28/11" vira 21h do dia 27, local) — bug real reportado pelo usuário em
// 28/11/2026 ("a data sempre fica um dia a menos"). Correção: nunca
// reconstruir com `new Date()`; ler o "YYYY-MM-DD" direto da string ISO
// (sempre os 10 primeiros caracteres), sem nenhuma conversão de fuso.
function deliveryDateOnly(dateIso: string): string {
  return dateIso.slice(0, 10);
}

// Extraídas de `ordens-de-servico/index.page.tsx` em 04/11/2026, ao criar
// `/orcamentos` — as duas telas mostram a previsão de entrega (vermelho/
// negrito se atrasada) do mesmo jeito, então a lógica fica aqui em vez de
// duplicada. O parâmetro aceita qualquer objeto com esses 2 campos (em
// vez de importar `IServiceOrder` de `hooks/serviceOrders.ts`) de
// propósito — esse hook já importa `IOrderStatus` DESTE arquivo, então
// importar `IServiceOrder` daqui pra lá criaria um import circular.
// Comparação por DIA (não por instante, ver `deliveryDateOnly` acima) —
// "hoje" também é lido no fuso local (`format(new Date(), 'YYYY-MM-DD')`,
// mesma lib já usada no resto do arquivo) pra comparar dia-com-dia:
// atrasada só a partir do dia SEGUINTE à previsão, nunca no próprio dia.
export function isOrderOverdue(order: {
  estimated_delivery_date: string | null;
  status: IOrderStatus;
}): boolean {
  if (
    order.estimated_delivery_date === null ||
    order.status === 'COMPLETED' ||
    order.status === 'CANCELED'
  ) {
    return false;
  }

  const todayLocal = format(new Date(), 'YYYY-MM-DD');

  return deliveryDateOnly(order.estimated_delivery_date) < todayLocal;
}

// "2026-11-05T00:00:00.000Z" -> "05/11" — sem passar por `new Date()`
// (ver `deliveryDateOnly` acima), pra nunca sofrer o deslocamento de fuso.
export function formatDeliveryDate(dateIso: string): string {
  const [, month, day] = deliveryDateOnly(dateIso).split('-');
  return `${day}/${month}`;
}
