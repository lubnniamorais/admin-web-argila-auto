import 'react-toastify/dist/ReactToastify.css';
import '../styles/globals.css';

import { QueryClientProvider } from '@tanstack/react-query';
import type { AppProps } from 'next/app';
import { ThemeProvider } from 'next-themes';
import { ToastContainer } from 'react-toastify';

import { AuthProvider } from '@/hooks/auth';
import { queryClient } from '@/lib/queryClient';

export default function App({ Component, pageProps }: AppProps) {
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
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>

        <ToastContainer />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
