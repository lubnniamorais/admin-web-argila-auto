import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Sparkle, Trash } from 'phosphor-react';
import { useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z as zod } from 'zod';

import { Dialog } from '@/components/Dialog';
import { AlertDialog } from '@/components/Form/AlertDialog';
import { Button } from '@/components/Form/Button';
import { IComboboxOption } from '@/components/Form/Combobox';
import { ComboboxFormControl } from '@/components/Form/ComboboxFormControl';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { SelectPickerFormControl } from '@/components/Form/SelectPickerFormControl';
import { Textarea } from '@/components/Form/Textarea';
import { TextareaFormControl } from '@/components/Form/TextareaFormControl';
import { SegmentedControl } from '@/components/SegmentedControl';
import { IPart, useParts } from '@/hooks/parts';
import {
  IServiceOrderPayment,
  useServiceOrderPayments,
} from '@/hooks/serviceOrderPayments';
import { IService, useServices } from '@/hooks/services';
import {
  IServiceOrder,
  IServiceOrderItem,
  IUrgencyLevel,
  useServiceOrderItemNames,
} from '@/hooks/serviceOrders';
import { useWorkshop } from '@/hooks/workshop';
import { api } from '@/lib/apiClient';
import {
  ORDER_STATUS_BADGE_CLASSNAME,
  ORDER_STATUS_LABEL,
} from '@/utils/orderStatus';
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHOD_VALUES,
} from '@/utils/paymentMethod';
import {
  PAYMENT_STATUS_BADGE_CLASSNAME,
  PAYMENT_STATUS_LABEL,
} from '@/utils/paymentStatus';
import { usePermissions } from '@/utils/permissions';
import {
  URGENCY_LEVEL_BADGE_CLASSNAME,
  URGENCY_LEVEL_LABEL,
} from '@/utils/urgencyLevel';

const SEARCH_DEBOUNCE_MS = 400;

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Mesmo racional de requiredCoercedNumber em produtos/clientes-veiculos/
// ordens-de-servico (criar OS) — '' tem que virar "obrigatório", não
// "zero" (zod.coerce.number('') dá 0).
function requiredCoercedNumber(message: string) {
  return zod.preprocess(
    (value) => (value === '' ? undefined : value),
    zod.coerce
      .number({ invalid_type_error: message, required_error: message })
      .min(0, 'Não pode ser negativo')
  );
}

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

// ============ SCHEMA: REGISTRAR PAGAMENTO (POST .../payments) ============
const registerPaymentSchema = zod.object({
  amount: requiredCoercedNumber('Valor é obrigatório').refine(
    (value) => value > 0,
    'Valor precisa ser maior que zero'
  ),
  paymentMethod: zod.enum(PAYMENT_METHOD_VALUES, {
    message: 'Selecione a forma de pagamento',
  }),
});
type IRegisterPaymentFormData = zod.infer<typeof registerPaymentSchema>;
// ============ FIM SCHEMA: REGISTRAR PAGAMENTO ============

interface IServiceOrderDetailsModalProps {
  order: IServiceOrder | null;
  onClose: () => void;
}

// Extraído de `ordens-de-servico/index.page.tsx` em 04/11/2026, ao criar
// `/orcamentos` (decisão confirmada com o usuário: separar num componente
// próprio em vez de duplicar, já que as duas telas abrem o MESMO modal
// pra MESMA entidade — ServiceOrder). Quem usa só precisa passar a OS
// selecionada (de dentro da própria lista/query da tela, pelo mesmo
// motivo documentado abaixo em `order`) e uma função pra fechar — todo o
// resto (edição, itens, urgência por IA) vive aqui dentro.
//
// IMPORTANTE pra quem usa este componente: `order` deve vir sempre lido
// de dentro dos dados da lista da própria tela (ex.:
// `listData?.serviceOrders.find(...)`), nunca guardado como snapshot do
// clique — mesmo bug/correção já documentado no movimento de estoque de
// Produtos (31/10/2026): sem isso, editar a OS ou adicionar um item não
// atualizaria o que o modal já aberto mostra.
export function ServiceOrderDetailsModal({
  order,
  onClose,
}: IServiceOrderDetailsModalProps) {
  const queryClient = useQueryClient();
  const { data: workshop } = useWorkshop();
  const isPro = workshop?.subscription.plan === 'PRO';
  const { canSubmitUrgencyFeedback, canManagePayments } = usePermissions();

  // FUNCTIONS (editar dados da OS)
  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
  } = useForm<IEditServiceOrderFormData>({
    resolver: zodResolver(editServiceOrderSchema),
    // Bug real corrigido em 23/11/2026, achado testando com RECEPTIONIST/
    // MECHANIC: sem defaultValues, os campos nascem undefined (input não
    // controlado) e só recebem valor real no useEffect logo abaixo
    // (resetEditForm) — React avisa no console toda vez que o modal abre
    // ("changing an uncontrolled input to be controlled"). Mesmo padrão
    // já usado no form de criar OS (ordens-de-servico/index.page.tsx),
    // que já tinha defaultValues desde o início.
    defaultValues: {
      currentMileage: '' as unknown as number,
      customerComplaint: '',
      diagnosis: '',
      estimatedDeliveryDate: '',
    },
  });

  useEffect(() => {
    if (!order) {
      return;
    }

    resetEditForm({
      currentMileage: order.current_mileage,
      customerComplaint: order.customer_complaint,
      diagnosis: order.diagnosis ?? '',
      estimatedDeliveryDate: order.estimated_delivery_date
        ? order.estimated_delivery_date.slice(0, 10)
        : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  const { mutateAsync: updateOrderMutate, isPending: isUpdatingOrder } =
    useMutation({
      mutationFn: async (formData: IEditServiceOrderFormData) => {
        if (!order) {
          throw new Error('Nenhuma OS selecionada.');
        }

        const response = await api.put('/service-orders', {
          id: order.id,
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
  // END FUNCTIONS (editar dados da OS)

  // FUNCTIONS (itens — busca/seleção de peça ou serviço do catálogo)
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
      if (!order) {
        throw new Error('Nenhuma OS selecionada.');
      }

      const response = await api.post(`/service-orders/${order.id}/items`, {
        type: formData.type,
        partId: formData.type === 'PART' ? formData.itemId : undefined,
        serviceId: formData.type === 'SERVICE' ? formData.itemId : undefined,
        quantity: formData.quantity,
      });

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
  const itemNames = useServiceOrderItemNames(order?.items ?? []);

  const { mutate: removeItemMutate, isPending: isRemovingItem } = useMutation({
    mutationFn: async (item: IServiceOrderItem) => {
      if (!order) {
        throw new Error('Nenhuma OS selecionada.');
      }

      const response = await api.delete(
        `/service-orders/${order.id}/items/${item.id}`
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
  // END FUNCTIONS (itens)

  // FUNCTIONS (urgência por IA — feedback do mecânico)
  const {
    mutate: submitUrgencyFeedbackMutate,
    isPending: isSubmittingFeedback,
  } = useMutation({
    mutationFn: async (level: IUrgencyLevel) => {
      if (!order) {
        throw new Error('Nenhuma OS selecionada.');
      }

      const response = await api.patch(
        `/service-orders/${order.id}/urgency-feedback`,
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
  // END FUNCTIONS (urgência por IA)

  // FUNCTIONS (pagamentos)
  // Sem checagem de role pra LISTAR (GET .../payments) — os 3 papéis
  // veem o histórico, igual à API. canManagePayments só controla as
  // ações (registrar/confirmar/cancelar), ver utils/permissions.ts.
  const { data: payments } = useServiceOrderPayments(order?.id);

  // Saldo devedor calculado no front a partir do total da OS (itens) e
  // da soma dos pagamentos NÃO-cancelados — a API não devolve esse
  // cálculo pronto (ver GET .../payments no openapi.yaml, "sem cálculo
  // de saldo devedor na resposta"). Usado tanto pro resumo quanto pra
  // montar a mensagem de erro de "valor maior que o saldo devedor" sem
  // mostrar a mensagem crua da API (ver CLAUDE.md).
  const paidAmount = (payments ?? [])
    .filter((payment) => payment.status !== 'CANCELED')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const remainingBalance = order ? order.total_amount - paidAmount : 0;

  const {
    control: paymentControl,
    handleSubmit: handleRegisterPaymentSubmit,
    reset: resetPaymentForm,
  } = useForm<IRegisterPaymentFormData>({
    resolver: zodResolver(registerPaymentSchema),
    defaultValues: {
      amount: '' as unknown as number,
      // '' força escolha ativa — mesmo truque de cast já usado pro campo
      // de papel em /equipe (nenhuma forma de pagamento é "mais
      // provável" o suficiente pra vir pré-selecionada).
      paymentMethod: '' as unknown as IRegisterPaymentFormData['paymentMethod'],
    },
  });

  const {
    mutateAsync: registerPaymentMutate,
    isPending: isRegisteringPayment,
  } = useMutation({
    mutationFn: async ({ amount, paymentMethod }: IRegisterPaymentFormData) => {
      if (!order) {
        throw new Error('Nenhuma OS selecionada.');
      }

      await api.post(`/service-orders/${order.id}/payments`, {
        amount,
        paymentMethod,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['service-order-payments', order?.id],
      });
      toast.success('Pagamento registrado.');
    },
    onError: (error) => {
      // O único 400 alcançável por aqui é o de saldo devedor — o de "OS
      // cancelada" nunca acontece, porque o formulário já some nesse
      // caso (ver JSX abaixo). Mensagem própria com o valor certo em
      // vez da mensagem crua da API (ver CLAUDE.md).
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        toast.error(
          `O valor informado é maior que o saldo devedor (${formatCurrencyBRL(remainingBalance)}).`
        );
        return;
      }

      toast.error('Não foi possível registrar o pagamento.');
    },
  });

  const handleRegisterPayment: SubmitHandler<IRegisterPaymentFormData> = async (
    formData
  ) => {
    try {
      await registerPaymentMutate(formData);
      resetPaymentForm({
        amount: '' as unknown as number,
        paymentMethod:
          '' as unknown as IRegisterPaymentFormData['paymentMethod'],
      });
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };

  // Confirmar (PENDING → PAID) é ação direta, sem AlertDialog — decisão
  // confirmada com o usuário: não é destrutiva, só avança o pagamento,
  // mesmo racional de mudar o status da OS pelo seletor (sem popup).
  // `variables` guarda o pagamento em voo, pra desabilitar só o botão
  // daquela linha (não a lista inteira) enquanto a chamada está em voo.
  const {
    mutate: confirmPaymentMutate,
    isPending: isConfirmingPayment,
    variables: confirmingPayment,
  } = useMutation({
    mutationFn: async (payment: IServiceOrderPayment) => {
      if (!order) {
        throw new Error('Nenhuma OS selecionada.');
      }

      await api.post(
        `/service-orders/${order.id}/payments/${payment.id}/confirm`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['service-order-payments', order?.id],
      });
      toast.success('Pagamento confirmado.');
    },
    onError: () => {
      toast.error('Não foi possível confirmar o pagamento.');
    },
  });

  // Cancelar/estornar (→ CANCELED) PEDE confirmação — decisão confirmada
  // com o usuário, mesmo padrão de ação destrutiva (remover item, excluir
  // cliente) já usado no projeto. `cancellationReason` é um campo extra
  // opcional dentro do próprio AlertDialog (primeiro uso deste componente
  // que colhe um dado além de confirmar — ver Form/AlertDialog).
  const [paymentToCancel, setPaymentToCancel] =
    useState<IServiceOrderPayment | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const { mutate: cancelPaymentMutate, isPending: isCancelingPayment } =
    useMutation({
      mutationFn: async () => {
        if (!order || !paymentToCancel) {
          throw new Error('Nenhum pagamento selecionado.');
        }

        await api.post(
          `/service-orders/${order.id}/payments/${paymentToCancel.id}/cancel`,
          { cancellationReason: cancellationReason.trim() || undefined }
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['service-order-payments', order?.id],
        });
        toast.success(
          paymentToCancel?.status === 'PAID'
            ? 'Pagamento estornado.'
            : 'Pagamento cancelado.'
        );
        setPaymentToCancel(null);
        setCancellationReason('');
      },
      onError: () => {
        toast.error('Não foi possível cancelar o pagamento.');
      },
    });
  // END FUNCTIONS (pagamentos)

  return (
    <>
      <Dialog
        open={order !== null}
        onOpenChange={(open) => !open && onClose()}
        title={order?.order_code ?? ''}
        description={
          order
            ? `${order.vehicle.brand} ${order.vehicle.model} · ${order.customer.name}`
            : ''
        }
        size='lg'
      >
        {order && (
          <div className='flex flex-col gap-5'>
            <div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ${ORDER_STATUS_BADGE_CLASSNAME[order.status]}`}
              >
                {ORDER_STATUS_LABEL[order.status]}
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
                <div className='font-mono'>{order.vehicle.plate ?? '—'}</div>
              </div>
              <div>
                <div className='text-[11px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                  Quilometragem (na abertura)
                </div>
                <div>{order.current_mileage.toLocaleString('pt-BR')} km</div>
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

                {order.ai_urgency_suggestion ? (
                  <>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-bold ${URGENCY_LEVEL_BADGE_CLASSNAME[order.ai_urgency_suggestion]}`}
                    >
                      {URGENCY_LEVEL_LABEL[order.ai_urgency_suggestion]}
                    </span>
                    {order.ai_urgency_reason && (
                      <p className='mt-1.5 text-[12.5px] text-text-muted'>
                        {order.ai_urgency_reason}
                      </p>
                    )}

                    {canSubmitUrgencyFeedback && (
                      <div className='mt-3'>
                        <p className='mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                          {order.mechanic_urgency_feedback
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
                                order.mechanic_urgency_feedback === level
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

              {order.items.length === 0 ? (
                <p className='mt-1.5 text-[12.5px] text-text-muted'>
                  Nenhum item adicionado ainda.
                </p>
              ) : (
                <div className='mt-2 flex flex-col gap-1.5'>
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className='flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-[12.5px]'
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
                      {formatCurrencyBRL(order.total_amount)}
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

            <div>
              <h3 className='text-[13px] font-bold'>Pagamentos</h3>

              <div className='mt-2 flex items-center justify-between rounded-[9px] border border-border bg-surface-2 px-3 py-2 text-[13px]'>
                <span className='text-text-muted'>Saldo devedor</span>
                <span
                  className={`font-mono font-bold ${
                    remainingBalance > 0 ? 'text-warn' : 'text-good'
                  }`}
                >
                  {formatCurrencyBRL(remainingBalance)}
                </span>
              </div>

              {!payments || payments.length === 0 ? (
                <p className='mt-2 text-[12.5px] text-text-muted'>
                  Nenhum pagamento registrado ainda.
                </p>
              ) : (
                <div className='mt-2 flex flex-col gap-1.5'>
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className='flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-[12.5px]'
                    >
                      <div className='min-w-0'>
                        <p className='font-semibold'>
                          {formatCurrencyBRL(payment.amount)}{' '}
                          <span className='font-normal text-text-muted'>
                            · {PAYMENT_METHOD_LABEL[payment.payment_method]}
                          </span>
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${PAYMENT_STATUS_BADGE_CLASSNAME[payment.status]}`}
                        >
                          {PAYMENT_STATUS_LABEL[payment.status]}
                        </span>
                      </div>

                      {canManagePayments && payment.status !== 'CANCELED' && (
                        <div className='flex shrink-0 items-center gap-3'>
                          {payment.status === 'PENDING' && (
                            <button
                              type='button'
                              onClick={() => confirmPaymentMutate(payment)}
                              disabled={
                                isConfirmingPayment &&
                                confirmingPayment?.id === payment.id
                              }
                              className='text-[11.5px] font-bold text-good transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-60'
                            >
                              Confirmar
                            </button>
                          )}
                          <button
                            type='button'
                            onClick={() => setPaymentToCancel(payment)}
                            className='text-[11.5px] font-bold text-crit transition-colors hover:underline'
                          >
                            {payment.status === 'PAID'
                              ? 'Estornar'
                              : 'Cancelar'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canManagePayments &&
                (order.status === 'CANCELED' ? (
                  <p className='mt-3 text-[12px] text-text-muted'>
                    OS cancelada — não é possível registrar novos pagamentos.
                  </p>
                ) : (
                  <form
                    onSubmit={handleRegisterPaymentSubmit(
                      handleRegisterPayment
                    )}
                    noValidate
                    className='mt-3 rounded-[9px] border border-border bg-surface-2 p-3'
                  >
                    <InputFormControl
                      control={paymentControl}
                      name='amount'
                      label='Valor'
                      type='number'
                      placeholder='0,00'
                    />

                    <SelectPickerFormControl
                      control={paymentControl}
                      name='paymentMethod'
                      label='Forma de pagamento'
                      placeholder='Selecione'
                      data={PAYMENT_METHOD_OPTIONS}
                    />

                    <div className='mt-4'>
                      <Button
                        type='submit'
                        variant='ghost'
                        disabled={isRegisteringPayment}
                      >
                        {isRegisteringPayment
                          ? 'Registrando...'
                          : 'Registrar pagamento'}
                      </Button>
                    </div>
                  </form>
                ))}
            </div>
          </div>
        )}
      </Dialog>

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

      <AlertDialog
        open={paymentToCancel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentToCancel(null);
            setCancellationReason('');
          }
        }}
        title={
          paymentToCancel?.status === 'PAID'
            ? 'Estornar pagamento?'
            : 'Cancelar pagamento?'
        }
        description={
          paymentToCancel
            ? `${formatCurrencyBRL(paymentToCancel.amount)} via ${
                PAYMENT_METHOD_LABEL[paymentToCancel.payment_method]
              }${
                paymentToCancel.status === 'PAID'
                  ? ' — já estava confirmado como pago.'
                  : '.'
              }`
            : ''
        }
        tone='destructive'
        confirmLabel={
          paymentToCancel?.status === 'PAID' ? 'Estornar' : 'Cancelar'
        }
        confirmLoadingLabel={
          paymentToCancel?.status === 'PAID' ? 'Estornando...' : 'Cancelando...'
        }
        isLoading={isCancelingPayment}
        onConfirm={() => cancelPaymentMutate()}
      >
        <Textarea
          label='Motivo (opcional)'
          value={cancellationReason}
          onChange={(event) => setCancellationReason(event.target.value)}
          rows={2}
          placeholder='Só pra auditoria financeira'
        />
      </AlertDialog>
    </>
  );
}
