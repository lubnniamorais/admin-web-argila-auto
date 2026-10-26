import Image from 'next/image';

import logoDark from '@/assets/logo-completed-dark.svg';
import logoLight from '@/assets/logo-completed.svg';

interface LogoProps {
  size?: number;
  className?: string;
  // 'auto' (padrão): troca sozinho com o tema da página (claro/escuro),
  // como nas telas de autenticação, cujo fundo também troca com o tema.
  // 'dark'/'light': força sempre a mesma variante, pro caso de um fundo
  // de cor fixa que NÃO acompanha o tema da página — ex.: a sidebar do
  // AppShell, que segundo o protótipo é sempre escura (clay-deep),
  // mesmo com o app no tema claro. Nesse fundo, só a variante "dark" do
  // logo (letras em creme/clay claro) fica legível.
  variant?: 'auto' | 'light' | 'dark';
  // Mostra só o selo (recorta a lockup, escondendo o wordmark) — usado
  // quando a sidebar colapsa pra modo ícone (ver AppShell/Menubar, abaixo
  // de 880px). Não existe um arquivo separado "só o selo" em src/assets,
  // então isso recorta a MESMA imagem da lockup: dentro do viewBox de 440
  // de largura, o selo ocupa exatamente os primeiros 120 — ver comentário
  // em <IconOnlyLogo> sobre a técnica usada.
  iconOnly?: boolean;
}

const LOCKUP_ASPECT_RATIO = 440 / 120;

/**
 * Logomarca oficial ArgilaAuto v2, a partir dos arquivos em src/assets/
 * (logo-completed.svg / logo-completed-dark.svg).
 */
export function Logo({
  size = 36,
  className,
  variant = 'auto',
  iconOnly = false,
}: LogoProps) {
  if (iconOnly) {
    if (variant === 'light' || variant === 'dark') {
      const src = variant === 'light' ? logoLight.src : logoDark.src;
      return <IconOnlyLogo src={src} size={size} className={className} />;
    }

    // variant === 'auto' + iconOnly: mesma troca claro/escuro do modo
    // normal, só que cada metade já vem recortada.
    return (
      <span className={className}>
        <IconOnlyLogo
          src={logoLight.src}
          size={size}
          className='block dark:hidden'
        />
        <IconOnlyLogo
          src={logoDark.src}
          size={size}
          className='hidden dark:block'
        />
      </span>
    );
  }

  const width = Math.round(size * LOCKUP_ASPECT_RATIO);

  if (variant === 'light' || variant === 'dark') {
    return (
      <Image
        src={variant === 'light' ? logoLight : logoDark}
        alt='ArgilaAuto'
        width={width}
        height={size}
        unoptimized
        priority
        className={className}
      />
    );
  }

  // variant === 'auto': as duas versões ficam no DOM, e o CSS (dark:,
  // ensinado em globals.css a seguir o data-theme do next-themes) decide
  // qual fica visível.
  return (
    <span className={className}>
      <Image
        src={logoLight}
        alt='ArgilaAuto'
        width={width}
        height={size}
        unoptimized
        priority
        className='block dark:hidden'
      />
      <Image
        src={logoDark}
        alt='ArgilaAuto'
        width={width}
        height={size}
        unoptimized
        priority
        className='hidden dark:block'
      />
    </span>
  );
}

interface IconOnlyLogoProps {
  src: string;
  size: number;
  className?: string;
}

/**
 * Mostra só o selo (badge carro+check) recortado da imagem da lockup
 * completa, sem precisar de um arquivo separado em src/assets.
 *
 * Por que não usar <Image> + overflow:hidden (a primeira tentativa): o
 * `next/image` não aplicava de forma consistente um `style` de
 * width/height customizado entre o HTML gerado no servidor e o que o
 * React esperava no cliente — um "hydration mismatch" de verdade (visto
 * no log do `next dev`), não só um detalhe visual. Usando a imagem como
 * `background-image` de um <div> comum, em vez de um <img>, esse
 * problema some: não é mais o `next/image` quem decide o `style`, e o
 * reset de CSS do Tailwind pra `<img>` (`max-width:100%;height:auto`,
 * que also atrapalhava) nem se aplica a um `<div>`.
 *
 * A técnica em si: dentro do viewBox de 440×120 da lockup, o selo ocupa
 * exatamente os primeiros 120 de largura (quadrado). Um <div> do tamanho
 * do selo (width=height=size), com essa imagem como fundo dimensionado
 * pro tamanho que a lockup INTEIRA teria nesse `size` (width proporcional
 * via LOCKUP_ASPECT_RATIO) e alinhado à esquerda, mostra só essa fatia.
 */
function IconOnlyLogo({ src, size, className }: IconOnlyLogoProps) {
  const fullLockupWidth = Math.round(size * LOCKUP_ASPECT_RATIO);

  return (
    <div
      role='img'
      aria-label='ArgilaAuto'
      // IMPORTANTE: nenhuma classe de "display" incondicional aqui (tipo
      // "inline-block" solto) — ela brigaria com o "hidden" que o
      // chamador passa via `className` e, dependendo da ordem em que o
      // Tailwind decide gerar as regras no CSS final (não é a ordem em
      // que as classes aparecem no JSX), poderia vencer o "hidden" e
      // deixar o selo sempre visível, nunca escondido. Quem chama este
      // componente é responsável por passar TANTO o estado escondido
      // quanto o visível como classes condicionais do mesmo breakpoint
      // (ex.: "hidden max-[880px]:inline-block").
      className={`flex-none ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${src})`,
        backgroundSize: `${fullLockupWidth}px ${size}px`,
        backgroundPosition: 'left center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
