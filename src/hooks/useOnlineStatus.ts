import { useEffect, useState } from 'react';

/**
 * Observa navigator.onLine + os eventos 'online'/'offline' do browser.
 * Usado pelo indicador na topbar do AppShell — ver "Sem conexão" em
 * AppShell/index.tsx.
 *
 * Importante: navigator.onLine reflete se o dispositivo está conectado a
 * ALGUMA rede (ex.: Wi-Fi ligado), não se a API da ArgilaAuto está
 * alcançável de verdade — uma rede sem internet de fato ainda conta como
 * "online" aqui. Isso é uma limitação conhecida da própria API do
 * navegador (não dá pra checar sem fazer uma requisição de verdade), mas é
 * suficiente pro objetivo desta Parte 1: avisar nos casos mais comuns (sem
 * Wi-Fi/dados, modo avião) que os dados na tela podem estar desatualizados.
 */
export function useOnlineStatus(): boolean {
  // Começa como `true` (otimista) em vez de ler navigator.onLine direto
  // no useState inicial — o valor inicial de useState roda também durante
  // a renderização no servidor (SSR), onde `navigator` não existe; o
  // useEffect abaixo corrige pro valor real assim que o componente monta
  // no navegador.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
