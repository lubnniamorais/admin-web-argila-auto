import { useEffect } from 'react';

/**
 * Registra o Service Worker manual (public/sw.js) — só em produção, nunca
 * em "npm run dev". Decisão confirmada com o usuário: o Turbopack do modo
 * dev gera/troca os chunks JS a cada mudança de código, e um SW ativo
 * nesse momento cachearia essas versões — resultado seria "salvei o
 * arquivo mas a tela continua com o código antigo" até limpar o cache do
 * navegador manualmente. Em produção (next build && next start, ou o
 * deploy de verdade) os arquivos são estáveis, então o cache é seguro.
 *
 * Chamado uma vez em _app.page.tsx (mesmo nível de AuthProvider/
 * ThemeProvider) — nunca em uma página isolada, senão o registro só
 * aconteceria depois de visitar aquela rota específica.
 */
export function useServiceWorker() {
  useEffect(() => {
    // process.env.NODE_ENV é substituído em tempo de build pelo próprio
    // Next.js (não é uma variável de ambiente lida em runtime) — por isso
    // dá pra confiar nesse valor tanto no server (SSR, aqui inofensivo
    // porque 'serviceWorker' nunca existe em window do lado do servidor)
    // quanto no client.
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    if (!('serviceWorker' in navigator)) {
      // Navegador antigo ou ambiente sem suporte (ex.: alguma automação de
      // teste) — a ausência da API já é motivo suficiente pra desistir
      // silenciosamente, sem quebrar o resto do app.
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // Falha aqui nunca deve travar o app — o offline é um "a mais", não
      // um requisito pra usar o sistema. Só loga pra facilitar diagnóstico
      // se um usuário reportar que o modo offline não está funcionando.
      console.error('Falha ao registrar o Service Worker:', error);
    });
  }, []);
}
