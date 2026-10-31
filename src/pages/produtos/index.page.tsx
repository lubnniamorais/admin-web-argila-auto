import { zodResolver } from '@hookform/resolvers/zod';
import * as RadixTabs from '@radix-ui/react-tabs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Head from 'next/head';
import { MagnifyingGlass, Pencil, Plus } from 'phosphor-react';
import { useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { tv } from 'tailwind-variants';
import { z as zod } from 'zod';

import { AppShell } from '@/components/AppShell';
import { Dialog } from '@/components/Dialog';
import { Button, buttonClassName } from '@/components/Form/Button';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { SelectPickerFormControl } from '@/components/Form/SelectPickerFormControl';
import { SwitchFormControl } from '@/components/Form/SwitchFormControl';
import { Pagination } from '@/components/Pagination';
import { IPart, useParts } from '@/hooks/parts';
import { IService, useServices } from '@/hooks/services';
import { api } from '@/lib/apiClient';
import { MAINTENANCE_CATEGORY_OPTIONS } from '@/utils/maintenanceCategory';
import { withSSRAuth } from '@/utils/withSSRAuth';

// ============ HELPERS NUMÉRICOS DE FORM (mesmo racional de
// optionalCoercedNumber em clientes-veiculos/index.page.tsx) ============
// `zod.coerce.number()` sozinho transformaria um campo vazio ('') em 0
// (Number('') === 0 em JS) — pra um preço/estoque OBRIGATÓRIO isso
// deixaria passar em branco como se fosse "zero" de propósito, sem erro
// nenhum. Por isso troca '' por undefined ANTES do coerce, e só então
// aplica a regra de obrigatório (zod reporta "Required" pra undefined).
function requiredCoercedNumber(message: string) {
  return zod.preprocess(
    (value) => (value === '' ? undefined : value),
    zod.coerce
      .number({ invalid_type_error: message, required_error: message })
      .min(0, 'Não pode ser negativo')
  );
}

// Mesma ideia, só que pra campo OPCIONAL (quantity/minimumStock no
// cadastro de peça) — '' também vira undefined, mas aqui undefined é
// válido (a API aplica o default dela quando o campo nem é enviado).
const optionalCoercedInt = zod.preprocess(
  (value) => (value === '' ? undefined : value),
  zod.coerce.number().int().min(0, 'Não pode ser negativo').optional()
);

// ============ SCHEMA: CADASTRAR/EDITAR PEÇA ============
const createPartFormSchema = zod.object({
  sku: zod.string().trim().min(1, 'Informe o SKU'),
  name: zod.string().trim().min(1, 'Informe o nome da peça'),
  oemCode: zod.string().trim().optional(),
  description: zod.string().trim().optional(),
  costPrice: requiredCoercedNumber('Informe o preço de custo'),
  salePrice: requiredCoercedNumber('Informe o preço de venda'),
  quantity: optionalCoercedInt,
  minimumStock: optionalCoercedInt,
  maintenanceCategory: zod.string().min(1, 'Selecione a categoria'),
});

type ICreatePartFormData = zod.infer<typeof createPartFormSchema>;

// `sku` não entra aqui — PUT /parts não aceita editar (campo âncora).
// `quantity` também não entra — não é mais editável por PUT /parts desde
// que StockMovement existe (só muda via POST /parts/{id}/stock-movements,
// funcionalidade deixada pra uma entrega futura, ou automaticamente pela
// OS). `minimumStock` e `active` são obrigatórios aqui porque a própria
// API exige os dois no corpo do PUT.
const editPartFormSchema = zod.object({
  name: zod.string().trim().min(1, 'Informe o nome da peça'),
  oemCode: zod.string().trim().optional(),
  description: zod.string().trim().optional(),
  costPrice: requiredCoercedNumber('Informe o preço de custo'),
  salePrice: requiredCoercedNumber('Informe o preço de venda'),
  minimumStock: zod.coerce
    .number({ invalid_type_error: 'Informe o estoque mínimo' })
    .int()
    .min(0, 'Não pode ser negativo'),
  active: zod.boolean(),
  maintenanceCategory: zod.string().min(1, 'Selecione a categoria'),
});

type IEditPartFormData = zod.infer<typeof editPartFormSchema>;
// ============ FIM SCHEMA: CADASTRAR/EDITAR PEÇA ============

// ============ SCHEMA: CADASTRAR/EDITAR SERVIÇO ============
const createServiceFormSchema = zod.object({
  name: zod.string().trim().min(1, 'Informe o nome do serviço'),
  description: zod.string().trim().optional(),
  defaultPrice: requiredCoercedNumber('Informe o preço padrão'),
  maintenanceCategory: zod.string().min(1, 'Selecione a categoria'),
});

type ICreateServiceFormData = zod.infer<typeof createServiceFormSchema>;

// `active` obrigatório aqui pelo mesmo motivo de editPartFormSchema — é
// o único jeito de desativar um serviço (não existe DELETE /services).
const editServiceFormSchema = zod.object({
  name: zod.string().trim().min(1, 'Informe o nome do serviço'),
  description: zod.string().trim().optional(),
  defaultPrice: requiredCoercedNumber('Informe o preço padrão'),
  active: zod.boolean(),
  maintenanceCategory: zod.string().min(1, 'Selecione a categoria'),
});

type IEditServiceFormData = zod.infer<typeof editServiceFormSchema>;
// ============ FIM SCHEMA: CADASTRAR/EDITAR SERVIÇO ============

// Mesmo valor usado como perPage nos outros `GET` paginados do admin (ver
// clientes-veiculos, dashboard.ts).
const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Abas Peças/Serviços — decisão confirmada com o usuário: Radix Tabs de
// verdade (primitivo acessível, ARIA roles + navegação por teclado) em
// vez de dois botões com estado local, consistente com a diretriz do
// CLAUDE.md de usar Radix como base pra componentes de UI.
const tabTrigger = tv({
  base: '-mb-px border-b-2 border-transparent px-4 py-2.5 text-[13.5px] font-bold text-text-muted transition-colors data-[state=active]:border-clay data-[state=active]:text-clay',
});

function CategoryBadge({ children }: { children: string }) {
  return (
    <span className='inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-text-muted'>
      {children}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold ${
        active ? 'bg-good-soft text-good' : 'bg-neutral-soft text-neutral-badge'
      }`}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

export default function ProdutosPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'pecas' | 'servicos'>('pecas');

  // ============================================================
  // ===================== ABA: PEÇAS ==========================
  // ============================================================

  // FUNCTIONS (peças)
  const [partsPage, setPartsPage] = useState(1);
  const [partsSearchInput, setPartsSearchInput] = useState('');
  const [partsSearchParam, setPartsSearchParam] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPartsSearchParam(partsSearchInput);
      setPartsPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [partsSearchInput]);

  const { data: partsData, isLoading: isLoadingParts } = useParts({
    page: partsPage,
    perPage: PER_PAGE,
    searchParam: partsSearchParam,
  });
  // END FUNCTIONS (peças)

  // ============ MODAL: CADASTRAR PEÇA ============
  const [isCreatePartModalOpen, setIsCreatePartModalOpen] = useState(false);

  const {
    control: createPartControl,
    handleSubmit: handleCreatePartSubmit,
    reset: resetCreatePartForm,
  } = useForm<ICreatePartFormData>({
    resolver: zodResolver(createPartFormSchema),
    defaultValues: {
      sku: '',
      name: '',
      oemCode: '',
      description: '',
      costPrice: '' as unknown as number,
      salePrice: '' as unknown as number,
      quantity: '' as unknown as number,
      minimumStock: '' as unknown as number,
      maintenanceCategory: '',
    },
  });

  // MUTATION CREATE PART
  const { mutateAsync: createPartMutate, isPending: isLoadingCreatePart } =
    useMutation({
      mutationFn: async ({
        sku,
        name,
        oemCode,
        description,
        costPrice,
        salePrice,
        quantity,
        minimumStock,
        maintenanceCategory,
      }: ICreatePartFormData) => {
        await api.post('/parts', {
          sku,
          name,
          oemCode: oemCode || null,
          description: description || null,
          costPrice,
          salePrice,
          // undefined aqui é de propósito (ver optionalCoercedInt) — o
          // axios/JSON.stringify simplesmente omite a chave, e a API
          // aplica o default dela (0/1) quando o campo não é enviado.
          quantity,
          minimumStock,
          maintenanceCategory,
        });
      },
      onSuccess: () => {
        toast.success('Peça cadastrada.', {
          position: 'bottom-center',
          autoClose: 4000,
        });

        queryClient.invalidateQueries({ queryKey: ['parts'] });
        setIsCreatePartModalOpen(false);
        resetCreatePartForm();
      },
      onError: (error) => {
        const message =
          axios.isAxiosError(error) && error.response?.status === 400
            ? 'Já existe uma peça com esse SKU.'
            : 'Não foi possível cadastrar a peça.';

        toast.error(message, { position: 'bottom-center', autoClose: 5000 });
      },
    });
  // END MUTATION CREATE PART

  const handleCreatePart: SubmitHandler<ICreatePartFormData> = async (
    formData
  ) => {
    try {
      await createPartMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM MODAL: CADASTRAR PEÇA ============

  // ============ MODAL: EDITAR PEÇA ============
  // Guarda a peça INTEIRA (não só o id) — a linha clicada já tem tudo que
  // o form precisa (inclui sku/quantity só-leitura), sem chamada extra.
  const [editingPart, setEditingPart] = useState<IPart | null>(null);

  const {
    control: editPartControl,
    handleSubmit: handleEditPartSubmit,
    reset: resetEditPartForm,
  } = useForm<IEditPartFormData>({
    resolver: zodResolver(editPartFormSchema),
    defaultValues: {
      name: '',
      oemCode: '',
      description: '',
      costPrice: '' as unknown as number,
      salePrice: '' as unknown as number,
      minimumStock: '' as unknown as number,
      active: true,
      maintenanceCategory: '',
    },
  });

  useEffect(() => {
    if (!editingPart) {
      return;
    }

    resetEditPartForm({
      name: editingPart.name,
      oemCode: editingPart.oem_code ?? '',
      description: editingPart.description ?? '',
      costPrice: editingPart.cost_price,
      salePrice: editingPart.sale_price,
      minimumStock: editingPart.minimum_stock,
      active: editingPart.active,
      maintenanceCategory: editingPart.maintenance_category,
    });
  }, [editingPart, resetEditPartForm]);

  // MUTATION UPDATE PART
  const { mutateAsync: updatePartMutate, isPending: isLoadingEditPart } =
    useMutation({
      mutationFn: async ({
        name,
        oemCode,
        description,
        costPrice,
        salePrice,
        minimumStock,
        active,
        maintenanceCategory,
      }: IEditPartFormData) => {
        if (!editingPart) {
          return;
        }

        await api.put('/parts', {
          id: editingPart.id,
          name,
          oemCode: oemCode || null,
          description: description || null,
          costPrice,
          salePrice,
          minimumStock,
          active,
          maintenanceCategory,
        });
      },
      onSuccess: () => {
        toast.success('Peça atualizada.', {
          position: 'bottom-center',
          autoClose: 4000,
        });

        queryClient.invalidateQueries({ queryKey: ['parts'] });
        setEditingPart(null);
      },
      onError: () => {
        toast.error('Não foi possível salvar as alterações da peça.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });
  // END MUTATION UPDATE PART

  const handleEditPart: SubmitHandler<IEditPartFormData> = async (formData) => {
    try {
      await updatePartMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM MODAL: EDITAR PEÇA ============

  // ============================================================
  // ==================== ABA: SERVIÇOS ========================
  // ============================================================

  // FUNCTIONS (serviços)
  const [servicesPage, setServicesPage] = useState(1);
  const [servicesSearchInput, setServicesSearchInput] = useState('');
  const [servicesSearchParam, setServicesSearchParam] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setServicesSearchParam(servicesSearchInput);
      setServicesPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [servicesSearchInput]);

  const { data: servicesData, isLoading: isLoadingServices } = useServices({
    page: servicesPage,
    perPage: PER_PAGE,
    searchParam: servicesSearchParam,
  });
  // END FUNCTIONS (serviços)

  // ============ MODAL: CADASTRAR SERVIÇO ============
  const [isCreateServiceModalOpen, setIsCreateServiceModalOpen] =
    useState(false);

  const {
    control: createServiceControl,
    handleSubmit: handleCreateServiceSubmit,
    reset: resetCreateServiceForm,
  } = useForm<ICreateServiceFormData>({
    resolver: zodResolver(createServiceFormSchema),
    defaultValues: {
      name: '',
      description: '',
      defaultPrice: '' as unknown as number,
      maintenanceCategory: '',
    },
  });

  // MUTATION CREATE SERVICE
  const {
    mutateAsync: createServiceMutate,
    isPending: isLoadingCreateService,
  } = useMutation({
    mutationFn: async ({
      name,
      description,
      defaultPrice,
      maintenanceCategory,
    }: ICreateServiceFormData) => {
      await api.post('/services', {
        name,
        description: description || null,
        defaultPrice,
        maintenanceCategory,
      });
    },
    onSuccess: () => {
      toast.success('Serviço cadastrado.', {
        position: 'bottom-center',
        autoClose: 4000,
      });

      queryClient.invalidateQueries({ queryKey: ['services'] });
      setIsCreateServiceModalOpen(false);
      resetCreateServiceForm();
    },
    onError: () => {
      toast.error('Não foi possível cadastrar o serviço.', {
        position: 'bottom-center',
        autoClose: 5000,
      });
    },
  });
  // END MUTATION CREATE SERVICE

  const handleCreateService: SubmitHandler<ICreateServiceFormData> = async (
    formData
  ) => {
    try {
      await createServiceMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM MODAL: CADASTRAR SERVIÇO ============

  // ============ MODAL: EDITAR SERVIÇO ============
  const [editingService, setEditingService] = useState<IService | null>(null);

  const {
    control: editServiceControl,
    handleSubmit: handleEditServiceSubmit,
    reset: resetEditServiceForm,
  } = useForm<IEditServiceFormData>({
    resolver: zodResolver(editServiceFormSchema),
    defaultValues: {
      name: '',
      description: '',
      defaultPrice: '' as unknown as number,
      active: true,
      maintenanceCategory: '',
    },
  });

  useEffect(() => {
    if (!editingService) {
      return;
    }

    resetEditServiceForm({
      name: editingService.name,
      description: editingService.description ?? '',
      defaultPrice: editingService.default_price,
      active: editingService.active,
      maintenanceCategory: editingService.maintenance_category,
    });
  }, [editingService, resetEditServiceForm]);

  // MUTATION UPDATE SERVICE
  const { mutateAsync: updateServiceMutate, isPending: isLoadingEditService } =
    useMutation({
      mutationFn: async ({
        name,
        description,
        defaultPrice,
        active,
        maintenanceCategory,
      }: IEditServiceFormData) => {
        if (!editingService) {
          return;
        }

        await api.put('/services', {
          id: editingService.id,
          name,
          description: description || null,
          defaultPrice,
          active,
          maintenanceCategory,
        });
      },
      onSuccess: () => {
        toast.success('Serviço atualizado.', {
          position: 'bottom-center',
          autoClose: 4000,
        });

        queryClient.invalidateQueries({ queryKey: ['services'] });
        setEditingService(null);
      },
      onError: () => {
        toast.error('Não foi possível salvar as alterações do serviço.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });
  // END MUTATION UPDATE SERVICE

  const handleEditService: SubmitHandler<IEditServiceFormData> = async (
    formData
  ) => {
    try {
      await updateServiceMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM MODAL: EDITAR SERVIÇO ============

  return (
    <AppShell
      title='Produtos'
      subtitle='Peças em estoque e catálogo de serviços'
    >
      <Head>
        <title>Produtos | ArgilaAuto</title>
      </Head>

      <RadixTabs.Root
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'pecas' | 'servicos')}
      >
        <RadixTabs.List className='flex gap-1 border-b border-border'>
          <RadixTabs.Trigger value='pecas' className={tabTrigger()}>
            Peças
          </RadixTabs.Trigger>
          <RadixTabs.Trigger value='servicos' className={tabTrigger()}>
            Serviços
          </RadixTabs.Trigger>
        </RadixTabs.List>

        {/* ===== CONTEÚDO: PEÇAS ===== */}
        <RadixTabs.Content value='pecas'>
          <div className='mt-5 rounded-[10px] border border-border bg-surface p-5'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='relative w-full sm:max-w-xs'>
                <MagnifyingGlass
                  size={16}
                  className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted'
                />
                <input
                  type='text'
                  value={partsSearchInput}
                  onChange={(event) => setPartsSearchInput(event.target.value)}
                  placeholder='Buscar por nome, SKU...'
                  className='w-full rounded-[9px] border border-border-strong bg-background py-2.5 pr-3.5 pl-9 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1'
                />
              </div>

              <button
                type='button'
                onClick={() => setIsCreatePartModalOpen(true)}
                className={buttonClassName('primary', 'w-auto px-5')}
              >
                <span className='inline-flex items-center gap-2'>
                  <Plus size={18} />
                  Nova peça
                </span>
              </button>
            </div>

            {!partsData || partsData.parts.length === 0 ? (
              <p className='mt-5 py-6 text-center text-text-muted'>
                {isLoadingParts
                  ? 'Carregando...'
                  : partsSearchParam
                    ? 'Nenhuma peça encontrada pra essa busca.'
                    : 'Nenhuma peça cadastrada ainda.'}
              </p>
            ) : (
              <>
                {/* ===== TABELA (telas largas) — mesmo breakpoint
                    (880px) da sidebar, ver CLAUDE.md pegadinha #1 sobre
                    classe condicional literal. ===== */}
                <div className='mt-5 max-[880px]:hidden overflow-x-auto'>
                  <table className='w-full border-collapse text-[13.5px]'>
                    <thead>
                      <tr className='border-b border-border text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                        <th className='pb-2 pr-3'>SKU</th>
                        <th className='pb-2 pr-3'>Nome</th>
                        <th className='pb-2 pr-3'>Categoria</th>
                        <th className='pb-2 pr-3'>Custo</th>
                        <th className='pb-2 pr-3'>Venda</th>
                        <th className='pb-2 pr-3'>Estoque</th>
                        <th className='pb-2'>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partsData.parts.map((part: IPart) => {
                        const isLowStock = part.quantity <= part.minimum_stock;

                        return (
                          <tr
                            key={part.id}
                            className='border-b border-border last:border-0 align-top'
                          >
                            <td className='py-2.5 pr-3 font-mono text-text-muted'>
                              {part.sku}
                            </td>
                            <td className='py-2.5 pr-3 font-semibold'>
                              {part.name}
                            </td>
                            <td className='py-2.5 pr-3'>
                              <CategoryBadge>
                                {MAINTENANCE_CATEGORY_OPTIONS.find(
                                  (option) =>
                                    option.value === part.maintenance_category
                                )?.label ?? part.maintenance_category}
                              </CategoryBadge>
                            </td>
                            <td className='py-2.5 pr-3 font-mono'>
                              {formatCurrencyBRL(part.cost_price)}
                            </td>
                            <td className='py-2.5 pr-3 font-mono'>
                              {formatCurrencyBRL(part.sale_price)}
                            </td>
                            <td className='py-2.5 pr-3 font-mono'>
                              <span
                                className={
                                  isLowStock ? 'font-bold text-warn' : ''
                                }
                              >
                                {part.quantity}
                              </span>
                              <span className='text-text-muted'>
                                {' '}
                                / {part.minimum_stock}
                              </span>
                            </td>
                            <td className='py-2.5'>
                              <button
                                type='button'
                                onClick={() => setEditingPart(part)}
                                aria-label={`Editar ${part.name}`}
                                className='text-text-muted transition-colors hover:text-clay'
                              >
                                <Pencil size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ===== CARDS (telas estreitas) ===== */}
                <div className='mt-5 hidden max-[880px]:flex flex-col gap-3'>
                  {partsData.parts.map((part: IPart) => {
                    const isLowStock = part.quantity <= part.minimum_stock;

                    return (
                      <div
                        key={part.id}
                        className='rounded-[10px] border border-border p-4'
                      >
                        <div className='flex items-start justify-between gap-2'>
                          <div className='min-w-0'>
                            <p className='font-semibold'>{part.name}</p>
                            <p className='mt-0.5 font-mono text-[12.5px] text-text-muted'>
                              {part.sku}
                            </p>
                            <div className='mt-1.5'>
                              <CategoryBadge>
                                {MAINTENANCE_CATEGORY_OPTIONS.find(
                                  (option) =>
                                    option.value === part.maintenance_category
                                )?.label ?? part.maintenance_category}
                              </CategoryBadge>
                            </div>
                          </div>
                          <button
                            type='button'
                            onClick={() => setEditingPart(part)}
                            aria-label={`Editar ${part.name}`}
                            className='shrink-0 text-text-muted transition-colors hover:text-clay'
                          >
                            <Pencil size={15} />
                          </button>
                        </div>

                        <div className='mt-3 flex items-center justify-between border-t border-border pt-3 font-mono text-[12.5px]'>
                          <span>
                            Custo {formatCurrencyBRL(part.cost_price)} · Venda{' '}
                            {formatCurrencyBRL(part.sale_price)}
                          </span>
                          <span
                            className={isLowStock ? 'font-bold text-warn' : ''}
                          >
                            {part.quantity} / {part.minimum_stock}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {partsData && partsData.totalCount > 0 && (
              <Pagination
                pageCurrent={partsPage}
                totalCount={partsData.totalCount}
                perPage={PER_PAGE}
                onPageChange={setPartsPage}
              />
            )}
          </div>
        </RadixTabs.Content>

        {/* ===== CONTEÚDO: SERVIÇOS ===== */}
        <RadixTabs.Content value='servicos'>
          <div className='mt-5 rounded-[10px] border border-border bg-surface p-5'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='relative w-full sm:max-w-xs'>
                <MagnifyingGlass
                  size={16}
                  className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted'
                />
                <input
                  type='text'
                  value={servicesSearchInput}
                  onChange={(event) =>
                    setServicesSearchInput(event.target.value)
                  }
                  placeholder='Buscar por nome...'
                  className='w-full rounded-[9px] border border-border-strong bg-background py-2.5 pr-3.5 pl-9 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1'
                />
              </div>

              <button
                type='button'
                onClick={() => setIsCreateServiceModalOpen(true)}
                className={buttonClassName('primary', 'w-auto px-5')}
              >
                <span className='inline-flex items-center gap-2'>
                  <Plus size={18} />
                  Novo serviço
                </span>
              </button>
            </div>

            {!servicesData || servicesData.services.length === 0 ? (
              <p className='mt-5 py-6 text-center text-text-muted'>
                {isLoadingServices
                  ? 'Carregando...'
                  : servicesSearchParam
                    ? 'Nenhum serviço encontrado pra essa busca.'
                    : 'Nenhum serviço cadastrado ainda.'}
              </p>
            ) : (
              <>
                <div className='mt-5 max-[880px]:hidden overflow-x-auto'>
                  <table className='w-full border-collapse text-[13.5px]'>
                    <thead>
                      <tr className='border-b border-border text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                        <th className='pb-2 pr-3'>Nome</th>
                        <th className='pb-2 pr-3'>Categoria</th>
                        <th className='pb-2 pr-3'>Preço padrão</th>
                        <th className='pb-2 pr-3'>Status</th>
                        <th className='pb-2'>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicesData.services.map((service: IService) => (
                        <tr
                          key={service.id}
                          className='border-b border-border last:border-0 align-top'
                        >
                          <td className='py-2.5 pr-3 font-semibold'>
                            {service.name}
                          </td>
                          <td className='py-2.5 pr-3'>
                            <CategoryBadge>
                              {MAINTENANCE_CATEGORY_OPTIONS.find(
                                (option) =>
                                  option.value === service.maintenance_category
                              )?.label ?? service.maintenance_category}
                            </CategoryBadge>
                          </td>
                          <td className='py-2.5 pr-3 font-mono'>
                            {formatCurrencyBRL(service.default_price)}
                          </td>
                          <td className='py-2.5 pr-3'>
                            <ActiveBadge active={service.active} />
                          </td>
                          <td className='py-2.5'>
                            <button
                              type='button'
                              onClick={() => setEditingService(service)}
                              aria-label={`Editar ${service.name}`}
                              className='text-text-muted transition-colors hover:text-clay'
                            >
                              <Pencil size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className='mt-5 hidden max-[880px]:flex flex-col gap-3'>
                  {servicesData.services.map((service: IService) => (
                    <div
                      key={service.id}
                      className='rounded-[10px] border border-border p-4'
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <p className='font-semibold'>{service.name}</p>
                          <div className='mt-1.5 flex flex-wrap items-center gap-1.5'>
                            <CategoryBadge>
                              {MAINTENANCE_CATEGORY_OPTIONS.find(
                                (option) =>
                                  option.value === service.maintenance_category
                              )?.label ?? service.maintenance_category}
                            </CategoryBadge>
                            <ActiveBadge active={service.active} />
                          </div>
                        </div>
                        <button
                          type='button'
                          onClick={() => setEditingService(service)}
                          aria-label={`Editar ${service.name}`}
                          className='shrink-0 text-text-muted transition-colors hover:text-clay'
                        >
                          <Pencil size={15} />
                        </button>
                      </div>

                      <p className='mt-3 border-t border-border pt-3 font-mono text-[12.5px]'>
                        {formatCurrencyBRL(service.default_price)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {servicesData && servicesData.totalCount > 0 && (
              <Pagination
                pageCurrent={servicesPage}
                totalCount={servicesData.totalCount}
                perPage={PER_PAGE}
                onPageChange={setServicesPage}
              />
            )}
          </div>
        </RadixTabs.Content>
      </RadixTabs.Root>

      {/* ===== MODAL: CADASTRAR PEÇA ===== */}
      <Dialog
        open={isCreatePartModalOpen}
        onOpenChange={setIsCreatePartModalOpen}
        title='Nova peça'
        description='Cadastro no estoque da oficina.'
      >
        <form onSubmit={handleCreatePartSubmit(handleCreatePart)} noValidate>
          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputFormControl
                control={createPartControl}
                name='sku'
                label='SKU'
                placeholder='FLT-OIL-001'
              />
            </div>
            <div className='flex-2'>
              <InputFormControl
                control={createPartControl}
                name='oemCode'
                label='Código do fabricante (opcional)'
                placeholder='OEM123'
              />
            </div>
          </div>

          <InputFormControl
            control={createPartControl}
            name='name'
            label='Nome'
            placeholder='Filtro de óleo padrão'
          />

          <InputFormControl
            control={createPartControl}
            name='description'
            label='Descrição (opcional)'
            placeholder='Detalhes adicionais da peça'
          />

          <SelectPickerFormControl
            control={createPartControl}
            name='maintenanceCategory'
            label='Categoria de manutenção'
            placeholder='Selecione'
            data={MAINTENANCE_CATEGORY_OPTIONS}
          />

          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputFormControl
                control={createPartControl}
                name='costPrice'
                label='Preço de custo (R$)'
                type='number'
                step='0.01'
                placeholder='0,00'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={createPartControl}
                name='salePrice'
                label='Preço de venda (R$)'
                type='number'
                step='0.01'
                placeholder='0,00'
              />
            </div>
          </div>

          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputFormControl
                control={createPartControl}
                name='quantity'
                label='Quantidade inicial (opcional)'
                type='number'
                placeholder='0'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={createPartControl}
                name='minimumStock'
                label='Estoque mínimo (opcional)'
                type='number'
                placeholder='1'
              />
            </div>
          </div>

          <div className='mt-6'>
            <Button type='submit' disabled={isLoadingCreatePart}>
              {isLoadingCreatePart ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ===== MODAL: EDITAR PEÇA ===== */}
      <Dialog
        open={editingPart !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPart(null);
          }
        }}
        title='Editar peça'
        description='SKU e quantidade em estoque não são editáveis aqui.'
      >
        <form onSubmit={handleEditPartSubmit(handleEditPart)} noValidate>
          <div className='flex gap-3'>
            <div className='flex-1'>
              <label
                htmlFor='edit-part-sku'
                className='mb-1.5 mt-4 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
              >
                SKU
              </label>
              <input
                id='edit-part-sku'
                value={editingPart?.sku ?? ''}
                disabled
                className='w-full rounded-[9px] border border-border-strong bg-surface-2 px-3.5 py-2.5 text-sm text-text-muted outline-none'
              />
            </div>
            <div className='flex-2'>
              <InputFormControl
                control={editPartControl}
                name='oemCode'
                label='Código do fabricante (opcional)'
                placeholder='OEM123'
              />
            </div>
          </div>

          <InputFormControl
            control={editPartControl}
            name='name'
            label='Nome'
            placeholder='Filtro de óleo padrão'
          />

          <InputFormControl
            control={editPartControl}
            name='description'
            label='Descrição (opcional)'
            placeholder='Detalhes adicionais da peça'
          />

          <SelectPickerFormControl
            control={editPartControl}
            name='maintenanceCategory'
            label='Categoria de manutenção'
            placeholder='Selecione'
            data={MAINTENANCE_CATEGORY_OPTIONS}
          />

          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputFormControl
                control={editPartControl}
                name='costPrice'
                label='Preço de custo (R$)'
                type='number'
                step='0.01'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={editPartControl}
                name='salePrice'
                label='Preço de venda (R$)'
                type='number'
                step='0.01'
              />
            </div>
          </div>

          <div className='flex gap-3'>
            <div className='flex-1'>
              <label
                htmlFor='edit-part-quantity'
                className='mb-1.5 mt-4 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
              >
                Estoque atual
              </label>
              <input
                id='edit-part-quantity'
                value={editingPart?.quantity ?? 0}
                disabled
                className='w-full rounded-[9px] border border-border-strong bg-surface-2 px-3.5 py-2.5 text-sm text-text-muted outline-none'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={editPartControl}
                name='minimumStock'
                label='Estoque mínimo'
                type='number'
              />
            </div>
          </div>

          <SwitchFormControl
            control={editPartControl}
            name='active'
            label='Peça ativa'
            description='Desativar some a peça das listas, sem apagar o histórico que já usa ela.'
          />

          <div className='mt-6'>
            <Button type='submit' disabled={isLoadingEditPart}>
              {isLoadingEditPart ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ===== MODAL: CADASTRAR SERVIÇO ===== */}
      <Dialog
        open={isCreateServiceModalOpen}
        onOpenChange={setIsCreateServiceModalOpen}
        title='Novo serviço'
        description='Cadastro no catálogo da oficina.'
      >
        <form
          onSubmit={handleCreateServiceSubmit(handleCreateService)}
          noValidate
        >
          <InputFormControl
            control={createServiceControl}
            name='name'
            label='Nome'
            placeholder='Troca de óleo'
          />

          <InputFormControl
            control={createServiceControl}
            name='description'
            label='Descrição (opcional)'
            placeholder='Óleo + filtro, revisão básica'
          />

          <SelectPickerFormControl
            control={createServiceControl}
            name='maintenanceCategory'
            label='Categoria de manutenção'
            placeholder='Selecione'
            data={MAINTENANCE_CATEGORY_OPTIONS}
          />

          <InputFormControl
            control={createServiceControl}
            name='defaultPrice'
            label='Preço padrão (R$)'
            type='number'
            step='0.01'
            placeholder='0,00'
          />

          <div className='mt-6'>
            <Button type='submit' disabled={isLoadingCreateService}>
              {isLoadingCreateService ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ===== MODAL: EDITAR SERVIÇO ===== */}
      <Dialog
        open={editingService !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingService(null);
          }
        }}
        title='Editar serviço'
        description='Desativar preserva o histórico de OS que já usam este serviço.'
      >
        <form onSubmit={handleEditServiceSubmit(handleEditService)} noValidate>
          <InputFormControl
            control={editServiceControl}
            name='name'
            label='Nome'
            placeholder='Troca de óleo'
          />

          <InputFormControl
            control={editServiceControl}
            name='description'
            label='Descrição (opcional)'
            placeholder='Óleo + filtro, revisão básica'
          />

          <SelectPickerFormControl
            control={editServiceControl}
            name='maintenanceCategory'
            label='Categoria de manutenção'
            placeholder='Selecione'
            data={MAINTENANCE_CATEGORY_OPTIONS}
          />

          <InputFormControl
            control={editServiceControl}
            name='defaultPrice'
            label='Preço padrão (R$)'
            type='number'
            step='0.01'
          />

          <SwitchFormControl
            control={editServiceControl}
            name='active'
            label='Serviço ativo'
            description='Desativar some o serviço da lista de itens disponíveis pra uma OS nova.'
          />

          <div className='mt-6'>
            <Button type='submit' disabled={isLoadingEditService}>
              {isLoadingEditService ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}

export const getServerSideProps = withSSRAuth(async () => {
  return {
    props: {},
  };
});
