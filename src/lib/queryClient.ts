import { QueryClient } from '@tanstack/react-query';

// gcTime (antigo "cacheTime" nas versões anteriores do TanStack Query) é
// quanto tempo uma query fica guardada em memória depois de ficar sem
// nenhum componente observando ela (ex.: saiu da tela). O padrão da lib é
// só 5 minutos — curto demais pra persistência offline: se a pessoa
// visitar Produtos, saia, e passar mais de 5 minutos em outra tela antes
// de perder a conexão, o cache de Produtos já teria sido descartado da
// memória e nunca seria salvo no "snapshot" que vai pro IndexedDB (ver
// src/lib/persister.ts e o PersistQueryClientProvider em _app.page.tsx).
// Alinhado aqui com o maxAge da persistência (24h) por esse motivo.
const TWENTY_FOUR_HOURS_IN_MS = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: TWENTY_FOUR_HOURS_IN_MS,
    },
  },
});
