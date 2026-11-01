import { zodResolver } from '@hookform/resolvers/zod';
import * as RadixTabs from '@radix-ui/react-tabs';
import { format } from '@formkit/tempo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Head from 'next/head';
import { MagnifyingGlass, Package, Pencil, Plus } from 'phosphor-react';
import { useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
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
import {
  STOCK_MOVEMENT_TYPE_LABEL,
  useStockMovements,
} from '@/hooks/stockMovements';
import { api } from '@/lib/apiClient';
import { MAINTENANCE_CATEGORY_OPTIONS } from '@/utils/maintenanceCategory';
import { usePermissions } from '@/utils/permissions';
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

// Terceira variante: OBRIGATÓRIO, inteiro, e maior que zero — usado na
// quantidade do movimento de estoque, onde zero nunca é um valor válido
// (nem a API aceita `quantity=0` em `POST /parts/{id}/stock-movements`).
function requiredCoercedPositiveInt(message: string) {
  return zod.preprocess(
    (value) => (value === '' ? undefined : value),
    zod.coerce
      .number({ invalid_type_error: message, required_error: message })
      .int('Precisa ser um número inteiro')
      .positive('Quantidade precisa ser maior que zero')
  );
}

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

// ============ SCHEMA: MOVIMENTO DE ESTOQUE ============
// `POST /parts/{id}/stock-movements` só aceita `PURCHASE_IN` (sempre
// soma) e `MANUAL_ADJUSTMENT` (soma ou subtrai, nunca zero) — os outros
// dois valores do enum `StockMovementType` (`SERVICE_ORDER_OUT`/
// `SERVICE_ORDER_RETURN`) só nascem do sistema, nunca são aceitos aqui.
// `direction` não existe na API — é só um jeito mais claro de preencher
// o formulário (decisão confirmada com o usuário): a pessoa escolhe
// Entrada/Saída e digita uma quantidade sempre positiva, em vez de
// digitar um número negativo direto. Pra `type=PURCHASE_IN` a direção
// nem aparece no formulário (é sempre Entrada) — o valor de `direction`
// é ignorado nesse caso na hora de montar o payload (ver mutationFn).
const stockMovementFormSchema = zod.object({
  type: zod.enum(['PURCHASE_IN', 'MANUAL_ADJUSTMENT']),
  direction: zod.enum(['IN', 'OUT']),
  quantity: requiredCoercedPositiveInt('Informe a quantidade'),
  reason: zod.string().trim().optional(),
});

type IStockMovementFormData = zod.infer<typeof stockMovementFormSchema>;
// ============ FIM SCHEMA: MOVIMENTO DE ESTOQUE ============

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

// `tone` é opcional por opção (decisão confirmada com o usuário em
// 01/11/2026, pro seletor de Direção do movimento de estoque) — quando
// uma opção realmente significa "bom"/"ruim" (Entrada soma, Saída
// subtrai), fica mais fácil de ler com verde/vermelho em vez da cor
// neutra padrão (clay). O seletor de Tipo de movimento (Entrada por
// compra / Ajuste de inventário) não passa `tone` nenhum — nenhuma das
// duas opções é "boa" ou "ruim", só métodos diferentes.
const segmentButton = tv({
  base: 'flex-1 rounded-[8px] px-3 py-2 text-center text-[13.5px] font-semibold transition-colors',
  variants: {
    selected: {
      true: '',
      false: 'text-text-muted hover:bg-surface-2',
    },
    tone: {
      neutral: '',
      good: '',
      crit: '',
    },
  },
  compoundVariants: [
    { selected: true, tone: 'neutral', className: 'bg-clay text-white' },
    { selected: true, tone: 'good', className: 'bg-good text-white' },
    { selected: true, tone: 'crit', className: 'bg-crit text-white' },
  ],
  defaultVariants: {
    tone: 'neutral',
  },
});

// Controle de 2 opções usado 2x no formulário de movimento de estoque
// (tipo, e depois direção quando o tipo é ajuste) — par de botões
// simples em vez de puxar RadioGroup/Select pra uma escolha binária
// apresentacional, local a este form só.
function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
}: {
  options: {
    value: TValue;
    label: string;
    tone?: 'neutral' | 'good' | 'crit';
  }[];
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className='flex gap-1 rounded-[9px] border border-border-strong bg-surface-2 p-1'>
      {options.map((option) => (
        <button
          key={option.value}
          type='button'
          onClick={() => onChange(option.value)}
          className={segmentButton({
            selected: option.value === value,
            tone: option.tone ?? 'neutral',
          })}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function ProdutosPage() {
  const queryClient = useQueryClient();
  const { canManageCatalog } = usePermissions();

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

  // ============ MODAL: MOVIMENTO DE ESTOQUE ============
  // Guarda a peça inteira (igual `editingPart`) — o cabeçalho do modal
  // mostra nome/SKU/estoque atual sem nenhuma chamada extra.
  const [stockMovementPart, setStockMovementPart] = useState<IPart | null>(
    null
  );

  const {
    control: stockMovementControl,
    handleSubmit: handleStockMovementSubmit,
    reset: resetStockMovementForm,
    watch: watchStockMovementForm,
  } = useForm<IStockMovementFormData>({
    resolver: zodResolver(stockMovementFormSchema),
    defaultValues: {
      type: 'PURCHASE_IN',
      direction: 'IN',
      quantity: '' as unknown as number,
      reason: '',
    },
  });

  // Reseta o form (não fecha o modal) toda vez que ele é aberto pra uma
  // peça diferente — e também logo depois de registrar um movimento com
  // sucesso (ver onSuccess da mutation abaixo), pra deixar pronto pra
  // registrar o próximo sem fechar e reabrir.
  useEffect(() => {
    if (!stockMovementPart) {
      return;
    }

    resetStockMovementForm({
      type: 'PURCHASE_IN',
      direction: 'IN',
      quantity: '' as unknown as number,
      reason: '',
    });
  }, [stockMovementPart, resetStockMovementForm]);

  // `stockMovementPart` guarda a peça clicada no momento em que o modal
  // abriu — depois de registrar um movimento, a invalidação de ['parts']
  // (ver onSuccess da mutation abaixo) atualiza `partsData`, mas NÃO esse
  // state, que continua apontando pro objeto antigo (React não sabe que
  // os dois deveriam estar sincronizados). Bug real encontrado testando
  // no navegador: "Estoque atual" no cabeçalho do modal ficava parado no
  // valor de quando abriu, mesmo com o histórico abaixo já mostrando o
  // movimento novo. Corrigido lendo sempre a versão mais recente da
  // peça em `partsData.parts` (já atualizada pela invalidação), caindo
  // de volta pro snapshot só se ela ainda não estiver na lista
  // carregada.
  const currentStockMovementPart =
    partsData?.parts.find((part) => part.id === stockMovementPart?.id) ??
    stockMovementPart;

  // Observados pra: (1) esconder o seletor de direção quando o tipo é
  // "Entrada por compra" (sempre soma, não faz sentido perguntar); (2)
  // calcular o preview "estoque depois do movimento" ao vivo, antes de
  // confirmar.
  const stockMovementType = watchStockMovementForm('type');
  const stockMovementDirection = watchStockMovementForm('direction');
  const stockMovementQuantity = watchStockMovementForm('quantity');

  const stockMovementSignedQuantity =
    stockMovementType === 'MANUAL_ADJUSTMENT' &&
    stockMovementDirection === 'OUT'
      ? -Math.abs(Number(stockMovementQuantity) || 0)
      : Math.abs(Number(stockMovementQuantity) || 0);

  // Resultado do preview — a cor precisa refletir o que de fato importa
  // (ficaria negativo? ficaria abaixo do mínimo?), não a direção do
  // movimento. Bug real visto testando no navegador: uma saída válida
  // (ex.: 14 - 5 = 9, resultado são) aparecia em vermelho só por ser uma
  // subtração, confundindo com um erro de verdade.
  const stockMovementResultingQuantity =
    (currentStockMovementPart?.quantity ?? 0) + stockMovementSignedQuantity;

  const stockMovementResultColorClassName =
    stockMovementResultingQuantity < 0
      ? 'text-crit'
      : stockMovementResultingQuantity <=
          (currentStockMovementPart?.minimum_stock ?? 0)
        ? 'text-warn'
        : 'text-good';

  const { data: stockMovements, isLoading: isLoadingStockMovements } =
    useStockMovements(stockMovementPart?.id);

  // MUTATION CREATE STOCK MOVEMENT
  const {
    mutateAsync: createStockMovementMutate,
    isPending: isLoadingCreateStockMovement,
  } = useMutation({
    mutationFn: async ({
      type,
      direction,
      quantity,
      reason,
    }: IStockMovementFormData) => {
      if (!stockMovementPart) {
        return;
      }

      // `direction` só existe no formulário (ver schema) — pra
      // `type=PURCHASE_IN` o valor de `direction` é ignorado aqui de
      // propósito, o sinal é sempre positivo.
      const signedQuantity =
        type === 'MANUAL_ADJUSTMENT' && direction === 'OUT'
          ? -quantity
          : quantity;

      await api.post(`/parts/${stockMovementPart.id}/stock-movements`, {
        type,
        quantity: signedQuantity,
        reason: reason || null,
      });
    },
    onSuccess: () => {
      toast.success('Movimento registrado.', {
        position: 'bottom-center',
        autoClose: 4000,
      });

      // Atualiza a lista de peças (estoque/destaque de estoque baixo) E
      // o histórico desta peça dentro do próprio modal — que continua
      // aberto de propósito, pra já mostrar o resultado na hora.
      queryClient.invalidateQueries({ queryKey: ['parts'] });

      resetStockMovementForm({
        type: 'PURCHASE_IN',
        direction: 'IN',
        quantity: '' as unknown as number,
        reason: '',
      });
    },
    // `onError` recebe `variables` (o que foi mandado pro `mutationFn`) —
    // usado aqui pra montar uma mensagem em PT-BR equivalente à da API
    // (que vem em inglês, ex.: "This adjustment would leave..."), em vez
    // de mostrar o texto cru dela pro usuário — mesmo padrão já usado
    // pro CNPJ duplicado em clientes-veiculos (nunca expor a mensagem
    // bruta da API, sempre um texto PT-BR nosso).
    onError: (error, variables) => {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        const signedQuantity =
          variables.type === 'MANUAL_ADJUSTMENT' &&
          variables.direction === 'OUT'
            ? -variables.quantity
            : variables.quantity;

        toast.error(
          `Esse movimento deixaria "${currentStockMovementPart?.name ?? 'a peça'}" com estoque negativo (atual: ${currentStockMovementPart?.quantity ?? 0}, variação: ${signedQuantity >= 0 ? '+' : ''}${signedQuantity}).`,
          { position: 'bottom-center', autoClose: 7000 }
        );
        return;
      }

      toast.error('Não foi possível registrar o movimento.', {
        position: 'bottom-center',
        autoClose: 6000,
      });
    },
  });
  // END MUTATION CREATE STOCK MOVEMENT

  const handleRegisterStockMovement: SubmitHandler<
    IStockMovementFormData
  > = async (formData) => {
    try {
      await createStockMovementMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM MODAL: MOVIMENTO DE ESTOQUE ============

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

              {canManageCatalog && (
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
              )}
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
                              {canManageCatalog && (
                                <div className='flex items-center gap-3'>
                                  <button
                                    type='button'
                                    onClick={() => setStockMovementPart(part)}
                                    aria-label={`Movimento de estoque de ${part.name}`}
                                    className='text-text-muted transition-colors hover:text-clay'
                                  >
                                    <Package size={15} />
                                  </button>
                                  <button
                                    type='button'
                                    onClick={() => setEditingPart(part)}
                                    aria-label={`Editar ${part.name}`}
                                    className='text-text-muted transition-colors hover:text-clay'
                                  >
                                    <Pencil size={15} />
                                  </button>
                                </div>
                              )}
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
                          {canManageCatalog && (
                            <div className='flex shrink-0 items-center gap-3'>
                              <button
                                type='button'
                                onClick={() => setStockMovementPart(part)}
                                aria-label={`Movimento de estoque de ${part.name}`}
                                className='text-text-muted transition-colors hover:text-clay'
                              >
                                <Package size={15} />
                              </button>
                              <button
                                type='button'
                                onClick={() => setEditingPart(part)}
                                aria-label={`Editar ${part.name}`}
                                className='text-text-muted transition-colors hover:text-clay'
                              >
                                <Pencil size={15} />
                              </button>
                            </div>
                          )}
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

              {canManageCatalog && (
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
              )}
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
                            {canManageCatalog && (
                              <button
                                type='button'
                                onClick={() => setEditingService(service)}
                                aria-label={`Editar ${service.name}`}
                                className='text-text-muted transition-colors hover:text-clay'
                              >
                                <Pencil size={15} />
                              </button>
                            )}
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
                        {canManageCatalog && (
                          <button
                            type='button'
                            onClick={() => setEditingService(service)}
                            aria-label={`Editar ${service.name}`}
                            className='shrink-0 text-text-muted transition-colors hover:text-clay'
                          >
                            <Pencil size={15} />
                          </button>
                        )}
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
                uppercase
              />
            </div>
            <div className='flex-2'>
              <InputFormControl
                control={createPartControl}
                name='oemCode'
                label='Código do fabricante (opcional)'
                placeholder='OEM123'
                uppercase
              />
            </div>
          </div>

          <InputFormControl
            control={createPartControl}
            name='name'
            label='Nome'
            placeholder='Filtro de óleo padrão'
            uppercase
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
                uppercase
              />
            </div>
          </div>

          <InputFormControl
            control={editPartControl}
            name='name'
            label='Nome'
            placeholder='Filtro de óleo padrão'
            uppercase
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

      {/* ===== MODAL: MOVIMENTO DE ESTOQUE =====
          Fica aberto depois de registrar com sucesso (ver onSuccess da
          mutation) — só o form limpa, não o modal — pra já mostrar o
          estoque atualizado e a entrada nova no histórico, em vez de
          fechar e precisar reabrir pra conferir. */}
      <Dialog
        open={stockMovementPart !== null}
        onOpenChange={(open) => {
          if (!open) {
            setStockMovementPart(null);
          }
        }}
        title='Movimento de estoque'
        description={
          currentStockMovementPart
            ? `${currentStockMovementPart.name} · SKU ${currentStockMovementPart.sku}`
            : ''
        }
      >
        <div className='rounded-[9px] border border-border-strong bg-surface-2 px-3.5 py-2.5 text-[13.5px]'>
          Estoque atual:{' '}
          <span className='font-mono font-bold'>
            {currentStockMovementPart?.quantity ?? 0}
          </span>
        </div>

        <form
          onSubmit={handleStockMovementSubmit(handleRegisterStockMovement)}
          noValidate
          className='mt-4'
        >
          {/* `fieldset`/`legend` em vez de `label` — um grupo de botões não
              é um "controle" único que um `label` possa apontar via
              `htmlFor` (regra de acessibilidade `noLabelWithoutControl`);
              semanticamente é exatamente o que `fieldset`/`legend`
              representam: um grupo de opções relacionadas. */}
          <fieldset className='border-0 p-0'>
            <legend className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
              Tipo de movimento
            </legend>
            <Controller
              control={stockMovementControl}
              name='type'
              render={({ field }) => (
                <SegmentedControl
                  options={[
                    { value: 'PURCHASE_IN', label: 'Entrada por compra' },
                    {
                      value: 'MANUAL_ADJUSTMENT',
                      label: 'Ajuste de inventário',
                    },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </fieldset>

          {/* Direção só faz sentido pro ajuste — a entrada por compra é
              sempre positiva, perguntar a direção ali seria redundante. */}
          {stockMovementType === 'MANUAL_ADJUSTMENT' && (
            <fieldset className='mt-4 border-0 p-0'>
              <legend className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                Direção
              </legend>
              <Controller
                control={stockMovementControl}
                name='direction'
                render={({ field }) => (
                  <SegmentedControl
                    options={[
                      { value: 'IN', label: 'Entrada (soma)', tone: 'good' },
                      { value: 'OUT', label: 'Saída (subtrai)', tone: 'crit' },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </fieldset>
          )}

          <InputFormControl
            control={stockMovementControl}
            name='quantity'
            label='Quantidade'
            type='number'
            min={1}
            step={1}
            placeholder='0'
          />

          <InputFormControl
            control={stockMovementControl}
            name='reason'
            label='Motivo (opcional)'
            placeholder='Ex: compra NF 12345, quebra no balcão...'
          />

          {!!Number(stockMovementQuantity) && (
            <p className='mt-3 text-[13px] text-text-muted'>
              Estoque após o movimento:{' '}
              <span
                className={`font-mono font-bold ${stockMovementResultColorClassName}`}
              >
                {stockMovementResultingQuantity}
              </span>
            </p>
          )}

          <div className='mt-4'>
            <Button type='submit' disabled={isLoadingCreateStockMovement}>
              {isLoadingCreateStockMovement
                ? 'Registrando...'
                : 'Registrar movimento'}
            </Button>
          </div>
        </form>

        <div className='mt-6 border-t border-border pt-4'>
          <p className='mb-2 text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
            Histórico
          </p>

          {isLoadingStockMovements ? (
            <p className='text-[13px] text-text-muted'>Carregando...</p>
          ) : !stockMovements || stockMovements.length === 0 ? (
            <p className='text-[13px] text-text-muted'>
              Nenhum movimento registrado ainda.
            </p>
          ) : (
            <ul className='flex flex-col gap-2.5'>
              {[...stockMovements]
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                )
                .map((movement) => (
                  <li
                    key={movement.id}
                    className='rounded-[9px] border border-border px-3 py-2 text-[12.5px]'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='font-semibold'>
                        {STOCK_MOVEMENT_TYPE_LABEL[movement.type]}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          movement.quantity >= 0 ? 'text-good' : 'text-crit'
                        }`}
                      >
                        {movement.quantity >= 0 ? '+' : ''}
                        {movement.quantity}
                      </span>
                    </div>
                    <div className='mt-1 flex items-center justify-between gap-2 text-text-muted'>
                      <span>{movement.reason ?? '—'}</span>
                      <span>
                        {format(
                          movement.created_at,
                          'DD/MM/YYYY HH:mm',
                          'pt-BR'
                        )}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
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
            uppercase
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
            uppercase
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
