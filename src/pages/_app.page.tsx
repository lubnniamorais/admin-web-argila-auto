import 'react-toastify/dist/ReactToastify.css';
import '../styles/globals.css';

import { QueryClientProvider } from '@tanstack/react-query';
import type { AppProps } from 'next/app';
import { ToastContainer } from 'react-toastify';

import { AuthProvider } from '@/hooks/auth';
import { queryClient } from '@/lib/queryClient';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>

      <ToastContainer />
    </QueryClientProvider>
  );
}
