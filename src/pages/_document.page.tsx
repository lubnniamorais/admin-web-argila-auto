import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    // suppressHydrationWarning: o next-themes escreve o atributo
    // data-theme no <html> antes do React hidratar (pra não "piscar" o
    // tema errado por uma fração de segundo) — sem isso o React acusa um
    // mismatch de hidratação só por causa desse atributo, que é esperado.
    <Html lang='pt' suppressHydrationWarning>
      <Head>
        {/* Favicon de verdade (selo v2), gerado via RealFaviconGenerator a
            partir do mesmo SVG usado no restante do app — arquivos em
            public/. Ordem/atributos seguem a recomendação padrão da
            ferramenta: SVG moderno primeiro, PNG 96x96 como alternativa,
            .ico como último fallback (navegadores antigos), e o
            apple-touch-icon pra quando salvam a página na tela inicial do
            iPhone/iPad. */}
        <link
          rel='icon'
          type='image/png'
          sizes='96x96'
          href='/favicon-96x96.png'
        />
        <link rel='icon' type='image/svg+xml' href='/favicon.svg' />
        <link rel='shortcut icon' href='/favicon.ico' />
        <link
          rel='apple-touch-icon'
          sizes='180x180'
          href='/apple-touch-icon.png'
        />

        {/* As fontes da marca (Zilla Slab, Manrope, JetBrains Mono, Baloo 2)
            são carregadas via @import em src/styles/globals.css — aqui só
            fica o preconnect, que acelera essa conexão. (A fonte "Mulish"
            que tinha um <link> direto aqui era resíduo do template antigo
            reaproveitado, não faz parte da identidade do ArgilaAuto — removida.) */}
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link
          rel='preconnect'
          href='https://fonts.gstatic.com'
          crossOrigin='anonymous'
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
