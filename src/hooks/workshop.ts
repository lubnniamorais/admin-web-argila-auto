import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/apiClient';

// Espelha os schemas `Workshop` e `WorkshopSubscription` do openapi.yaml da
// API (GET /workshops/me) — mesma observação do IUser em auth.tsx: os campos
// vêm em snake_case de verdade na resposta HTTP, sem conversão nenhuma.
export interface IWorkshopSubscription {
  plan: 'BASIC' | 'PRO';
  trial_ends_at: string;
  renews_at: string | null;
  canceled_at: string | null;
  grace_period_ends_at: string | null;
  // Computado pela API (nunca gravado): true quando o trial do Basic já
  // venceu sem assinatura paga ativa. Nesse estado a API devolve 402 em
  // quase toda rota operacional — ver CLAUDE.md > "Referência rápida da API".
  blocked: boolean;
}

// Sempre presente no objeto (nunca null), mesmo quando a oficina não
// preencheu nenhum campo de endereço ainda — cada campo individual que
// vem null nesse caso (ver WorkshopPresenter.toHttp na API).
export interface IWorkshopAddress {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

export interface IWorkshop {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: IWorkshopAddress;
  logo_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  subscription: IWorkshopSubscription;
}

// Dados da oficina do usuário autenticado (nome, plano...), usados pela
// tenant box da sidebar do AppShell. Usa TanStack Query (já é a ferramenta
// de data-fetching do projeto) em vez de empilhar mais estado dentro do
// AuthContext, que hoje só cuida de autenticação.
export function useWorkshop() {
  return useQuery({
    queryKey: ['workshop', 'me'],
    queryFn: async (): Promise<IWorkshop> => {
      const response = await api.get('/workshops/me');

      return response.data.workshop;
    },
  });
}
