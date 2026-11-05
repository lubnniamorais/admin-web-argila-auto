import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Head from 'next/head';
import { MagnifyingGlass } from 'phosphor-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

import { AppShell } from '@/components/AppShell';
import { AlertDialog } from '@/components/Form/AlertDialog';
import { Pagination } from '@/components/Pagination';
import { ServiceOrderDetailsModal } from '@/components/ServiceOrderDetailsModal';
import { IServiceOrder, useServiceOrders } from '@/hooks/serviceOrders';
import { useWorkshop } from '@/hooks/workshop';
import { api } from '@/lib/apiClient';
import {
  formatDeliveryDate,
  getValidNextStatuses,
  IOrderStatus,
  isOrderOverdue,
  ORDER_STATUS_BADGE_CLASSNAME,
  ORDER_STATUS_LABEL,
} from '@/utils/orderStatus';
import { usePermissions } from '@/utils/permissions';
import {
  URGENCY_LEVEL_BADGE_CLASSNAME,
  URGENCY_LEVEL_LABEL,
} from '@/utils/urgencyLevel';
import { withSSRAuth } from '@/utils/withSSRAuth';

const SEARCH_DEBOUNCE_MS = 400;
const LIST_PER_PAGE = 10;

// Status que ainda contam como "orçamento" — da montagem até a aprovação,
// antes do carro entrar em execução de verdade. Decisão confirmada com o
// usuário (02/11/2026, ver CLAUDE.md "Próxima coisa a fazer"): a partir
// de IN_PROGRESS já é trabalho em andamento, não é mais "orçamento" —
// fica só em Ordens de Serviço (que mostra todo mundo, sem filtro).
const QUOTE_STATUSES: IOrderStatus[] = [
  'PENDING_QUOTE',
  'AWAITING_APPROVAL',
  'REJECTED',
  'APPROVED',
];

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Página nova em 04/11/2026 — mesma entidade de `/ordens-de-servico`
// (ServiceOrder), só que filtrada pelos 4 status de orçamento acima.
// Reaproveita o MESMO modal de detalhes (`ServiceOrderDetailsModal`) e a
// MESMA lógica de "mudar status" (`<select>` + confirmação ao cancelar) —
// só a busca/filtro da lista é própria desta tela. Decisões já combinadas
// com o usuário antes de construir: sem botão de criar aqui (toda OS já
// nasce como orçamento, criada em Ordens de Serviço); filtro multi-status
// feito no servidor (API estendida em 04/11/2026 pra aceitar vários
// `status=` numa chamada só, ver CLAUDE.md da API) — não no navegador, pra
// não arriscar "perder" orçamentos à medida que a oficina crescer.
export default function OrcamentosPage() {
  const queryClient = useQueryClient();
  const { data: workshop } = useWorkshop();
  const isPro = workshop?.subscription.plan === 'PRO';
  const { canCancelServiceOrder } = usePermissions();

  const [cancelConfirmOrder, setCancelConfirmOrder] =
    useState<IServiceOrder | null>(null);

  // Mesma mutation de `/ordens-de-servico` (mesmo endpoint, mesmo
  // comportamento) — fica duplicada aqui de propósito, não extraída:
  // é só ~20 linhas, e as duas telas já compartilham o que importa de
  // verdade (o modal de detalhes, bem maior). Ver CLAUDE.md sobre o
  // equilíbrio entre duplicar pouco código vs. extrair código grande.
  const { mutate: changeStatusMutate, isPending: isChangingStatus } =
    useMutation({
      mutationFn: async ({
        id,
        status,
      }: {
        id: string;
        status: IOrderStatus;
      }) => {
        const response = await api.patch(`/service-orders/${id}/status`, {
          status,
        });

        return response.data.service_order as IServiceOrder;
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['service-orders'] });
        toast.success(
          `OS movida para "${ORDER_STATUS_LABEL[variables.status]}".`
        );
      },
      onError: (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 400) {
          toast.error(
            'Essa transição de status não é permitida (ex.: orçamento sem item ainda).'
          );
          return;
        }

        toast.error('Não foi possível mudar o status da OS.');
      },
    });

  const [listSearchInput, setListSearchInput] = useState('');
  const [listSearchParam, setListSearchParam] = useState('');
  const [listPage, setListPage] = useState(1);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setListSearchParam(listSearchInput);
      setListPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [listSearchInput]);

  const { data: listData, isLoading: isLoadingList } = useServiceOrders({
    status: QUOTE_STATUSES,
    searchParam: listSearchParam,
    page: listPage,
    perPage: LIST_PER_PAGE,
  });

  function handleListStatusChange(order: IServiceOrder, status: IOrderStatus) {
    if (status === 'CANCELED') {
      // Ação destrutiva — confirma antes, mesmo padrão já usado pra
      // excluir cliente e em Ordens de Serviço (ver CLAUDE.md).
      setCancelConfirmOrder(order);
      return;
    }

    changeStatusMutate({ id: order.id, status });
  }

  // Mesmo racional já documentado em `ServiceOrderDetailsModal`: lido
  // sempre de dentro de `listData`, nunca um snapshot do clique — e aqui
  // importa ainda mais, porque mudar o status pra algo fora de
  // QUOTE_STATUSES (ex.: aprovar e já mandar pra IN_PROGRESS não existe
  // aqui, mas CANCELED sim) faz a OS sumir da lista no próximo refetch —
  // o modal fecha sozinho quando isso acontece, porque `selectedOrder`
  // vira `null`.
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const selectedOrder = selectedOrderId
    ? (listData?.serviceOrders.find((order) => order.id === selectedOrderId) ??
      null)
    : null;

  return (
    <AppShell
      title='Orçamentos'
      subtitle='OS em fase de orçamento — da montagem até a aprovação do cliente'
    >
      <Head>
        <title>Orçamentos | ArgilaAuto</title>
      </Head>

      <div className='mt-5 rounded-[10px] border border-border bg-surface p-5'>
        <div className='relative w-full sm:max-w-xs'>
          <MagnifyingGlass
            size={16}
            className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted'
          />
          <input
            type='text'
            value={listSearchInput}
            onChange={(event) => setListSearchInput(event.target.value)}
            placeholder='Buscar por OS, placa, cliente, queixa...'
            className='w-full rounded-[9px] border border-border-strong bg-background py-2.5 pr-3.5 pl-9 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1'
          />
        </div>

        {!listData || listData.serviceOrders.length === 0 ? (
          <p className='mt-5 py-6 text-center text-text-muted'>
            {isLoadingList
              ? 'Carregando...'
              : listSearchParam
                ? 'Nenhum orçamento encontrado pra essa busca.'
                : 'Nenhum orçamento em aberto no momento.'}
          </p>
        ) : (
          <>
            {/* ===== TABELA (telas largas) — mesmo breakpoint (880px) da
                sidebar, ver CLAUDE.md pegadinha #1 sobre classe
                condicional literal. ===== */}
            <div className='mt-5 max-[880px]:hidden overflow-x-auto'>
              <table className='w-full border-collapse text-[13.5px]'>
                <thead>
                  <tr className='border-b border-border text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                    <th className='pb-2 pr-3'>OS</th>
                    <th className='pb-2 pr-3'>Veículo</th>
                    <th className='pb-2 pr-3'>Cliente</th>
                    <th className='pb-2 pr-3'>Status</th>
                    <th className='pb-2 pr-3'>Urgência</th>
                    <th className='pb-2 pr-3'>Valor</th>
                    <th className='pb-2'>Mudar status</th>
                  </tr>
                </thead>
                <tbody>
                  {listData.serviceOrders.map((order) => {
                    const nextStatuses = getValidNextStatuses(
                      order.status,
                      canCancelServiceOrder
                    );
                    const urgency = isPro ? order.ai_urgency_suggestion : null;
                    const isOverdue = isOrderOverdue(order);

                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className='cursor-pointer border-b border-border align-top last:border-0 hover:bg-surface-2'
                      >
                        <td className='py-2.5 pr-3 font-mono text-text-muted'>
                          {order.order_code}
                        </td>
                        <td className='py-2.5 pr-3'>
                          <span className='font-semibold'>
                            {order.vehicle.brand} {order.vehicle.model}
                          </span>
                          {order.vehicle.plate && (
                            <span className='ml-1 font-mono text-text-muted'>
                              · {order.vehicle.plate}
                            </span>
                          )}
                        </td>
                        <td className='py-2.5 pr-3'>
                          <div>{order.customer.name}</div>
                          {order.customer_complaint && (
                            <div className='mt-0.5 max-w-[220px] truncate text-[12px] text-text-muted'>
                              {order.customer_complaint}
                            </div>
                          )}
                        </td>
                        <td className='py-2.5 pr-3'>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-bold ${ORDER_STATUS_BADGE_CLASSNAME[order.status]}`}
                          >
                            {ORDER_STATUS_LABEL[order.status]}
                          </span>
                        </td>
                        <td className='py-2.5 pr-3'>
                          {urgency ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${URGENCY_LEVEL_BADGE_CLASSNAME[urgency]}`}
                            >
                              {URGENCY_LEVEL_LABEL[urgency]}
                            </span>
                          ) : (
                            <span className='text-text-muted'>—</span>
                          )}
                        </td>
                        <td className='py-2.5 pr-3 font-mono'>
                          <div>
                            {order.total_amount > 0
                              ? formatCurrencyBRL(order.total_amount)
                              : '—'}
                          </div>
                          {order.estimated_delivery_date && (
                            <div
                              className={`mt-0.5 font-sans text-[11px] ${isOverdue ? 'font-bold text-crit' : 'text-text-muted'}`}
                            >
                              {isOverdue ? 'Atrasada ' : 'Previsão '}
                              {formatDeliveryDate(
                                order.estimated_delivery_date
                              )}
                            </div>
                          )}
                        </td>
                        <td className='py-2.5'>
                          <select
                            value=''
                            disabled={
                              nextStatuses.length === 0 || isChangingStatus
                            }
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              handleListStatusChange(
                                order,
                                event.target.value as IOrderStatus
                              )
                            }
                            className='rounded-[7px] border border-border-strong bg-background px-2 py-1.5 text-[12px] text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50'
                          >
                            <option value='' disabled>
                              {nextStatuses.length === 0
                                ? 'Status final'
                                : 'Mudar pra...'}
                            </option>
                            {nextStatuses.map((status) => (
                              <option key={status} value={status}>
                                {ORDER_STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ===== CARDS (telas estreitas) — evita o scroll horizontal
                da tabela abaixo de 880px, mesmo padrão já usado em
                Clientes/Produtos/Ordens de Serviço. ===== */}
            <div className='mt-5 hidden max-[880px]:flex flex-col gap-3'>
              {listData.serviceOrders.map((order) => {
                const nextStatuses = getValidNextStatuses(
                  order.status,
                  canCancelServiceOrder
                );
                const urgency = isPro ? order.ai_urgency_suggestion : null;
                const isOverdue = isOrderOverdue(order);

                return (
                  <div
                    key={order.id}
                    className='rounded-[10px] border border-border p-4'
                  >
                    {/* `<select>` abaixo não pode ficar dentro de
                        `<button>` (HTML inválido) — só a parte de cima
                        (sem elementos interativos) é clicável pra abrir
                        o modal de detalhes, mesmo padrão já usado em
                        Ordens de Serviço. */}
                    <button
                      type='button'
                      onClick={() => setSelectedOrderId(order.id)}
                      className='block w-full text-left outline-none focus-visible:outline-2 focus-visible:outline-clay'
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <span className='font-mono text-[11px] text-text-muted'>
                          {order.order_code}
                        </span>
                        <span
                          className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${ORDER_STATUS_BADGE_CLASSNAME[order.status]}`}
                        >
                          {ORDER_STATUS_LABEL[order.status]}
                        </span>
                      </div>

                      <p className='mt-1 font-semibold'>
                        {order.vehicle.brand} {order.vehicle.model}
                        {order.vehicle.plate && (
                          <span className='font-mono font-normal text-text-muted'>
                            {' '}
                            · {order.vehicle.plate}
                          </span>
                        )}
                      </p>
                      <p className='text-text-muted'>{order.customer.name}</p>
                      {order.customer_complaint && (
                        <p className='mt-1 truncate text-[12.5px] text-text-muted'>
                          {order.customer_complaint}
                        </p>
                      )}
                    </button>

                    <div className='mt-3 flex items-center justify-between gap-2 border-t border-border pt-3'>
                      <div className='flex flex-col gap-1'>
                        <div className='flex items-center gap-2'>
                          {urgency && (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${URGENCY_LEVEL_BADGE_CLASSNAME[urgency]}`}
                            >
                              {URGENCY_LEVEL_LABEL[urgency]}
                            </span>
                          )}
                          <span className='font-mono font-semibold'>
                            {order.total_amount > 0
                              ? formatCurrencyBRL(order.total_amount)
                              : '—'}
                          </span>
                        </div>
                        {order.estimated_delivery_date && (
                          <span
                            className={`text-[11px] ${isOverdue ? 'font-bold text-crit' : 'text-text-muted'}`}
                          >
                            {isOverdue ? 'Atrasada ' : 'Previsão '}
                            {formatDeliveryDate(order.estimated_delivery_date)}
                          </span>
                        )}
                      </div>

                      <select
                        value=''
                        disabled={nextStatuses.length === 0 || isChangingStatus}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          handleListStatusChange(
                            order,
                            event.target.value as IOrderStatus
                          )
                        }
                        className='rounded-[7px] border border-border-strong bg-background px-2 py-1.5 text-[12px] text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <option value='' disabled>
                          {nextStatuses.length === 0
                            ? 'Status final'
                            : 'Mudar pra...'}
                        </option>
                        {nextStatuses.map((status) => (
                          <option key={status} value={status}>
                            {ORDER_STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className='mt-4'>
              <Pagination
                pageCurrent={listPage}
                totalCount={listData.totalCount}
                perPage={LIST_PER_PAGE}
                onPageChange={setListPage}
              />
            </div>
          </>
        )}
      </div>

      <ServiceOrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrderId(null)}
      />

      <AlertDialog
        open={cancelConfirmOrder !== null}
        onOpenChange={(open) => !open && setCancelConfirmOrder(null)}
        title='Cancelar ordem de serviço?'
        description={`A OS ${cancelConfirmOrder?.order_code ?? ''} será cancelada — peças já baixadas do estoque voltam automaticamente. Essa ação não pode ser desfeita.`}
        confirmLabel='Cancelar OS'
        confirmLoadingLabel='Cancelando...'
        cancelLabel='Voltar'
        tone='destructive'
        isLoading={isChangingStatus}
        onConfirm={() => {
          if (!cancelConfirmOrder) {
            return;
          }

          changeStatusMutate(
            { id: cancelConfirmOrder.id, status: 'CANCELED' },
            { onSuccess: () => setCancelConfirmOrder(null) }
          );
        }}
      />
    </AppShell>
  );
}

export const getServerSideProps = withSSRAuth(async () => {
  return {
    props: {},
  };
});
