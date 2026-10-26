import { useTheme } from 'next-themes';
import { Moon, Sun } from 'phosphor-react';
import { useEffect, useState } from 'react';

// Botão de alternar tema, com ícone de sol/lua de verdade (usa `phosphor-react`,
// que já está instalado — diferente do ThemeToggle antigo, que importava de
// `@phosphor-icons/react`, pacote que não existe no package.json).
//
// O tema inicial é "system" (ver ThemeProvider em _app.page.tsx), então o
// servidor não tem como saber se o resultado vai ser claro ou escuro — só o
// navegador sabe, e só depois de montar. Se o ícone certo fosse escolhido já
// no primeiro render, o HTML do servidor poderia não bater com o do cliente
// (aviso de "hydration mismatch", ou o ícone trocando sozinho um instante
// depois de carregar). Por isso: antes de montar, mostra sempre o mesmo
// ícone (Moon) não importa qual vai ser o tema real; depois de montado,
// `resolvedTheme` já reflete o tema de verdade e o ícone passa a bater.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type='button'
      title='Alternar tema'
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className='inline-flex items-center justify-center rounded-lg border border-border-strong bg-surface p-2 text-foreground hover:bg-surface-2'
    >
      {/* Ícone mostra o DESTINO do clique, não o tema atual: sol = "vai
          clarear", lua = "vai escurecer". */}
      {isDark ? (
        <Sun size={16} weight='bold' />
      ) : (
        <Moon size={16} weight='bold' />
      )}
    </button>
  );
}
