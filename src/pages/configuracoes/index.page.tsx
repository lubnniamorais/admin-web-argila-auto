import { zodResolver } from '@hookform/resolvers/zod';
import { format } from '@formkit/tempo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import pdfMake from 'pdfmake/build/pdfmake';
import { FileText, FloppyDisk, MagnifyingGlass, Sparkle } from 'phosphor-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z as zod } from 'zod';

import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Form/Button';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { InputMaskFormControl } from '@/components/Form/InputMaskFormControl';
import { useWorkshop } from '@/hooks/workshop';
import { api } from '@/lib/apiClient';
import { docDefinitions } from '@/report/docDefinitions';
import { headerReport } from '@/report/header';
import { stylesTable } from '@/report/stylesTable';
import {
  cleanTableData,
  columnsTitleTable,
  rowsTable,
  tableContent,
} from '@/report/table';
import { withSSRAuth } from '@/utils/withSSRAuth';

// Mesma fonte usada pelo admin-web-amip pro pdfmake (CDN oficial do
// projeto, versão compatível com pdfmake 0.1.x/0.2.x) — sem isso, o
// pdfmake não sabe de onde carregar Roboto e o PDF sai sem texto nenhum.
const pdfMakeFonts = {
  Roboto: {
    normal:
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf',
    bold: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf',
    italics:
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Italic.ttf',
    bolditalics:
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-MediumItalic.ttf',
  },
};

// ============ VIACEP (mesmo padrão do Signup) ============
interface IAddressViaCep {
  logradouro: string;
  bairro: string;
  uf: string;
  localidade: string;
  erro?: boolean;
}

// ============ SCHEMA: DADOS DA OFICINA ============
const optionalEmail = zod
  .union([zod.literal(''), zod.string().trim().email('E-mail inválido')])
  .optional();

const optionalUf = zod
  .union([
    zod.literal(''),
    zod.string().trim().length(2, 'UF deve ter 2 letras'),
  ])
  .optional();

const workshopFormSchema = zod.object({
  name: zod.string().trim().min(1, 'Informe o nome da oficina'),
  phone: zod.string().trim().optional(),
  email: optionalEmail,
  addressStreet: zod.string().trim().optional(),
  addressNumber: zod.string().trim().optional(),
  addressComplement: zod.string().trim().optional(),
  addressNeighborhood: zod.string().trim().optional(),
  addressCity: zod.string().trim().optional(),
  addressState: optionalUf,
  addressZipCode: zod.string().trim().optional(),
  logoUrl: zod.string().trim().optional(),
});

type IWorkshopFormData = zod.infer<typeof workshopFormSchema>;

// ============ SCHEMA: RELATÓRIO FINANCEIRO ============
const reportFormSchema = zod
  .object({
    from: zod.string().min(1, 'Informe a data inicial'),
    to: zod.string().min(1, 'Informe a data final'),
  })
  .refine((data) => new Date(data.from) <= new Date(data.to), {
    message: 'A data inicial não pode ser depois da final',
    path: ['to'],
  });

type IReportFormData = zod.infer<typeof reportFormSchema>;

// Mesmo formato que ServiceOrderPaymentsReportItem devolve na API
// (ver openapi.yaml, api-argila-auto) — order_code/customer_name
// enriquecidos no backend, não resolvidos aqui no front.
interface IPaymentReportItem {
  id: string;
  order_code: string;
  customer_name: string;
  amount: number;
  payment_method:
    | 'CASH'
    | 'PIX'
    | 'CREDIT_CARD'
    | 'DEBIT_CARD'
    | 'BOLETO'
    | 'BANK_TRANSFER';
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELED';
  paid_at: string | null;
}

const PAYMENT_METHOD_LABEL: Record<
  IPaymentReportItem['payment_method'],
  string
> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BOLETO: 'Boleto',
  BANK_TRANSFER: 'Transferência',
};

// PENDING nunca aparece nessa lista de verdade (o relatório filtra por
// paid_at, que só existe depois de confirmado — ver
// ShowServiceOrderPaymentsReportUseCase na API), mas o enum completo do
// schema inclui o status mesmo assim; mapeado por completude.
const PAYMENT_STATUS_LABEL: Record<IPaymentReportItem['status'], string> = {
  PENDING: 'Pendente',
  PARTIALLY_PAID: 'Parcial',
  PAID: 'Pago',
  CANCELED: 'Estornado',
};

const PAYMENT_STATUS_STYLE: Record<IPaymentReportItem['status'], string> = {
  PENDING: 'tableStatusPending',
  PARTIALLY_PAID: 'tableStatusPending',
  PAID: 'tableStatusOk',
  CANCELED: 'tableStatusAlert',
};

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const { data: workshop } = useWorkshop();

  const isPro = workshop?.subscription.plan === 'PRO';
  // Cancelamento em andamento (Pro até grace_period_ends_at, mas já
  // pedido) — distinto de "nunca assinou" (canceled_at null).
  const hasPendingCancellation = Boolean(workshop?.subscription.canceled_at);
  // "Já paga o Básico de verdade" (passou do trial, tem renews_at) vs.
  // "ainda no teste grátis" (renews_at null) — muda qual botão mostrar.
  const isPayingBasic = !isPro && Boolean(workshop?.subscription.renews_at);

  const [isLoadingSearchAddressByZipCode, setIsLoadingSearchAddressByZipCode] =
    useState(false);

  // ============ FORM: DADOS DA OFICINA ============
  const { control, handleSubmit, reset, watch, setValue } =
    useForm<IWorkshopFormData>({
      resolver: zodResolver(workshopFormSchema),
      // Preenchido via reset() assim que o workshop carrega (ver useEffect
      // mais abaixo) — useForm não espera a query, então nasce vazio.
      defaultValues: {
        name: '',
        phone: '',
        email: '',
        addressStreet: '',
        addressNumber: '',
        addressComplement: '',
        addressNeighborhood: '',
        addressCity: '',
        addressState: '',
        addressZipCode: '',
        logoUrl: '',
      },
    });

  const addressZipCodeField = watch('addressZipCode');

  // Preenche o formulário assim que os dados reais da oficina chegam (ou
  // mudam, ex: depois de salvar) — reset() troca os valores E limpa o
  // estado "dirty"/erros, diferente de setValue campo a campo. Em efeito
  // (não direto no corpo do componente) — mutar estado/ref durante o
  // render é um padrão frágil, evitado de propósito aqui.
  useEffect(() => {
    if (!workshop) {
      return;
    }

    reset({
      name: workshop.name,
      phone: workshop.phone ?? '',
      email: workshop.email ?? '',
      addressStreet: workshop.address.street ?? '',
      addressNumber: workshop.address.number ?? '',
      addressComplement: workshop.address.complement ?? '',
      addressNeighborhood: workshop.address.neighborhood ?? '',
      addressCity: workshop.address.city ?? '',
      addressState: workshop.address.state ?? '',
      addressZipCode: workshop.address.zip_code ?? '',
      logoUrl: workshop.logo_url ?? '',
    });
  }, [workshop, reset]);

  // MUTATION UPDATE WORKSHOP
  const { mutateAsync: updateWorkshopMutate, isPending: isLoadingUpdate } =
    useMutation({
      mutationFn: async ({
        name,
        phone,
        email,
        addressStreet,
        addressNumber,
        addressComplement,
        addressNeighborhood,
        addressCity,
        addressState,
        addressZipCode,
        logoUrl,
      }: IWorkshopFormData) => {
        if (!workshop) {
          return;
        }

        await api.put('/workshops', {
          id: workshop.id,
          name,
          phone: phone || null,
          email: email || null,
          addressStreet: addressStreet || null,
          addressNumber: addressNumber || null,
          addressComplement: addressComplement || null,
          addressNeighborhood: addressNeighborhood || null,
          addressCity: addressCity || null,
          addressState: addressState || null,
          addressZipCode: addressZipCode || null,
          logoUrl: logoUrl || null,
        });
      },
      onSuccess: () => {
        toast.success('Dados da oficina atualizados.', {
          position: 'bottom-center',
          autoClose: 4000,
        });

        // Re-busca GET /workshops/me — reflete o que foi salvo de verdade
        // (inclusive na tenant box da sidebar, que usa o mesmo useWorkshop).
        queryClient.invalidateQueries({ queryKey: ['workshop', 'me'] });
      },
      onError: () => {
        toast.error('Não foi possível salvar os dados da oficina.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });
  // END MUTATION UPDATE WORKSHOP

  const handleUpdateWorkshop: SubmitHandler<IWorkshopFormData> = useCallback(
    async (formData) => {
      await updateWorkshopMutate(formData);
    },
    [updateWorkshopMutate]
  );

  // Busca endereço via ViaCEP — mesmo código do Signup (ver comentário lá).
  const handleSearchAddressByZipCode = useCallback(async () => {
    if (!addressZipCodeField) {
      toast.error('Informe um CEP pra buscar.', {
        position: 'bottom-center',
        autoClose: 4000,
      });
      return;
    }

    try {
      setIsLoadingSearchAddressByZipCode(true);

      const response = await axios.get(
        `https://viacep.com.br/ws/${addressZipCodeField}/json/`
      );

      const { logradouro, bairro, localidade, uf, erro } =
        response.data as IAddressViaCep;

      if (erro) {
        toast.error('CEP não encontrado.', {
          position: 'bottom-center',
          autoClose: 4000,
        });
        return;
      }

      setValue('addressStreet', logradouro);
      setValue('addressNeighborhood', bairro);
      setValue('addressCity', localidade);
      setValue('addressState', uf);
    } catch {
      toast.error('CEP inválido.', {
        position: 'bottom-center',
        autoClose: 4000,
      });
    } finally {
      setIsLoadingSearchAddressByZipCode(false);
    }
  }, [addressZipCodeField, setValue]);

  // ============ PLANO E ASSINATURA ============
  const { mutateAsync: upgradeToProMutate, isPending: isLoadingUpgrade } =
    useMutation({
      mutationFn: async () => {
        const response = await api.post('/workshops/upgrade-to-pro');

        return response.data.checkout_url as string;
      },
      onError: () => {
        toast.error('Não foi possível iniciar o upgrade pro Pro agora.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });

  const { mutateAsync: subscribeToBasicMutate, isPending: isLoadingSubscribe } =
    useMutation({
      mutationFn: async () => {
        const response = await api.post('/workshops/subscribe-to-basic');

        return response.data.checkout_url as string;
      },
      onError: () => {
        toast.error('Não foi possível iniciar a assinatura do Básico agora.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });

  const { mutateAsync: cancelSubscriptionMutate, isPending: isLoadingCancel } =
    useMutation({
      mutationFn: async () => {
        const response = await api.post('/workshops/cancel-subscription');

        return response.data.pro_until as string;
      },
      onSuccess: (proUntil) => {
        const formattedDate = format(new Date(proUntil), 'DD/MM/YYYY', 'pt-BR');

        toast.success(
          `Cancelamento registrado — você continua Pro até ${formattedDate}.`,
          { position: 'bottom-center', autoClose: 6000 }
        );

        queryClient.invalidateQueries({ queryKey: ['workshop', 'me'] });
      },
      onError: () => {
        toast.error('Não foi possível cancelar a assinatura agora.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });

  const handleUpgradeToPro = useCallback(async () => {
    try {
      const checkoutUrl = await upgradeToProMutate();

      toast.info('Redirecionando pra página de pagamento da AbacatePay...', {
        position: 'bottom-center',
        autoClose: 3000,
      });

      window.location.href = checkoutUrl;
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  }, [upgradeToProMutate]);

  const handleSubscribeToBasic = useCallback(async () => {
    try {
      const checkoutUrl = await subscribeToBasicMutate();

      toast.info('Redirecionando pra página de pagamento da AbacatePay...', {
        position: 'bottom-center',
        autoClose: 3000,
      });

      window.location.href = checkoutUrl;
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  }, [subscribeToBasicMutate]);

  const handleCancelSubscription = useCallback(async () => {
    try {
      await cancelSubscriptionMutate();
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  }, [cancelSubscriptionMutate]);

  // ============ RELATÓRIO FINANCEIRO ============
  // Aba aberta de forma síncrona no clique do botão (mesmo padrão do
  // admin-web-amip) — abrir via window.open() só depois que a mutation
  // resolve é assíncrono demais pro navegador associar ao gesto do
  // usuário, e ele bloqueia como pop-up.
  const printWindowRef = useRef<Window | null>(null);

  const { control: reportControl, handleSubmit: handleReportSubmit } =
    useForm<IReportFormData>({
      resolver: zodResolver(reportFormSchema),
      defaultValues: { from: '', to: '' },
    });

  const buildAndOpenReportPdf = useCallback(
    (payments: IPaymentReportItem[], from: string, to: string) => {
      pdfMake.fonts = pdfMakeFonts;

      cleanTableData();

      const fromLabel = format(
        new Date(`${from}T00:00:00`),
        'DD/MM/YYYY',
        'pt-BR'
      );
      const toLabel = format(new Date(`${to}T00:00:00`), 'DD/MM/YYYY', 'pt-BR');

      const header = headerReport(
        `RELATÓRIO FINANCEIRO — ${fromLabel} a ${toLabel}`,
        workshop?.name ?? 'ArgilaAuto'
      );

      columnsTitleTable(['OS', 'Cliente', 'Método', 'Valor', 'Situação']);

      payments.forEach((payment) => {
        rowsTable([
          payment.order_code,
          payment.customer_name,
          PAYMENT_METHOD_LABEL[payment.payment_method],
          formatCurrencyBRL(payment.amount),
          {
            text: PAYMENT_STATUS_LABEL[payment.status],
            style: PAYMENT_STATUS_STYLE[payment.status],
          },
        ]);
      });

      const details = tableContent({
        registerCount: String(payments.length),
        countLabel: 'pagamentos',
        columnWidths: ['18%', '32%', '18%', '16%', '16%'],
      });

      const doc = docDefinitions({
        header,
        details,
        styles: stylesTable,
        haveFooter: true,
      });

      const printWindow = printWindowRef.current;

      pdfMake.createPdf(doc).getBlob((blob) => {
        const url = URL.createObjectURL(blob);

        if (printWindow) {
          printWindow.location.href = url;
        } else {
          window.open(url, '_blank');
        }
      });
    },
    [workshop?.name]
  );

  const { mutateAsync: generateReportMutate, isPending: isLoadingReport } =
    useMutation({
      mutationFn: async ({ from, to }: IReportFormData) => {
        const response = await api.get('/service-order-payments/report', {
          params: { from, to },
        });

        return response.data.payments as IPaymentReportItem[];
      },
      onSuccess: (payments, { from, to }) => {
        if (payments.length === 0) {
          printWindowRef.current?.close();

          toast.error('Nenhum pagamento encontrado nesse período.', {
            position: 'bottom-center',
            autoClose: 5000,
          });

          return;
        }

        buildAndOpenReportPdf(payments, from, to);
      },
      onError: () => {
        printWindowRef.current?.close();

        toast.error('Não foi possível gerar o relatório. Tente novamente.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });

  const handleGenerateReport: SubmitHandler<IReportFormData> = useCallback(
    async (formData) => {
      // Precisa ser a primeira coisa no handler, ainda de forma síncrona,
      // pro navegador contar como parte do gesto de clique.
      printWindowRef.current = window.open('', '_blank');

      await generateReportMutate(formData);
    },
    [generateReportMutate]
  );
  // ============ FIM RELATÓRIO FINANCEIRO ============

  return (
    <AppShell
      title='Configurações'
      subtitle='Dados da oficina, plano e relatório financeiro'
    >
      {/* ===== SEÇÃO 1: DADOS DA OFICINA ===== */}
      <section className='rounded-[10px] border border-border bg-surface p-6'>
        <h2 className='font-display text-lg font-bold'>Dados da oficina</h2>
        <p className='mt-1 text-[13px] text-text-muted'>
          CNPJ não é editável depois do cadastro.
        </p>

        <form
          onSubmit={handleSubmit(handleUpdateWorkshop)}
          noValidate
          className='mt-5 max-w-2xl'
        >
          <InputFormControl
            control={control}
            name='name'
            label='Nome da oficina'
            placeholder='Ex: Oficina do João'
          />

          <div className='mt-4'>
            <label
              htmlFor='workshop-cnpj'
              className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
            >
              CNPJ
            </label>
            <input
              id='workshop-cnpj'
              value={workshop?.cnpj ?? 'Não informado'}
              disabled
              className='w-full rounded-[9px] border border-border-strong bg-surface-2 px-3.5 py-2.5 text-sm text-text-muted outline-none'
            />
          </div>

          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputMaskFormControl
                control={control}
                name='phone'
                label='Telefone'
                mask='(00) 00000-0000'
                placeholder='(11) 99999-9999'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={control}
                name='email'
                label='E-mail'
                type='email'
                placeholder='contato@suaoficina.com.br'
              />
            </div>
          </div>

          <InputFormControl
            control={control}
            name='logoUrl'
            label='URL da logo (opcional)'
            placeholder='https://...'
          />

          <p className='mt-6 mb-1 text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
            Endereço
          </p>
          <div className='flex items-end gap-3'>
            <div className='flex-1'>
              <InputMaskFormControl
                control={control}
                name='addressZipCode'
                label='CEP'
                mask='00000-000'
                unmask={false}
                placeholder='00000-000'
              />
            </div>
            <div className='mb-4'>
              <Button
                type='button'
                onClick={handleSearchAddressByZipCode}
                disabled={isLoadingSearchAddressByZipCode}
                className='w-auto! px-4'
              >
                <MagnifyingGlass size={18} />
              </Button>
            </div>
          </div>
          <div className='flex gap-3'>
            <div className='flex-3'>
              <InputFormControl
                control={control}
                name='addressStreet'
                label='Rua'
                placeholder='Preenchido pelo CEP'
                disabled
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={control}
                name='addressNumber'
                label='Número'
                placeholder='123'
              />
            </div>
          </div>
          <InputFormControl
            control={control}
            name='addressComplement'
            label='Complemento'
            placeholder='Sala, bloco, etc.'
          />
          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputFormControl
                control={control}
                name='addressNeighborhood'
                label='Bairro'
                placeholder='Preenchido pelo CEP'
                disabled
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={control}
                name='addressCity'
                label='Cidade'
                placeholder='Preenchido pelo CEP'
                disabled
              />
            </div>
          </div>
          <div className='w-20'>
            <InputFormControl
              control={control}
              name='addressState'
              label='UF'
              placeholder='UF'
              disabled
            />
          </div>

          <div className='mt-5 max-w-xs'>
            <Button type='submit' disabled={isLoadingUpdate || !workshop}>
              <span className='inline-flex items-center justify-center gap-2'>
                <FloppyDisk size={18} />
                {isLoadingUpdate ? 'Salvando...' : 'Salvar dados'}
              </span>
            </Button>
          </div>
        </form>
      </section>

      {/* ===== SEÇÃO 2: PLANO E ASSINATURA ===== */}
      <section className='mt-6 rounded-[10px] border border-border bg-surface p-6'>
        <h2 className='font-display text-lg font-bold'>Plano e assinatura</h2>

        {!workshop ? (
          <p className='mt-2 text-[13px] text-text-muted'>Carregando...</p>
        ) : (
          <div className='mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold uppercase tracking-wide ${
                  isPro
                    ? 'bg-clay-soft text-clay-deep'
                    : 'bg-steel-soft text-steel'
                }`}
              >
                {isPro && <Sparkle size={13} weight='fill' />}
                {isPro ? 'Pro' : 'Básico'}
              </span>

              {/* Mensagem de status muda conforme o estado real da
                  assinatura (ver workshop.subscription no openapi.yaml):
                  Pro com cancelamento pendente, Pro ativo, Básico pago,
                  ou ainda em teste grátis. */}
              <p className='mt-2 text-[13px] text-text-muted'>
                {isPro && hasPendingCancellation && (
                  <>
                    Cancelamento em andamento — continua Pro até{' '}
                    {format(
                      new Date(workshop.subscription.grace_period_ends_at!),
                      'DD/MM/YYYY',
                      'pt-BR'
                    )}
                    .
                  </>
                )}
                {isPro &&
                  !hasPendingCancellation &&
                  workshop.subscription.renews_at && (
                    <>
                      Renova em{' '}
                      {format(
                        new Date(workshop.subscription.renews_at),
                        'DD/MM/YYYY',
                        'pt-BR'
                      )}
                      .
                    </>
                  )}
                {!isPro && isPayingBasic && workshop.subscription.renews_at && (
                  <>
                    Renova em{' '}
                    {format(
                      new Date(workshop.subscription.renews_at),
                      'DD/MM/YYYY',
                      'pt-BR'
                    )}
                    .
                  </>
                )}
                {!isPro && !isPayingBasic && (
                  <>
                    Teste grátis até{' '}
                    {format(
                      new Date(workshop.subscription.trial_ends_at),
                      'DD/MM/YYYY',
                      'pt-BR'
                    )}
                    {workshop.subscription.blocked && ' — acesso bloqueado'}.
                  </>
                )}
              </p>
            </div>

            <div className='flex flex-wrap gap-3'>
              {!isPro && (
                <div className='w-44'>
                  <Button
                    variant='ghost'
                    onClick={handleSubscribeToBasic}
                    disabled={isLoadingSubscribe || isPayingBasic}
                  >
                    {isLoadingSubscribe ? 'Abrindo...' : 'Assinar Básico'}
                  </Button>
                </div>
              )}

              {!isPro && (
                <div className='w-44'>
                  <Button
                    onClick={handleUpgradeToPro}
                    disabled={isLoadingUpgrade}
                  >
                    <span className='inline-flex items-center justify-center gap-2'>
                      <Sparkle size={16} />
                      {isLoadingUpgrade ? 'Abrindo...' : 'Virar Pro'}
                    </span>
                  </Button>
                </div>
              )}

              {isPro && !hasPendingCancellation && (
                <div className='w-48'>
                  <Button
                    variant='ghost'
                    onClick={handleCancelSubscription}
                    disabled={isLoadingCancel}
                  >
                    {isLoadingCancel ? 'Cancelando...' : 'Cancelar assinatura'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ===== SEÇÃO 3: RELATÓRIO FINANCEIRO ===== */}
      <section className='mt-6 rounded-[10px] border border-border bg-surface p-6'>
        <h2 className='font-display text-lg font-bold'>Relatório financeiro</h2>
        <p className='mt-1 text-[13px] text-text-muted'>
          Gera um PDF com todos os pagamentos confirmados no período (exclui
          pendentes, lista estornados fora do total).
        </p>

        <form
          onSubmit={handleReportSubmit(handleGenerateReport)}
          noValidate
          className='mt-4 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-end'
        >
          <div className='w-full sm:w-52'>
            <InputFormControl
              control={reportControl}
              name='from'
              label='De'
              type='date'
            />
          </div>
          <div className='w-full sm:w-52'>
            <InputFormControl
              control={reportControl}
              name='to'
              label='Até'
              type='date'
            />
          </div>
          <div className='w-full sm:w-52'>
            <Button type='submit' disabled={isLoadingReport}>
              <span className='inline-flex items-center justify-center gap-2'>
                <FileText size={18} />
                {isLoadingReport ? 'Gerando...' : 'Gerar PDF'}
              </span>
            </Button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}

export const getServerSideProps = withSSRAuth(async () => {
  return {
    props: {},
  };
});
