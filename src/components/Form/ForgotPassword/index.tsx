import Link, { LinkProps } from 'next/link';
import { AnchorHTMLAttributes } from 'react';

// Link estilizado "Esqueceu a senha?", usado na tela de login.
//
// A versão antiga usava `tailwind-variants` (lib não instalada neste
// projeto) e cores do template reaproveitado (OFF_WHITE_500/700, WHITE)
// que não existem nos tokens do ArgilaAuto — herdadas de quando o fundo
// do card de login era escuro (texto branco fazia sentido ali). Reescrito
// sem a lib, usando `clay-deep`, o mesmo tom que já estava sendo usado
// como link direto na tela de login antes deste componente existir.
//
// A variante "active" do componente original nunca era usada de verdade
// (toda chamada passava active={false}) — removida pra não carregar
// estado morto; se um dia precisar de um estado "ativo" aqui, é só
// reintroduzir quando houver um uso real pra ele.
type ForgotPasswordProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

export function ForgotPassword({
  className,
  children,
  ...rest
}: ForgotPasswordProps) {
  return (
    <Link
      className={`text-[12.5px] font-semibold text-clay-deep transition-colors hover:text-clay ${className ?? ''}`}
      {...rest}
    >
      {children}
    </Link>
  );
}
