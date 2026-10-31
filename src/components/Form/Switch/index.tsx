import * as RadixSwitch from '@radix-ui/react-switch';
import { tv } from 'tailwind-variants';

// Reconstruído a partir do template antigo (ver CLAUDE.md, "Componentes
// legados ainda quebrados") — cores SCREAMING_CASE (`bg-OFF_WHITE_600`,
// `bg-LIGHT_BLUE_600`, `bg-WHITE`) trocadas pelos tokens atuais, com
// `tv()` de verdade (decisão confirmada em 29/10, mesmo tratamento de
// Pagination/InputMask). Export renomeado de `SwitchBase` pra `Switch` —
// padrão de nome dos outros componentes de Form (Input, Button...).
const switchRoot = tv({
  base: 'relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-border-strong outline-none transition-colors focus-visible:outline-2 focus-visible:outline-clay focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:bg-clay',
});

const switchThumbClassName =
  'block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform will-change-transform data-[state=checked]:translate-x-[22px]';

export function Switch({ className, ...rest }: RadixSwitch.SwitchProps) {
  return (
    <RadixSwitch.Root className={switchRoot({ className })} {...rest}>
      <RadixSwitch.Thumb className={switchThumbClassName} />
    </RadixSwitch.Root>
  );
}
