import { zodResolver } from '@hookform/resolvers/zod';
import { format } from '@formkit/tempo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Head from 'next/head';
import { MagnifyingGlass, Plus, Sparkle, Trash } from 'phosphor-react';
import { useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z as zod } from 'zod';

import { AppShell } from '@/components/AppShell';
import { Dialog } from '@/components/Dialog';
import { AlertDialog } from '@/components/Form/AlertDialog';
import { Button, buttonClassName } from '@/components/Form/Button';
import { IComboboxOption } from '@/components/Form/Combobox';
import { ComboboxFormControl } from '@/components/Form/ComboboxFormControl';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { SelectPickerFormControl } from '@/components/Form/SelectPickerFormControl';
import { TextareaFormControl } from '@/components/Form/TextareaFormControl';
import { Pagination } from '@/components/Pagination';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ICustomer, useCustomers } from '@/hooks/customers';
import { IPart, useParts } from '@/hooks/parts';
import { IService, useServices } from '@/hooks/services';
import {
  IServiceOrder,
  IServiceOrderItem,
  IUrgencyLevel,
  useServiceOrderItemNames,
  useServiceOrders,
} from '@/hooks/serviceOrders';
import { useWorkshop } from '@/hooks/workshop';
import { api } from '@/lib/apiClient';
import {
  getValidNextStatuses,
  IOrderStatus,
  ORDER_STATUS_BADGE_CLASSNAME,
  ORDER_STATUS_LABEL,
} from '@/utils/orderStatus';
import { usePermissions } from '@/utils/permissions';
import { withSSRAuth } from '@/utils/withSSRAuth';

const SEARCH_DEBOUNCE_MS = 400;
const LIST_PER_PAGE = 10;

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

const URGENCY_LEVEL_LABEL: Record<IUrgencyLevel, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const URGENCY_LEVEL_BADGE_CLASSNAME: Record<IUrgencyLevel, string> = {
  LOW: 'bg-good-soft text-good',
  MEDIUM: 'bg-warn-soft text-warn',
  HIGH: 'bg-warn-soft text-warn',
  CRITICAL: 'bg-crit-soft text-crit',
};

// "2026-11-05T00:00:00.000Z" -> "05/11" — usado na Lista pra mostrar a
// previsão de entrega (vermelho/negrito se atrasada).
function formatDeliveryDate(dateIso: string): string {
  return format(new Date(dateIso), 'DD/MM', 'pt-BR');
}

// Mesmo racional de requiredCoercedNumber em produtos/clientes-veiculos —
// '' tem que virar "obrigatório", não "zero" (zod.coerce.number('') dá 0).
function requiredCoercedNumber(message: string) {
  return zod.preprocess(
    (value) => (value === '' ? undefined : value),
    zod.coerce
      .number({ invalid_type_error: message, required_error: message })
      .min(0, 'Não pode ser negativo')
  );
}

// ============ SCHEMA: NOVA ORDEM DE SERVIÇO ============
const createServiceOrderSchema = zod.object({
  customerId: zod.string().min(1, 'Selecione um cliente'),
  vehicleId: zod.string().min(1, 'Selecione um veículo'),
  currentMileage: requiredCoercedNumber('Quilometragem é obrigatória'),
  customerComplaint: zod.string().trim().min(1, 'Descreva a queixa do cliente'),
  estimatedDeliveryDate: zod.string().optional(),
});
type ICreateServiceOrderFormData = zod.infer<typeof createServiceOrderSchema>;

// ============ SCHEMA: EDITAR DADOS DA OS (PUT /service-orders) ============
const editServiceOrderSchema = zod.object({
  currentMileage: requiredCoercedNumber('Quilometragem é obrigatória'),
  customerComplaint: zod.string().trim().min(1, 'Descreva a queixa do cliente'),
  diagnosis: zod.string().optional(),
  estimatedDeliveryDate: zod.string().optional(),
});
type IEditServiceOrderFormData = zod.infer<typeof editServiceOrderSchema>;

// ============ SCHEMA: ADICIONAR ITEM (POST .../items) ============
const addItemSchema = zod.object({
  type: zod.enum(['PART', 'SERVICE']),
  itemId: zod.string().min(1, 'Selecione uma peça ou serviço'),
  quantity: requiredCoercedNumber('Quantidade é obrigatória').refine(
    (value) => value >= 1,
    'Quantidade mínima é 1'
  ),
});
type IAddItemFormData = zod.infer<typeof addItemSchema>;

// ============ CARTÃO DO KANBAN ============
// Redesenhado em 02/11/2026 (decisão confirmada com o usuário, depois de
// usar o quadro de verdade e achar o cartão original — cópia fiel do
// protótipo — pouco útil pra triagem: sem urgência, sem prévia da
// queixa, sem previsão de entrega visíveis). `isPro` controla a borda/
// selo de urgência (campo só existe de verdade em workshop Pro). Usada
// na Lista (única view desde 03/11/2026 — Quadro/Kanban removido, ver
// CLAUDE.md) pra calcular se a previsão de entrega está atrasada.
function isOrderOverdue(order: IServiceOrder): boolean {
  return (
    order.estimated_delivery_date !== null &&
    order.status !== 'COMPLETED' &&
    order.status !== 'CANCELED' &&
    new Date(order.estimated_delivery_date) < new Date()
  );
}

export default function OrdensDeServicoPage() {
  const queryClient = useQueryClient();
  const { data: workshop } = useWorkshop();
  const isPro = workshop?.subscription.plan === 'PRO';
  const {
    canCreateServiceOrder,
    canCancelServiceOrder,
    canSubmitUrgencyFeedback,
  } = usePermissions();

  const [cancelConfirmOrder, setCancelConfirmOrder] =
    useState<IServiceOrder | null>(null);

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

  // FUNCTIONS (modal: nova OS)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customerSearchInput, setCustomerSearchInput] = useState('');
  const [customerSearchParam, setCustomerSearchParam] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<ICustomer | null>(
    null
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCustomerSearchParam(customerSearchInput);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [customerSearchInput]);

  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers({
    page: 1,
    perPage: 8,
    searchParam: customerSearchParam,
  });

  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
    setValue: setCreateValue,
  } = useForm<ICreateServiceOrderFormData>({
    resolver: zodResolver(createServiceOrderSchema),
    defaultValues: {
      customerId: '',
      vehicleId: '',
      currentMileage: '' as unknown as number,
      customerComplaint: '',
      estimatedDeliveryDate: '',
    },
  });

  const { mutateAsync: createOrderMutate, isPending: isCreatingOrder } =
    useMutation({
      mutationFn: async (formData: ICreateServiceOrderFormData) => {
        const response = await api.post('/service-orders', {
          customerId: formData.customerId,
          vehicleId: formData.vehicleId,
          currentMileage: formData.currentMileage,
          customerComplaint: formData.customerComplaint,
          estimatedDeliveryDate: formData.estimatedDeliveryDate
            ? new Date(formData.estimatedDeliveryDate).toISOString()
            : null,
        });

        return response.data.service_order as IServiceOrder;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['service-orders'] });
        toast.success('Ordem de serviço criada.');
        setIsCreateModalOpen(false);
      },
      onError: () => {
        toast.error('Não foi possível criar a ordem de serviço.');
      },
    });

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    resetCreateForm({
      customerId: '',
      vehicleId: '',
      currentMileage: '' as unknown as number,
      customerComplaint: '',
      estimatedDeliveryDate: '',
    });
    setSelectedCustomer(null);
    setCustomerSearchInput('');
    setCustomerSearchParam('');
  }

  const handleCreateServiceOrder: SubmitHandler<
    ICreateServiceOrderFormData
  > = async (formData) => {
    try {
      await createOrderMutate(formData);
      closeCreateModal();
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };

  const customerOptions: IComboboxOption[] = (
    customersData?.customers ?? []
  ).map((customer: ICustomer) => ({
    value: customer.id,
    label: customer.name,
    description: customer.document ?? undefined,
  }));

  const vehicleOptions = (selectedCustomer?.vehicles ?? []).map((vehicle) => ({
    label: `${vehicle.plate ?? 'sem placa'} — ${vehicle.brand} ${vehicle.model}${
      vehicle.year ? ` ${vehicle.year}` : ''
    }`,
    value: vehicle.id,
  }));
  // END FUNCTIONS (modal: nova OS)

  // FUNCTIONS (lista de OS)
  // Única view desde 03/11/2026 — Quadro/Kanban removido (decisão
  // confirmada com o usuário: a Lista já cobria tudo que o board fazia,
  // com usabilidade melhor pra quem não pensa em "fluxo de colunas" no
  // dia a dia). Mesmo padrão de busca+paginação já usado em
  // Clientes/Produtos.
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
    searchParam: listSearchParam,
    page: listPage,
    perPage: LIST_PER_PAGE,
  });

  function handleListStatusChange(order: IServiceOrder, status: IOrderStatus) {
    if (status === 'CANCELED') {
      // Ação destrutiva — confirma antes, mesmo padrão já usado pra
      // excluir cliente (ver CLAUDE.md, decisão de 02/11/2026).
      setCancelConfirmOrder(order);
      return;
    }

    changeStatusMutate({ id: order.id, status });
  }
  // END FUNCTIONS (lista de OS)

  // FUNCTIONS (modal: detalhes da OS)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Lê sempre a versão mais atual dentro de `listData` em vez de guardar
  // o objeto inteiro no clique — mesmo bug/correção já documentado no
  // movimento de estoque de Produtos (31/10/2026): sem isso, editar a OS
  // ou adicionar um item não atualizaria o que o modal já aberto mostra.
  // A Lista não filtra por status (só busca), então um item continua
  // aparecendo nela mesmo depois de mudar de status.
  const selectedOrder = selectedOrderId
    ? (listData?.serviceOrders.find((order) => order.id === selectedOrderId) ??
      null)
    : null;

  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
  } = useForm<IEditServiceOrderFormData>({
    resolver: zodResolver(editServiceOrderSchema),
  });

  useEffect(() => {
    if (!selectedOrder) {
      return;
    }

    resetEditForm({
      currentMileage: selectedOrder.current_mileage,
      customerComplaint: selectedOrder.customer_complaint,
      diagnosis: selectedOrder.diagnosis ?? '',
      estimatedDeliveryDate: selectedOrder.estimated_delivery_date
        ? selectedOrder.estimated_delivery_date.slice(0, 10)
        : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder?.id]);

  const { mutateAsync: updateOrderMutate, isPending: isUpdatingOrder } =
    useMutation({
      mutationFn: async (formData: IEditServiceOrderFormData) => {
        if (!selectedOrder) {
          throw new Error('Nenhuma OS selecionada.');
        }

        const response = await api.put('/service-orders', {
          id: selectedOrder.id,
          currentMileage: formData.currentMileage,
          customerComplaint: formData.customerComplaint,
          diagnosis: formData.diagnosis || null,
          estimatedDeliveryDate: formData.estimatedDeliveryDate
            ? new Date(formData.estimatedDeliveryDate).toISOString()
            : null,
        });

        return response.data.service_order as IServiceOrder;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['service-orders'] });
        toast.success('Ordem de serviço atualizada.');
      },
      onError: () => {
        toast.error('Não foi possível salvar as alterações.');
      },
    });

  const handleUpdateOrder: SubmitHandler<IEditServiceOrderFormData> = async (
    formData
  ) => {
    try {
      await updateOrderMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };

  // Itens — busca/seleção de peça ou serviço do catálogo
  const [itemSearchInput, setItemSearchInput] = useState('');
  const [itemSearchParam, setItemSearchParam] = useState('');
  const [selectedItemLabel, setSelectedItemLabel] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setItemSearchParam(itemSearchInput);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [itemSearchInput]);

  const { data: itemPartsData, isLoading: isLoadingItemParts } = useParts({
    page: 1,
    perPage: 8,
    searchParam: itemSearchParam,
  });
  const { data: itemServicesData, isLoading: isLoadingItemServices } =
    useServices({ page: 1, perPage: 8, searchParam: itemSearchParam });

  const {
    control: addItemControl,
    handleSubmit: handleAddItemSubmit,
    watch: watchAddItem,
    setValue: setAddItemValue,
    reset: resetAddItemForm,
  } = useForm<IAddItemFormData>({
    resolver: zodResolver(addItemSchema),
    defaultValues: { type: 'PART', itemId: '', quantity: 1 },
  });

  const addItemType = watchAddItem('type');

  const itemOptions: IComboboxOption[] =
    addItemType === 'PART'
      ? (itemPartsData?.parts ?? []).map((part: IPart) => ({
          value: part.id,
          label: part.name,
          description: `${part.sku} · ${formatCurrencyBRL(part.sale_price)}`,
        }))
      : (itemServicesData?.services ?? []).map((service: IService) => ({
          value: service.id,
          label: service.name,
          description: formatCurrencyBRL(service.default_price),
        }));

  const { mutateAsync: addItemMutate, isPending: isAddingItem } = useMutation({
    mutationFn: async (formData: IAddItemFormData) => {
      if (!selectedOrder) {
        throw new Error('Nenhuma OS selecionada.');
      }

      const response = await api.post(
        `/service-orders/${selectedOrder.id}/items`,
        {
          type: formData.type,
          partId: formData.type === 'PART' ? formData.itemId : undefined,
          serviceId: formData.type === 'SERVICE' ? formData.itemId : undefined,
          quantity: formData.quantity,
        }
      );

      return response.data.service_order as IServiceOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Item adicionado.');
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        toast.error('Estoque insuficiente pra essa peça.');
        return;
      }

      toast.error('Não foi possível adicionar o item.');
    },
  });

  const handleAddItem: SubmitHandler<IAddItemFormData> = async (formData) => {
    try {
      await addItemMutate(formData);
      resetAddItemForm({ type: formData.type, itemId: '', quantity: 1 });
      setSelectedItemLabel('');
      setItemSearchInput('');
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };

  const [itemToRemove, setItemToRemove] = useState<IServiceOrderItem | null>(
    null
  );
  const itemNames = useServiceOrderItemNames(selectedOrder?.items ?? []);

  const { mutate: removeItemMutate, isPending: isRemovingItem } = useMutation({
    mutationFn: async (item: IServiceOrderItem) => {
      if (!selectedOrder) {
        throw new Error('Nenhuma OS selecionada.');
      }

      const response = await api.delete(
        `/service-orders/${selectedOrder.id}/items/${item.id}`
      );

      return response.data.service_order as IServiceOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Item removido.');
      setItemToRemove(null);
    },
    onError: () => {
      toast.error('Não foi possível remover o item.');
    },
  });

  // Urgência por IA — feedback do mecânico
  const {
    mutate: submitUrgencyFeedbackMutate,
    isPending: isSubmittingFeedback,
  } = useMutation({
    mutationFn: async (level: IUrgencyLevel) => {
      if (!selectedOrder) {
        throw new Error('Nenhuma OS selecionada.');
      }

      const response = await api.patch(
        `/service-orders/${selectedOrder.id}/urgency-feedback`,
        { level }
      );

      return response.data.service_order as IServiceOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Feedback registrado.');
    },
    onError: () => {
      toast.error('Não foi possível registrar o feedback.');
    },
  });
  // END FUNCTIONS (modal: detalhes da OS)

  return (
    <AppShell
      title='Ordens de Serviço'
      subtitle='Todas as OS, do orçamento à entrega'
    >
      <Head>
        <title>Ordens de Serviço | ArgilaAuto</title>
      </Head>

      <div className='mt-5 rounded-[10px] border border-border bg-surface p-5'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
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

          {canCreateServiceOrder && (
            <button
              type='button'
              onClick={() => setIsCreateModalOpen(true)}
              className={buttonClassName('primary', 'w-auto px-5')}
            >
              <span className='inline-flex items-center gap-2'>
                <Plus size={18} />
                Nova Ordem de Serviço
              </span>
            </button>
          )}
        </div>

        {!listData || listData.serviceOrders.length === 0 ? (
          <p className='mt-5 py-6 text-center text-text-muted'>
            {isLoadingList
              ? 'Carregando...'
              : listSearchParam
                ? 'Nenhuma OS encontrada pra essa busca.'
                : 'Nenhuma OS ainda.'}
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
                Clientes/Produtos. ===== */}
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
                        o modal de detalhes, mesmo padrão do antigo
                        KanbanCard (botão real, não `div` com `role`). */}
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

      {/* ============ MODAL: NOVA ORDEM DE SERVIÇO ============ */}
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) =>
          open ? setIsCreateModalOpen(true) : closeCreateModal()
        }
        title='Nova Ordem de Serviço'
        description='Abre uma OS em orçamento pra um cliente e veículo já cadastrados — itens podem ser adicionados depois, no diagnóstico.'
      >
        <form
          onSubmit={handleCreateSubmit(handleCreateServiceOrder)}
          noValidate
        >
          <ComboboxFormControl
            control={createControl}
            name='customerId'
            label='Cliente'
            placeholder='Buscar cliente...'
            searchPlaceholder='Nome ou documento...'
            emptyLabel='Nenhum cliente encontrado.'
            options={customerOptions}
            searchValue={customerSearchInput}
            onSearchChange={setCustomerSearchInput}
            isLoading={isLoadingCustomers}
            selectedLabel={selectedCustomer?.name}
            onSelect={(option) => {
              const customer = customersData?.customers.find(
                (item) => item.id === option.value
              );
              setSelectedCustomer(customer ?? null);
              setCreateValue('vehicleId', '');
            }}
          />

          <SelectPickerFormControl
            control={createControl}
            name='vehicleId'
            label='Veículo'
            placeholder={
              selectedCustomer
                ? 'Selecione o veículo'
                : 'Escolha um cliente primeiro'
            }
            data={vehicleOptions}
            disabled={!selectedCustomer}
          />

          <InputFormControl
            control={createControl}
            name='currentMileage'
            label='Quilometragem atual'
            type='number'
            placeholder='0'
          />

          <TextareaFormControl
            control={createControl}
            name='customerComplaint'
            label='Queixa do cliente'
            placeholder='O que o cliente relatou...'
          />

          <InputFormControl
            control={createControl}
            name='estimatedDeliveryDate'
            label='Previsão de entrega (opcional)'
            type='date'
          />

          <div className='mt-5'>
            <Button type='submit' disabled={isCreatingOrder}>
              {isCreatingOrder ? 'Criando...' : 'Criar OS'}
            </Button>
          </div>
        </form>
      </Dialog>
      {/* ============ FIM MODAL: NOVA ORDEM DE SERVIÇO ============ */}

      {/* ============ MODAL: DETALHES DA OS ============ */}
      <Dialog
        open={selectedOrder !== null}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
        title={selectedOrder?.order_code ?? ''}
        description={
          selectedOrder
            ? `${selectedOrder.vehicle.brand} ${selectedOrder.vehicle.model} · ${selectedOrder.customer.name}`
            : ''
        }
        size='lg'
      >
        {selectedOrder && (
          <div className='flex flex-col gap-5'>
            <div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ${ORDER_STATUS_BADGE_CLASSNAME[selectedOrder.status]}`}
              >
                {ORDER_STATUS_LABEL[selectedOrder.status]}
              </span>
              <p className='mt-1.5 text-[12px] text-text-muted'>
                O status muda pelo seletor "Mudar status" na lista, não por
                aqui.
              </p>
            </div>

            <div className='grid grid-cols-2 gap-3 rounded-[9px] border border-border bg-surface-2 p-3 text-[13px]'>
              <div>
                <div className='text-[11px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                  Veículo
                </div>
                <div className='font-mono'>
                  {selectedOrder.vehicle.plate ?? '—'}
                </div>
              </div>
              <div>
                <div className='text-[11px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                  Quilometragem (na abertura)
                </div>
                <div>
                  {selectedOrder.current_mileage.toLocaleString('pt-BR')} km
                </div>
              </div>
            </div>

            {isPro && (
              <div className='rounded-[9px] border border-border bg-surface p-3'>
                <div className='flex items-center gap-2'>
                  <Sparkle size={15} weight='fill' className='text-clay' />
                  <span className='text-[13px] font-bold'>Urgência por IA</span>
                  <span className='rounded-full bg-clay-soft px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-clay-deep'>
                    Pro
                  </span>
                </div>

                {selectedOrder.ai_urgency_suggestion ? (
                  <>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-bold ${URGENCY_LEVEL_BADGE_CLASSNAME[selectedOrder.ai_urgency_suggestion]}`}
                    >
                      {URGENCY_LEVEL_LABEL[selectedOrder.ai_urgency_suggestion]}
                    </span>
                    {selectedOrder.ai_urgency_reason && (
                      <p className='mt-1.5 text-[12.5px] text-text-muted'>
                        {selectedOrder.ai_urgency_reason}
                      </p>
                    )}

                    {canSubmitUrgencyFeedback && (
                      <div className='mt-3'>
                        <p className='mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                          {selectedOrder.mechanic_urgency_feedback
                            ? 'Sua avaliação'
                            : 'Você concorda com essa urgência?'}
                        </p>
                        <div className='flex flex-wrap gap-1.5'>
                          {(
                            [
                              'LOW',
                              'MEDIUM',
                              'HIGH',
                              'CRITICAL',
                            ] as IUrgencyLevel[]
                          ).map((level) => (
                            <button
                              key={level}
                              type='button'
                              disabled={isSubmittingFeedback}
                              onClick={() => submitUrgencyFeedbackMutate(level)}
                              className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                selectedOrder.mechanic_urgency_feedback ===
                                level
                                  ? URGENCY_LEVEL_BADGE_CLASSNAME[level]
                                  : 'bg-surface-2 text-text-muted hover:bg-border'
                              }`}
                            >
                              {URGENCY_LEVEL_LABEL[level]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className='mt-2 text-[12.5px] text-text-muted'>
                    Ainda sem sugestão da IA pra essa OS.
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleEditSubmit(handleUpdateOrder)} noValidate>
              <InputFormControl
                control={editControl}
                name='currentMileage'
                label='Quilometragem atual'
                type='number'
              />
              <TextareaFormControl
                control={editControl}
                name='customerComplaint'
                label='Queixa do cliente'
              />
              <TextareaFormControl
                control={editControl}
                name='diagnosis'
                label='Diagnóstico (opcional)'
              />
              <InputFormControl
                control={editControl}
                name='estimatedDeliveryDate'
                label='Previsão de entrega (opcional)'
                type='date'
              />

              <div className='mt-4'>
                <Button type='submit' disabled={isUpdatingOrder}>
                  {isUpdatingOrder ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </div>
            </form>

            <div>
              <h3 className='text-[13px] font-bold'>Itens</h3>

              {selectedOrder.items.length === 0 ? (
                <p className='mt-1.5 text-[12.5px] text-text-muted'>
                  Nenhum item adicionado ainda.
                </p>
              ) : (
                <div className='mt-2 flex flex-col gap-1.5'>
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className='flex items-center justify-between gap-2 rounded-[8px] border border-border px-2.5 py-2 text-[12.5px]'
                    >
                      <div className='min-w-0'>
                        <p className='truncate font-semibold'>
                          {itemNames[item.part_id ?? item.service_id ?? ''] ??
                            'Carregando...'}
                        </p>
                        <p className='text-text-muted'>
                          {item.quantity}x {formatCurrencyBRL(item.unit_price)}
                        </p>
                      </div>
                      <div className='flex shrink-0 items-center gap-2'>
                        <span className='font-mono font-semibold'>
                          {formatCurrencyBRL(item.subtotal)}
                        </span>
                        <button
                          type='button'
                          onClick={() => setItemToRemove(item)}
                          aria-label='Remover item'
                          className='text-text-muted transition-colors hover:text-crit'
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className='mt-1 flex items-center justify-between border-t border-border pt-2 text-[13px] font-bold'>
                    <span>Total</span>
                    <span className='font-mono'>
                      {formatCurrencyBRL(selectedOrder.total_amount)}
                    </span>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleAddItemSubmit(handleAddItem)}
                noValidate
                className='mt-3 rounded-[9px] border border-border bg-surface-2 p-3'
              >
                <Controller
                  control={addItemControl}
                  name='type'
                  render={({ field }) => (
                    <SegmentedControl
                      options={[
                        { value: 'PART', label: 'Peça' },
                        { value: 'SERVICE', label: 'Serviço' },
                      ]}
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        setAddItemValue('itemId', '');
                        setSelectedItemLabel('');
                        setItemSearchInput('');
                      }}
                    />
                  )}
                />

                <ComboboxFormControl
                  control={addItemControl}
                  name='itemId'
                  label={addItemType === 'PART' ? 'Peça' : 'Serviço'}
                  placeholder={
                    addItemType === 'PART'
                      ? 'Buscar peça...'
                      : 'Buscar serviço...'
                  }
                  searchPlaceholder='Nome...'
                  emptyLabel='Nenhum resultado.'
                  options={itemOptions}
                  searchValue={itemSearchInput}
                  onSearchChange={setItemSearchInput}
                  isLoading={
                    addItemType === 'PART'
                      ? isLoadingItemParts
                      : isLoadingItemServices
                  }
                  selectedLabel={selectedItemLabel}
                  onSelect={(option) => setSelectedItemLabel(option.label)}
                />

                <InputFormControl
                  control={addItemControl}
                  name='quantity'
                  label='Quantidade'
                  type='number'
                  min={1}
                />

                <div className='mt-4'>
                  <Button type='submit' variant='ghost' disabled={isAddingItem}>
                    {isAddingItem ? 'Adicionando...' : 'Adicionar item'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Dialog>
      {/* ============ FIM MODAL: DETALHES DA OS ============ */}

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

      <AlertDialog
        open={itemToRemove !== null}
        onOpenChange={(open) => !open && setItemToRemove(null)}
        title='Remover item?'
        description={`"${
          itemToRemove
            ? (itemNames[
                itemToRemove.part_id ?? itemToRemove.service_id ?? ''
              ] ?? 'Este item')
            : ''
        }" será removido da OS${
          itemToRemove?.stock_deducted
            ? ' — o estoque já baixado volta automaticamente'
            : ''
        }.`}
        confirmLabel='Remover'
        confirmLoadingLabel='Removendo...'
        tone='destructive'
        isLoading={isRemovingItem}
        onConfirm={() => {
          if (itemToRemove) {
            removeItemMutate(itemToRemove);
          }
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
