import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // O servidor não sabe qual tema o visitante tem salvo (localStorage só
  // existe no navegador), então no primeiro render do cliente teríamos um
  // valor de 'theme' diferente do usado no SSR — isso causaria o ícone
  // "piscar"/trocar ou um aviso de hydration mismatch. Por isso só este
  // componente (que de fato decide qual ícone mostrar com base no tema)
  // espera montar no cliente antes de usar o valor real; até lá, mostra o
  // ícone correspondente ao defaultTheme='dark' do ThemeProvider.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? theme === 'dark' : true;

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className='
        flex
        items-center
        justify-center
        rounded-xl
        border
        border-border
        p-2
        transition
      '
    >
      {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}
