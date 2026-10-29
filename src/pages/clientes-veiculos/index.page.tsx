import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Head from 'next/head';
import { MagnifyingGlass, Pencil, Plus, UserPlus } from 'phosphor-react';
import { useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z as zod } from 'zod';

import { AppShell } from '@/components/AppShell';
import { Dialog } from '@/components/Dialog';
import { Button, buttonClassName } from '@/components/Form/Button';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { InputMaskFormControl } from '@/components/Form/InputMaskFormControl';
import { Pagination } from '@/components/Pagination';
import { ICustomer, ICustomerVehicle, useCustomers } from '@/hooks/customers';
import { api } from '@/lib/apiClient';
import { validateDocument } from '@/utils/validateDocument';
import { withSSRAuth } from '@/utils/withSSRAuth';

// ============ SCHEMA: CADASTRO COMBINADO (cliente + 1º veículo) ============
// Decisão confirmada com o usuário: o 1º cadastro do cliente já inclui o
// 1º veículo dele num formulário só (como o Signup faz com oficina+
// endereço); veículos adicionais entram depois pelo "+ Adicionar
// veículo" de cada linha. Document aceita CPF OU CNPJ (ver
// validateDocument.ts) — o InputMaskFormControl usa uma máscara
// dinâmica (ver componente) que já entrega só os dígitos.
const optionalEmail = zod
  .union([zod.literal(''), zod.string().trim().email('E-mail inválido')])
  .optional();

// Campo numérico opcional (ano do veículo): `zod.coerce.number()` sozinho
// transformaria um campo vazio ('') em 0 (Number('') === 0 em JS), o que
// pareceria um ano "preenchido" por engano — mesmo cuidado já registrado
// no CLAUDE.md pra `.refine().optional()` com string vazia, só que aqui
// pro lado numérico: primeiro troca '' por `undefined` (preprocess),
// SÓ DEPOIS deixa o coerce converter o que sobrou pra número.
const optionalCoercedNumber = zod.preprocess(
  (value) => (value === '' ? undefined : value),
  zod.coerce.number().int().optional()
);

const createCustomerWithVehicleFormSchema = zod.object({
  // Cliente
  customerName: zod.string().trim().min(1, 'Informe o nome do cliente'),
  customerDocument: zod
    .string()
    .trim()
    .min(1, 'Informe o CPF ou CNPJ')
    .refine((value) => validateDocument(value), 'CPF ou CNPJ inválido'),
  customerPhone: zod.string().trim().min(1, 'Informe o telefone'),
  customerEmail: optionalEmail,
  customerAddress: zod.string().trim().optional(),

  // Veículo (1º do cliente)
  vehiclePlate: zod.string().trim().min(1, 'Informe a placa'),
  vehicleBrand: zod.string().trim().min(1, 'Informe a marca'),
  vehicleModel: zod.string().trim().min(1, 'Informe o modelo'),
  vehicleYear: optionalCoercedNumber,
  vehicleColor: zod.string().trim().optional(),
  vehicleChassisNumber: zod.string().trim().optional(),
  // Tem valor padrão '0' no formulário (ver defaultValues) — nunca
  // chega vazio de verdade, então não precisa do mesmo tratamento de
  // optionalCoercedNumber acima.
  vehicleCurrentMileage: zod.coerce
    .number({ invalid_type_error: 'Informe a quilometragem' })
    .min(0, 'Quilometragem não pode ser negativa'),
});

type ICreateCustomerWithVehicleFormData = zod.infer<
  typeof createCustomerWithVehicleFormSchema
>;

// Usado só pra diferenciar, no onError da mutation, se o cliente já
// tinha sido criado quando o veículo falhou — ver mutationFn abaixo.
class VehicleCreationFailedError extends Error {
  customerName: string;

  constructor(customerName: string) {
    super('vehicle-creation-failed');
    this.customerName = customerName;
  }
}
// ============ FIM SCHEMA: CADASTRO COMBINADO ============

// ============ SCHEMA: EDITAR CLIENTE ============
// Mesmas regras do bloco "Cliente" do cadastro combinado, exceto
// `document` — PUT /customers não aceita editar documento (campo
// âncora, mesma lógica de CNPJ da oficina em Configurações), por isso
// nem entra neste schema.
const editCustomerFormSchema = zod.object({
  name: zod.string().trim().min(1, 'Informe o nome do cliente'),
  phone: zod.string().trim().min(1, 'Informe o telefone'),
  email: optionalEmail,
  address: zod.string().trim().optional(),
});

type IEditCustomerFormData = zod.infer<typeof editCustomerFormSchema>;
// ============ FIM SCHEMA: EDITAR CLIENTE ============

// ============ SCHEMA: ADICIONAR/EDITAR VEÍCULO ============
// Um schema só pra adicionar um veículo novo a um cliente já existente
// E pra editar um veículo já cadastrado — os campos são os mesmos (o
// que muda é só o `customerId`, que no cadastro vem do cliente da linha
// clicada, e na edição vem do próprio veículo sendo editado, ver
// `vehicleModal` no componente). `plate` continua no schema nos dois
// modos (precisa mostrar o valor), mas só entra de verdade no corpo da
// requisição no modo de cadastro — PUT /vehicles não aceita editar
// placa (campo âncora).
const vehicleFormSchema = zod.object({
  plate: zod.string().trim().min(1, 'Informe a placa'),
  brand: zod.string().trim().min(1, 'Informe a marca'),
  model: zod.string().trim().min(1, 'Informe o modelo'),
  year: optionalCoercedNumber,
  color: zod.string().trim().optional(),
  chassisNumber: zod.string().trim().optional(),
  currentMileage: zod.coerce
    .number({ invalid_type_error: 'Informe a quilometragem' })
    .min(0, 'Quilometragem não pode ser negativa'),
});

type IVehicleFormData = zod.infer<typeof vehicleFormSchema>;

// `null` = modal fechado. 'create' = adicionando um veículo novo a um
// cliente que já existe (customerId/customerName vêm da linha
// clicada). 'edit' = editando um veículo já cadastrado — guarda o
// veículo INTEIRO (não só o id): desde que a API passou a embutir o
// Vehicle completo em Customer.vehicles (incl. color/chassisNumber), a
// linha clicada já tem tudo que o form precisa, sem chamada extra
// nenhuma.
type IVehicleModalState =
  | { mode: 'create'; customerId: string; customerName: string }
  | { mode: 'edit'; vehicle: ICustomerVehicle; customerName: string };
// ============ FIM SCHEMA: ADICIONAR/EDITAR VEÍCULO ============

// Mesmo valor usado como perPage em todos os outros `GET` paginados do
// admin (ver dashboard.ts, useRecentServiceOrders) — também é o default
// do próprio backend quando `perPage` não é informado (ver CLAUDE.md da
// API, "ACTIVE_PAGE_PER_PAGE_PARAM_DEFAULT").
const PER_PAGE = 10;

// Tempo de espera depois da última tecla digitada na busca antes de
// disparar a chamada à API — sem isso, cada letra digitada vira uma
// requisição nova. 400ms é o valor comum pra esse tipo de campo (rápido
// o suficiente pra parecer instantâneo, devagar o suficiente pra não
// sobrecarregar a API enquanto a pessoa ainda está digitando).
const SEARCH_DEBOUNCE_MS = 400;

// "12345678900" (11 dígitos, CPF) -> "123.456.789-00"
// "12345678000190" (14 dígitos, CNPJ) -> "12.345.678/0001-90"
// Documento vem sempre só-dígitos da API (ver validateDocument.ts/mask
// dinâmica no formulário, que manda unmasked pro backend) — formatação é
// só cosmética, pra exibição na tabela.
function formatDocument(document: string): string {
  const cleaned = document.replace(/[^\d]+/g, '');

  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  if (cleaned.length === 14) {
    return cleaned.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5'
    );
  }

  // Documento com tamanho inesperado (não deveria acontecer, já que o
  // cadastro valida CPF/CNPJ antes de salvar) — mostra como veio, sem
  // quebrar a tela.
  return document;
}

// "(21) 98877-1234" a partir de "21988771234" — mesmo racional de
// formatDocument acima, cosmético pra exibição (o telefone já chega
// só-dígitos da API, igual ao document).
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[^\d]+/g, '');

  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  return phone;
}

// ============ LISTA DE VEÍCULOS DO CLIENTE ============
// Compartilhado entre a tabela (telas largas) e os cards (telas
// estreitas, ver "CARDS (TELAS ESTREITAS)" mais abaixo) — mesmo bloco
// visual nos dois lugares, só muda o container em volta. Recebe
// callbacks em vez de mexer direto no estado da página (setVehicleModal
// etc.), pra não precisar virar parte do componente principal.
interface ICustomerVehiclesListProps {
  customer: ICustomer;
  onEditVehicle: (vehicle: ICustomerVehicle) => void;
  onAddVehicle: () => void;
}

function CustomerVehiclesList({
  customer,
  onEditVehicle,
  onAddVehicle,
}: ICustomerVehiclesListProps) {
  return (
    <div>
      {customer.vehicles.length === 0 ? (
        <span className='text-text-muted'>Nenhum veículo</span>
      ) : (
        <div className='flex flex-col gap-1'>
          {customer.vehicles.map((vehicle) => (
            <div key={vehicle.id} className='flex items-center gap-1.5'>
              <span className='rounded-[4px] border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]'>
                {vehicle.plate}
              </span>
              <span>
                {vehicle.brand} {vehicle.model} ·{' '}
                {vehicle.current_mileage.toLocaleString('pt-BR')} km
              </span>
              <button
                type='button'
                onClick={() => onEditVehicle(vehicle)}
                aria-label={`Editar ${vehicle.plate}`}
                className='text-text-muted transition-colors hover:text-clay'
              >
                <Pencil size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type='button'
        onClick={onAddVehicle}
        className='mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-clay hover:underline'
      >
        <Plus size={13} />
        Adicionar veículo
      </button>
    </div>
  );
}
// ============ FIM LISTA DE VEÍCULOS DO CLIENTE ============

export default function ClientesVeiculosPage() {
  const queryClient = useQueryClient();

  // FUNCTIONS
  const [page, setPage] = useState(1);

  // Dois estados separados pra busca: `searchInput` reflete cada tecla
  // digitada (o campo precisa responder na hora), `searchParam` só muda
  // depois do debounce e é o que de fato entra na queryKey/chamada à
  // API — ver useEffect abaixo.
  const [searchInput, setSearchInput] = useState('');
  const [searchParam, setSearchParam] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchParam(searchInput);
      // Toda busca nova volta pra página 1 — continuar na página 3 de
      // uma busca diferente poderia mostrar uma página vazia mesmo
      // havendo resultado (ex: a busca nova só tem 1 página).
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  const { data, isLoading } = useCustomers({
    page,
    perPage: PER_PAGE,
    searchParam,
  });
  // END FUNCTIONS

  // ============ MODAL: CADASTRO COMBINADO (cliente + 1º veículo) ============
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
  } = useForm<ICreateCustomerWithVehicleFormData>({
    resolver: zodResolver(createCustomerWithVehicleFormSchema),
    defaultValues: {
      customerName: '',
      customerDocument: '',
      customerPhone: '',
      customerEmail: '',
      customerAddress: '',
      vehiclePlate: '',
      vehicleBrand: '',
      vehicleModel: '',
      vehicleYear: undefined,
      vehicleColor: '',
      vehicleChassisNumber: '',
      vehicleCurrentMileage: '0' as unknown as number,
    },
  });

  // MUTATION CREATE CUSTOMER WITH VEHICLE
  const {
    mutateAsync: createCustomerWithVehicleMutate,
    isPending: isLoadingCreate,
  } = useMutation({
    // Encadeada de propósito (POST /customers, depois POST /vehicles com
    // o customerId que voltou) — a API não tem um endpoint combinado pra
    // isso (ver decisão registrada no CLAUDE.md da API, "Veículos
    // embutidos em Customer").
    mutationFn: async ({
      customerName,
      customerDocument,
      customerPhone,
      customerEmail,
      customerAddress,
      vehiclePlate,
      vehicleBrand,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      vehicleChassisNumber,
      vehicleCurrentMileage,
    }: ICreateCustomerWithVehicleFormData) => {
      const customerResponse = await api.post('/customers', {
        name: customerName,
        document: customerDocument,
        phone: customerPhone,
        email: customerEmail || null,
        address: customerAddress || null,
      });

      const customerId = customerResponse.data.customer.id as string;

      // Placas brasileiras são sempre maiúsculas — normaliza aqui (a
      // API não faz isso sozinha), em vez de confiar que a pessoa vai
      // digitar maiúsculo.
      try {
        await api.post('/vehicles', {
          plate: vehiclePlate.toUpperCase(),
          brand: vehicleBrand,
          model: vehicleModel,
          year: vehicleYear ?? null,
          color: vehicleColor || null,
          chassisNumber: vehicleChassisNumber || null,
          customerId,
          currentMileage: vehicleCurrentMileage,
        });
      } catch {
        // Cliente já existe nesse ponto — sinaliza isso pro onError
        // tratar diferente de uma falha "nada foi salvo".
        throw new VehicleCreationFailedError(customerName);
      }
    },
    onSuccess: () => {
      toast.success('Cliente e veículo cadastrados.', {
        position: 'bottom-center',
        autoClose: 4000,
      });

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
    onError: (error) => {
      if (error instanceof VehicleCreationFailedError) {
        toast.error(
          `${error.customerName} foi cadastrado, mas o veículo não pôde ser salvo — use "Adicionar veículo" na linha dele pra tentar de novo.`,
          { position: 'bottom-center', autoClose: 7000 }
        );

        // O cliente foi criado de verdade — a lista precisa refletir
        // isso mesmo o veículo tendo falhado.
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        setIsCreateModalOpen(false);
        resetCreateForm();
        return;
      }

      toast.error(
        'Não foi possível cadastrar o cliente — confira os dados e tente de novo.',
        { position: 'bottom-center', autoClose: 5000 }
      );
    },
  });
  // END MUTATION CREATE CUSTOMER WITH VEHICLE

  const handleCreateCustomerWithVehicle: SubmitHandler<
    ICreateCustomerWithVehicleFormData
  > = async (formData) => {
    try {
      await createCustomerWithVehicleMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM MODAL: CADASTRO COMBINADO ============

  // ============ MODAL: EDITAR CLIENTE ============
  // `null` = modal fechado; um ICustomer = modal aberto, editando ESSE
  // cliente. Guardar o cliente inteiro (não só um id) evita precisar
  // procurar ele nos dados já carregados quando o form precisa ser
  // preenchido — e dá pra mostrar o documento (somente leitura) sem
  // chamada nenhuma extra.
  const [editingCustomer, setEditingCustomer] = useState<ICustomer | null>(
    null
  );

  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
  } = useForm<IEditCustomerFormData>({
    resolver: zodResolver(editCustomerFormSchema),
    defaultValues: { name: '', phone: '', email: '', address: '' },
  });

  // Preenche o formulário assim que um cliente é escolhido pra editar
  // (reset() troca os valores E limpa erros/estado "dirty" de uma
  // edição anterior — mesmo padrão de Configurações pro form da
  // oficina).
  useEffect(() => {
    if (!editingCustomer) {
      return;
    }

    resetEditForm({
      name: editingCustomer.name,
      phone: editingCustomer.phone,
      email: editingCustomer.email ?? '',
      address: editingCustomer.address ?? '',
    });
  }, [editingCustomer, resetEditForm]);

  // MUTATION UPDATE CUSTOMER
  const { mutateAsync: updateCustomerMutate, isPending: isLoadingEdit } =
    useMutation({
      mutationFn: async ({
        name,
        phone,
        email,
        address,
      }: IEditCustomerFormData) => {
        if (!editingCustomer) {
          return;
        }

        await api.put('/customers', {
          id: editingCustomer.id,
          name,
          phone,
          email: email || null,
          address: address || null,
        });
      },
      onSuccess: () => {
        toast.success('Cliente atualizado.', {
          position: 'bottom-center',
          autoClose: 4000,
        });

        queryClient.invalidateQueries({ queryKey: ['customers'] });
        setEditingCustomer(null);
      },
      onError: () => {
        toast.error('Não foi possível salvar as alterações do cliente.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });
  // END MUTATION UPDATE CUSTOMER

  const handleEditCustomer: SubmitHandler<IEditCustomerFormData> = async (
    formData
  ) => {
    try {
      await updateCustomerMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM MODAL: EDITAR CLIENTE ============

  // ============ MODAL: ADICIONAR/EDITAR VEÍCULO ============
  const [vehicleModal, setVehicleModal] = useState<IVehicleModalState | null>(
    null
  );

  const {
    control: vehicleControl,
    handleSubmit: handleVehicleSubmit,
    reset: resetVehicleForm,
  } = useForm<IVehicleFormData>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      plate: '',
      brand: '',
      model: '',
      year: undefined,
      color: '',
      chassisNumber: '',
      currentMileage: 0,
    },
  });

  // Modo 'create': limpa o form assim que o modal abre. Modo 'edit':
  // preenche direto com o veículo que já veio na linha clicada
  // (vehicleModal.vehicle) — nenhuma chamada à API precisa terminar
  // antes, diferente da primeira versão disso (ver histórico).
  useEffect(() => {
    if (!vehicleModal) {
      return;
    }

    if (vehicleModal.mode === 'create') {
      resetVehicleForm({
        plate: '',
        brand: '',
        model: '',
        year: undefined,
        color: '',
        chassisNumber: '',
        currentMileage: 0,
      });
      return;
    }

    const { vehicle } = vehicleModal;

    resetVehicleForm({
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year ?? undefined,
      color: vehicle.color ?? '',
      chassisNumber: vehicle.chassis_number ?? '',
      currentMileage: vehicle.current_mileage,
    });
  }, [vehicleModal, resetVehicleForm]);

  // MUTATION SAVE VEHICLE (cadastro OU edição, conforme vehicleModal.mode)
  const { mutateAsync: saveVehicleMutate, isPending: isLoadingSaveVehicle } =
    useMutation({
      mutationFn: async ({
        plate,
        brand,
        model,
        year,
        color,
        chassisNumber,
        currentMileage,
      }: IVehicleFormData) => {
        if (!vehicleModal) {
          return;
        }

        if (vehicleModal.mode === 'create') {
          await api.post('/vehicles', {
            // Placas brasileiras são sempre maiúsculas — mesma
            // normalização do cadastro combinado.
            plate: plate.toUpperCase(),
            brand,
            model,
            year: year ?? null,
            color: color || null,
            chassisNumber: chassisNumber || null,
            customerId: vehicleModal.customerId,
            currentMileage,
          });
          return;
        }

        // mode === 'edit' — precisa do customerId ATUAL do veículo
        // (PUT /vehicles exige esse campo mesmo sem trocar de cliente,
        // ver openapi.yaml) — vem de vehicleModal.vehicle, não do form
        // (plate/customerId não são editáveis aqui, só exibidos).
        await api.put('/vehicles', {
          id: vehicleModal.vehicle.id,
          brand,
          model,
          year: year ?? null,
          color: color || null,
          chassisNumber: chassisNumber || null,
          customerId: vehicleModal.vehicle.customer_id,
          currentMileage,
        });
      },
      onSuccess: () => {
        toast.success(
          vehicleModal?.mode === 'create'
            ? 'Veículo cadastrado.'
            : 'Veículo atualizado.',
          { position: 'bottom-center', autoClose: 4000 }
        );

        queryClient.invalidateQueries({ queryKey: ['customers'] });
        setVehicleModal(null);
      },
      onError: () => {
        toast.error(
          'Não foi possível salvar o veículo — confira os dados e tente de novo.',
          { position: 'bottom-center', autoClose: 5000 }
        );
      },
    });
  // END MUTATION SAVE VEHICLE

  const handleSaveVehicle: SubmitHandler<IVehicleFormData> = async (
    formData
  ) => {
    try {
      await saveVehicleMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM MODAL: ADICIONAR/EDITAR VEÍCULO ============

  // Vazio "de verdade" (nunca cadastrou ninguém) é diferente de "essa
  // busca não encontrou nada" — só mostra o estado vazio ilustrado
  // (com CTA de cadastro) no primeiro caso; o segundo mostra uma
  // mensagem simples dentro da própria tabela.
  const isTrulyEmpty =
    !isLoading && data?.totalCount === 0 && searchParam === '';

  return (
    <AppShell
      title='Clientes & Veículos'
      subtitle='Cadastro de clientes e veículos vinculados'
    >
      <Head>
        <title>Clientes & Veículos | ArgilaAuto</title>
      </Head>

      {isTrulyEmpty ? (
        <div className='rounded-[10px] border border-border bg-surface p-10 text-center shadow-[0_1px_2px_rgba(43,36,32,0.06),0_8px_24px_-12px_rgba(43,36,32,0.14)]'>
          <h3 className='font-display text-lg font-bold'>
            Nenhum cliente cadastrado
          </h3>
          <p className='mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-text-muted'>
            Cadastre o primeiro cliente da sua oficina pra começar a criar
            ordens de serviço.
          </p>
          <button
            type='button'
            onClick={() => setIsCreateModalOpen(true)}
            className={`mt-5 inline-flex ${buttonClassName('primary', 'w-auto px-5')}`}
          >
            <span className='inline-flex items-center gap-2'>
              <UserPlus size={18} />
              Cadastrar cliente
            </span>
          </button>
        </div>
      ) : (
        <div className='rounded-[10px] border border-border bg-surface p-5'>
          {/* ===== BUSCA + CADASTRAR ===== */}
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='relative w-full sm:max-w-xs'>
              <MagnifyingGlass
                size={16}
                className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted'
              />
              <input
                type='text'
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder='Buscar por nome, documento...'
                className='w-full rounded-[9px] border border-border-strong bg-background py-2.5 pr-3.5 pl-9 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1'
              />
            </div>

            <button
              type='button'
              onClick={() => setIsCreateModalOpen(true)}
              className={buttonClassName('primary', 'w-auto px-5')}
            >
              <span className='inline-flex items-center gap-2'>
                <UserPlus size={18} />
                Cadastrar cliente
              </span>
            </button>
          </div>

          {!data || data.customers.length === 0 ? (
            // Estado "sem resultado" (lista vazia ou ainda carregando) —
            // cobre os dois layouts abaixo de uma vez, não precisa
            // duplicar essa mensagem na tabela E nos cards.
            <p className='mt-5 py-6 text-center text-text-muted'>
              {isLoading
                ? 'Carregando...'
                : 'Nenhum cliente encontrado pra essa busca.'}
            </p>
          ) : (
            <>
              {/* ===== TABELA (telas largas) =====
                  Mesmo breakpoint (880px) em que a sidebar colapsa pra
                  só ícones (ver AppShell/Menubar) — abaixo disso, mesmo
                  com a sidebar enxuta, 5 colunas não cabem sem rolagem
                  horizontal, daí os cards ao lado assumirem. Precisa
                  aparecer como classe literal (max-[880px]:...) pro
                  Tailwind conseguir gerar o CSS — ver CLAUDE.md,
                  pegadinha #1. */}
              <div className='mt-5 max-[880px]:hidden overflow-x-auto'>
                <table className='w-full border-collapse text-[13.5px]'>
                  <thead>
                    <tr className='border-b border-border text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                      <th className='pb-2 pr-3'>Cliente</th>
                      <th className='pb-2 pr-3'>Documento</th>
                      <th className='pb-2 pr-3'>Telefone</th>
                      <th className='pb-2 pr-3'>Veículos</th>
                      <th className='pb-2'>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.map((customer: ICustomer) => (
                      <tr
                        key={customer.id}
                        className='border-b border-border last:border-0 align-top'
                      >
                        <td className='py-2.5 pr-3 font-semibold'>
                          {customer.name}
                        </td>
                        <td className='py-2.5 pr-3 font-mono text-text-muted'>
                          {formatDocument(customer.document)}
                        </td>
                        <td className='py-2.5 pr-3 font-mono'>
                          {formatPhone(customer.phone)}
                        </td>
                        <td className='py-2.5 pr-3'>
                          <CustomerVehiclesList
                            customer={customer}
                            onEditVehicle={(vehicle) =>
                              setVehicleModal({
                                mode: 'edit',
                                vehicle,
                                customerName: customer.name,
                              })
                            }
                            onAddVehicle={() =>
                              setVehicleModal({
                                mode: 'create',
                                customerId: customer.id,
                                customerName: customer.name,
                              })
                            }
                          />
                        </td>
                        <td className='py-2.5'>
                          <button
                            type='button'
                            onClick={() => setEditingCustomer(customer)}
                            aria-label={`Editar ${customer.name}`}
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

              {/* ===== CARDS (telas estreitas) =====
                  Um card por cliente, mesmo conteúdo da tabela só que
                  empilhado — nada de rolagem lateral. `hidden` é o
                  estado padrão (telas largas usam a tabela acima); só
                  liga abaixo de 880px. */}
              <div className='mt-5 hidden max-[880px]:flex flex-col gap-3'>
                {data.customers.map((customer: ICustomer) => (
                  <div
                    key={customer.id}
                    className='rounded-[10px] border border-border p-4'
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div className='min-w-0'>
                        <p className='font-semibold'>{customer.name}</p>
                        <p className='mt-0.5 font-mono text-[12.5px] text-text-muted'>
                          {formatDocument(customer.document)}
                        </p>
                        <p className='font-mono text-[12.5px]'>
                          {formatPhone(customer.phone)}
                        </p>
                      </div>
                      <button
                        type='button'
                        onClick={() => setEditingCustomer(customer)}
                        aria-label={`Editar ${customer.name}`}
                        className='shrink-0 text-text-muted transition-colors hover:text-clay'
                      >
                        <Pencil size={15} />
                      </button>
                    </div>

                    <div className='mt-3 border-t border-border pt-3'>
                      <p className='mb-1 text-[11px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                        Veículos
                      </p>
                      <CustomerVehiclesList
                        customer={customer}
                        onEditVehicle={(vehicle) =>
                          setVehicleModal({
                            mode: 'edit',
                            vehicle,
                            customerName: customer.name,
                          })
                        }
                        onAddVehicle={() =>
                          setVehicleModal({
                            mode: 'create',
                            customerId: customer.id,
                            customerName: customer.name,
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ===== PAGINAÇÃO ===== */}
          {data && data.totalCount > 0 && (
            <Pagination
              pageCurrent={page}
              totalCount={data.totalCount}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* ===== MODAL: CADASTRO COMBINADO (cliente + 1º veículo) ===== */}
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          setIsCreateModalOpen(open);

          // Fechou sem salvar (Esc, clique fora, botão X) — limpa o
          // formulário, pra não reabrir com lixo de uma tentativa
          // anterior da próxima vez.
          if (!open) {
            resetCreateForm();
          }
        }}
        title='Cadastrar cliente'
        description='Dados do cliente e do primeiro veículo dele. Dá pra adicionar mais veículos depois, pela linha do cliente.'
      >
        <form
          onSubmit={handleCreateSubmit(handleCreateCustomerWithVehicle)}
          noValidate
        >
          <p className='mb-1 text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
            Dados do cliente
          </p>

          <InputFormControl
            control={createControl}
            name='customerName'
            label='Nome'
            placeholder='Ex: Ricardo Almeida'
          />

          <InputMaskFormControl
            control={createControl}
            name='customerDocument'
            label='CPF ou CNPJ'
            // Array de máscaras candidatas — o IMask escolhe sozinho CPF
            // (11 dígitos) ou CNPJ (14) conforme a quantidade digitada
            // (ver comentário em InputMask/index.tsx).
            mask={[{ mask: '000.000.000-00' }, { mask: '00.000.000/0000-00' }]}
            placeholder='000.000.000-00'
          />

          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputMaskFormControl
                control={createControl}
                name='customerPhone'
                label='Telefone'
                mask='(00) 00000-0000'
                placeholder='(11) 99999-9999'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={createControl}
                name='customerEmail'
                label='E-mail (opcional)'
                type='email'
                placeholder='cliente@email.com'
              />
            </div>
          </div>

          <InputFormControl
            control={createControl}
            name='customerAddress'
            label='Endereço (opcional)'
            placeholder='Rua, número, bairro...'
          />

          <p className='mt-6 mb-1 text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
            Dados do 1º veículo
          </p>

          <div className='flex gap-3'>
            <div className='flex-2'>
              <InputFormControl
                control={createControl}
                name='vehiclePlate'
                label='Placa'
                placeholder='ABC1D23'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={createControl}
                name='vehicleYear'
                label='Ano (opcional)'
                type='number'
                placeholder='2020'
              />
            </div>
          </div>

          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputFormControl
                control={createControl}
                name='vehicleBrand'
                label='Marca'
                placeholder='Honda'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={createControl}
                name='vehicleModel'
                label='Modelo'
                placeholder='Civic'
              />
            </div>
          </div>

          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputFormControl
                control={createControl}
                name='vehicleColor'
                label='Cor (opcional)'
                placeholder='Prata'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={createControl}
                name='vehicleChassisNumber'
                label='Chassi (opcional)'
                placeholder='9BWZZZ...'
              />
            </div>
          </div>

          <InputFormControl
            control={createControl}
            name='vehicleCurrentMileage'
            label='Quilometragem atual'
            type='number'
            placeholder='0'
          />

          <div className='mt-6'>
            <Button type='submit' disabled={isLoadingCreate}>
              {isLoadingCreate ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ===== MODAL: EDITAR CLIENTE ===== */}
      <Dialog
        open={editingCustomer !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCustomer(null);
          }
        }}
        title='Editar cliente'
        description='Documento não é editável depois do cadastro.'
      >
        <form onSubmit={handleEditSubmit(handleEditCustomer)} noValidate>
          <div className='mt-4'>
            <label
              htmlFor='edit-customer-document'
              className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
            >
              CPF ou CNPJ
            </label>
            <input
              id='edit-customer-document'
              value={
                editingCustomer ? formatDocument(editingCustomer.document) : ''
              }
              disabled
              className='w-full rounded-[9px] border border-border-strong bg-surface-2 px-3.5 py-2.5 text-sm text-text-muted outline-none'
            />
          </div>

          <InputFormControl
            control={editControl}
            name='name'
            label='Nome'
            placeholder='Ex: Ricardo Almeida'
          />

          <InputMaskFormControl
            control={editControl}
            name='phone'
            label='Telefone'
            mask='(00) 00000-0000'
            placeholder='(11) 99999-9999'
          />

          <InputFormControl
            control={editControl}
            name='email'
            label='E-mail (opcional)'
            type='email'
            placeholder='cliente@email.com'
          />

          <InputFormControl
            control={editControl}
            name='address'
            label='Endereço (opcional)'
            placeholder='Rua, número, bairro...'
          />

          <div className='mt-6'>
            <Button type='submit' disabled={isLoadingEdit}>
              {isLoadingEdit ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ===== MODAL: ADICIONAR/EDITAR VEÍCULO ===== */}
      <Dialog
        open={vehicleModal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setVehicleModal(null);
          }
        }}
        title={
          vehicleModal?.mode === 'create'
            ? 'Adicionar veículo'
            : 'Editar veículo'
        }
        description={
          vehicleModal ? `Veículo de ${vehicleModal.customerName}.` : ''
        }
      >
        <form onSubmit={handleVehicleSubmit(handleSaveVehicle)} noValidate>
          <div className='flex gap-3'>
            <div className='flex-2'>
              <InputFormControl
                control={vehicleControl}
                name='plate'
                label='Placa'
                placeholder='ABC1D23'
                // Só editável no cadastro — PUT /vehicles não aceita
                // mudar a placa (campo âncora, ver schema vehicleFormSchema).
                disabled={vehicleModal?.mode === 'edit'}
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={vehicleControl}
                name='year'
                label='Ano (opcional)'
                type='number'
                placeholder='2020'
              />
            </div>
          </div>

          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputFormControl
                control={vehicleControl}
                name='brand'
                label='Marca'
                placeholder='Honda'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={vehicleControl}
                name='model'
                label='Modelo'
                placeholder='Civic'
              />
            </div>
          </div>

          <div className='flex gap-3'>
            <div className='flex-1'>
              <InputFormControl
                control={vehicleControl}
                name='color'
                label='Cor (opcional)'
                placeholder='Prata'
              />
            </div>
            <div className='flex-1'>
              <InputFormControl
                control={vehicleControl}
                name='chassisNumber'
                label='Chassi (opcional)'
                placeholder='9BWZZZ...'
              />
            </div>
          </div>

          <InputFormControl
            control={vehicleControl}
            name='currentMileage'
            label='Quilometragem atual'
            type='number'
            placeholder='0'
          />

          <div className='mt-6'>
            <Button type='submit' disabled={isLoadingSaveVehicle}>
              {isLoadingSaveVehicle ? 'Salvando...' : 'Salvar'}
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
