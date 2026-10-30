import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/apiClient';

// Veículo COMPLETO, já resolvido dentro do Customer (ver api-argila-auto,
// commits "feat: embed resolved vehicles in Customer responses" e
// "refactor: return full vehicle record in Customer responses", 29/10) —
// GET /customers e GET /customers/:id devolvem isso numa query só por
// página, nunca N+1. É o mesmo schema Vehicle inteiro (não um resumo
// reduzido) — por isso a tela consegue editar um veículo (inclusive
// `color`/`chassis_number`) usando só o dado que já veio na lista, sem
// nenhuma chamada extra a GET /vehicles/:id.
export interface ICustomerVehicle {
  id: string;
  customer_id: string;
  // `null` só quando o veículo foi anonimizado junto da exclusão do
  // cliente dono (ver `ICustomer.active` abaixo) — na prática nunca
  // acontece nos veículos que a tela chega a mostrar, porque GET
  // /customers só lista clientes `active` por padrão, e um cliente
  // ativo nunca tem veículo anonimizado (ver api-argila-auto/CLAUDE.md,
  // "Exclusão de cliente"). O tipo permite `null` mesmo assim, por
  // fidelidade ao schema real.
  plate: string | null;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  chassis_number: string | null;
  current_mileage: number;
  active: boolean;
}

// Endereço estruturado do cliente — mesmo formato de IWorkshopAddress
// (ver hooks/workshop.ts), todos os campos opcionais. POST/PUT
// /customers continuam recebendo os campos flat (addressStreet,
// addressNumber...), só a resposta é que vem aninhada assim (ver
// api-argila-auto, commit "feat: turn Customer.address into a
// structured address", 29/10).
export interface ICustomerAddress {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

// Espelha o schema Customer do openapi.yaml (api-argila-auto) — campos
// em snake_case, sem conversão. `vehicles` só vem presente em GET
// /customers (lista) e GET /customers/:id (detalhe); POST/PUT não
// devolvem essa chave (ver CLAUDE.md da API).
export interface ICustomer {
  id: string;
  name: string;
  // `null` quando o cliente foi excluído mas tinha histórico de OS
  // (anonimizado em vez de apagado de verdade — ver `active` abaixo).
  // Na prática não aparece na listagem padrão (GET /customers só traz
  // `active:true` por padrão), mas o tipo reflete o schema real.
  document: string | null;
  email: string | null;
  phone: string | null;
  address: ICustomerAddress;
  // false = cliente excluído (DELETE /customers/:id) com histórico de
  // OS, por isso anonimizado em vez de apagado — some de GET /customers
  // por padrão, então na prática todo ICustomer que a tela carrega tem
  // active:true. Campo mantido no tipo por completude/fidelidade ao
  // schema.
  active: boolean;
  vehicles: ICustomerVehicle[];
  created_at: string;
  updated_at: string;
}

export interface IUseCustomersParams {
  page: number;
  perPage: number;
  // Texto livre — API busca por nome/documento/etc (ver GET /customers,
  // parâmetro `searchParam`).
  searchParam?: string;
}

export interface IUseCustomersResult {
  customers: ICustomer[];
  // Header x-total-count-registers — total de clientes da workshop que
  // batem o filtro atual (sem filtro = total geral), usado pela
  // Pagination pra calcular quantas páginas existem.
  totalCount: number;
}

// Lista de clientes (com veículos já aninhados) pra tela "Clientes &
// Veículos" — busca e paginação controladas pela própria página via
// `params`, que entra na queryKey pra cada combinação ter seu próprio
// cache (mesmo racional de useRecentServiceOrders em hooks/dashboard.ts).
export function useCustomers({
  page,
  perPage,
  searchParam,
}: IUseCustomersParams) {
  return useQuery({
    queryKey: ['customers', { page, perPage, searchParam }],
    queryFn: async (): Promise<IUseCustomersResult> => {
      const response = await api.get('/customers', {
        params: {
          page,
          perPage,
          // Query vazia manda `searchParam=''` pra API à toa — melhor
          // nem mandar o parâmetro quando não há busca nenhuma.
          searchParam: searchParam || undefined,
        },
      });

      return {
        customers: response.data.customers,
        totalCount: Number(response.headers['x-total-count-registers'] ?? 0),
      };
    },
    // Mantém a página anterior na tela enquanto a nova carrega, em vez
    // de piscar um estado vazio/loading a cada clique de paginação ou
    // letra digitada na busca — só a troca mais suave, não muda o dado
    // em si.
    placeholderData: keepPreviousData,
  });
}
