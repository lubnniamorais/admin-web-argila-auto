import { IUrgencyLevel } from '@/hooks/serviceOrders';

// Extraído de `ordens-de-servico/index.page.tsx` em 04/11/2026, ao criar
// `/orcamentos` — as duas telas (e o `ServiceOrderDetailsModal`
// compartilhado) mostram o mesmo selo de urgência por IA, então o
// rótulo/cor ficam aqui em vez de duplicados em 3 lugares. Mesmo papel de
// `ORDER_STATUS_LABEL`/`ORDER_STATUS_BADGE_CLASSNAME` em `orderStatus.ts`,
// só que não entraram nesse arquivo pra não criar import circular (esse
// arquivo importaria `IOrderStatus` de lá, e `orderStatus.ts` importaria
// `IUrgencyLevel` daqui — `IUrgencyLevel` fica melhor perto de onde já é
// definido, em `hooks/serviceOrders.ts`).
export const URGENCY_LEVEL_LABEL: Record<IUrgencyLevel, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const URGENCY_LEVEL_BADGE_CLASSNAME: Record<IUrgencyLevel, string> = {
  LOW: 'bg-good-soft text-good',
  MEDIUM: 'bg-warn-soft text-warn',
  HIGH: 'bg-warn-soft text-warn',
  CRITICAL: 'bg-crit-soft text-crit',
};
