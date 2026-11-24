import 'react-toastify/dist/ReactToastify.css';
import '../styles/globals.css';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { AppProps } from 'next/app';
import { ThemeProvider } from 'next-themes';
import { ToastContainer } from 'react-toastify';

import { AuthProvider } from '@/hooks/auth';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { indexedDbPersister } from '@/lib/persister';
import { queryClient } from '@/lib/queryClient';

// Chave usada só pra invalidar TODO o cache offline de uma vez (ex.: se um
// dia mudarmos a forma dos dados de uma query de um jeito incompatível
// com o que já estava salvo no IndexedDB de quem usou a versão antiga).
// Bastaria mudar esse texto (ex. pra 'v2') pra qualquer snapshot anterior
// ser ignorado e um cache novo começar do zero.
const PERSIST_CACHE_BUSTER = 'v1';

// Por quanto tempo um snapshot salvo no IndexedDB ainda é considerado
// válido pra restaurar ao abrir o app, mesmo sem conexão. Depois desse
// prazo, o PersistQueryClientProvider descarta o snapshot e cada query
// volta a aparecer "vazia" até conseguir buscar de novo na rede — evita
// que alguém veja, por exemplo, um estoque de peça de 3 semanas atrás como
// se fosse atual.
const PERSISTED_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 horas

export default function App({ Component, pageProps }: AppProps) {
  // Só registra o Service Worker (public/sw.js) quando em produção — ver
  // comentário completo em hooks/useServiceWorker.ts.
  useServiceWorker();

  return (
    // attribute="data-theme": o next-themes grava o tema como
    // data-theme="dark"/"light" no <html>, que é exatamente o seletor
    // que src/styles/globals.css já usa (:root[data-theme="dark"]) — e é
    // também o que o @custom-variant dark (ver globals.css) ensina o
    // Tailwind a reconhecer, pra dark:* funcionar junto com o toggle.
    // defaultTheme="system": sem o usuário nunca ter clicado no toggle,
    // segue a preferência do sistema operacional (mesmo critério do
    // @media (prefers-color-scheme: dark) que já existia no CSS).
    <ThemeProvider attribute='data-theme' defaultTheme='system' enableSystem>
      {/* PersistQueryClientProvider troca o QueryClientProvider comum por
          uma versão que, além de prover o queryClient pro app (mesmo papel
          de antes), salva o cache inteiro no IndexedDB (via
          indexedDbPersister, ver lib/persister.ts) a cada mudança e
          restaura esse snapshot ao abrir o app de novo — é isso que
          permite abrir uma tela já visitada antes mesmo sem internet.
          persistOptions.buster/maxAge: ver os comentários das constantes
          PERSIST_CACHE_BUSTER/PERSISTED_CACHE_MAX_AGE_MS acima. */}
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: indexedDbPersister,
          buster: PERSIST_CACHE_BUSTER,
          maxAge: PERSISTED_CACHE_MAX_AGE_MS,
        }}
      >
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>

        <ToastContainer />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
