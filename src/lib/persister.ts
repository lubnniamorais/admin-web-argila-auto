import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

// idb-keyval dá só 3 funções (get/set/del) pra um IndexedDB de
// chave-valor simples — não precisamos de mais que isso aqui, então não
// faz sentido usar uma lib de ORM/schema pra IndexedDB. createAsyncStorage
// Persister (do próprio TanStack Query) só exige um objeto com essas 3
// funções, do mesmo jeito que localStorage/sessionStorage já têm — por
// isso o "adapter" abaixo é só repassar get/set/del do idb-keyval.
//
// Por que IndexedDB e não localStorage: localStorage é síncrono (bloqueia
// a thread principal) e tem limite de ~5-10MB — o cache inteiro do
// TanStack Query (todas as listagens: clientes, produtos, OS, orçamentos,
// equipe) pode passar disso numa oficina com bastante movimento.
// IndexedDB é assíncrono e o limite prático é bem maior (depende do
// navegador, mas tipicamente na faixa de centenas de MB).
export const indexedDbPersister = createAsyncStoragePersister({
  storage: {
    getItem: async (key: string) => (await get(key)) ?? null,
    setItem: async (key: string, value: string) => set(key, value),
    removeItem: async (key: string) => del(key),
  },
});
