// Service Worker escrito à mão (sem next-pwa/Serwist) — decisão confirmada
// com o usuário em 24/11/2026: o next-pwa clássico depende dos internals do
// webpack, e o Next.js 16 já usa Turbopack por padrão neste projeto (ver
// @tailwindcss/turbopack no package.json); forçar webpack só pra essa lib
// trocaria o bundler do build de produção por algo que o projeto já decidiu
// não usar. Um arquivo estático como este nunca passa pelo bundler (não é
// importado por nenhum .tsx, só servido pelo Next como asset público), então
// não tem NENHUM risco de incompatibilidade com Turbopack.
//
// Escopo desta Parte 1 (offline só-leitura): este SW cuida só da "casca" do
// app (HTML das páginas + JS/CSS/fontes) — os DADOS (clientes, produtos,
// ordens de serviço etc.) são responsabilidade da persistência do TanStack
// Query em IndexedDB (ver src/lib/persister.ts), não deste arquivo. Por
// isso o SW abaixo nunca intercepta chamadas pra API (origem diferente da
// do próprio app) nem mexe em métodos de escrita (POST/PUT/PATCH/DELETE).
//
// Registrado só em produção (ver src/hooks/useServiceWorker.ts) — em "npm
// run dev" ele nunca chega a instalar, pra não cachear os chunks do modo de
// desenvolvimento e confundir "salvei o código mas a tela não mudou".

// Bump esse número sempre que quiser forçar todo navegador com o SW
// instalado a descartar o cache antigo (ex.: depois de uma mudança grande
// de layout/assets). O "activate" abaixo apaga qualquer cache cujo nome não
// bata com o atual.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `argilaauto-shell-${CACHE_VERSION}`;

// "install": roda uma vez, quando o navegador baixa este arquivo por tar a
// primeira vez (ou detecta que o conteúdo mudou). self.skipWaiting() faz
// esta versão nova assumir na hora, sem esperar todas as abas antigas
// fecharem — aceitável aqui porque o SW só serve de cache, nunca muda o
// comportamento da página de um jeito que exija uma troca coordenada.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// "activate": roda depois do install, com a chance de limpar caches de
// versões anteriores (CACHE_VERSION antigo) antes do SW novo assumir de
// vez. self.clients.claim() faz esse SW já controlar as abas que já
// estavam abertas, sem precisar de um F5.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// "fetch": intercepta toda requisição da página. Estratégia confirmada com
// o usuário: network-first com fallback pro cache — tenta a rede sempre
// primeiro (garante a versão mais nova quando há internet) e só serve a
// cópia salva se a rede falhar de verdade (offline).
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Só GET entra no cache. Mutações (POST/PUT/PATCH/DELETE) não têm
  // fallback nenhum aqui — se a rede falhar, o erro sobe normal pro
  // Axios/TanStack Query tratar (é exatamente o comportamento que já
  // queremos: escrita nunca finge ter funcionado offline, ver decisão da
  // Parte 3 que ficou de fora por ora).
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  // Só cacheia requisições de mesma origem (os assets/páginas do próprio
  // admin). Chamadas pra API (outro host/porta) saem daqui sem cache —
  // ficam por conta da persistência do TanStack Query.
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(networkFirstWithCacheFallback(request));
});

async function networkFirstWithCacheFallback(request) {
  try {
    const networkResponse = await fetch(request);

    // Só guarda no cache respostas de verdade (200) — nunca um 404/500,
    // que não ajudaria em nada servir de novo offline.
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      // clone() é obrigatório: o corpo de uma Response só pode ser lido
      // uma vez, e aqui ele é lido duas vezes (uma pro cache, outra pro
      // navegador renderizar a página/asset).
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    // Rede falhou (offline de verdade, ou DNS/timeout) — tenta servir a
    // última cópia salva desta mesma requisição.
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Nada em cache (ex.: primeira visita a essa URL, nunca online) — não
    // tem como fingir uma resposta, deixa o erro seguir pro navegador
    // mostrar a tela padrão de "sem conexão".
    throw new Error('Sem conexão e sem cópia salva para esta requisição.');
  }
}
