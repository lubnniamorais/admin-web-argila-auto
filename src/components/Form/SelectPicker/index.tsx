import * as RadixSelect from '@radix-ui/react-select';
import { CaretDown, Check } from 'phosphor-react';

// Reconstruído a partir do template antigo (ver CLAUDE.md, "Componentes
// legados ainda quebrados") — só faltava `tailwind-variants` (já
// instalado em 29/10) e os tokens de cor SCREAMING_CASE que não existem
// mais (`bg-DARK_BLUE_900`, `text-WHITE`, `text-OFF_WHITE_500`,
// `border-RED_500`...). Reescrito com os tokens atuais e o mesmo "visual
// de input" (label acima, borda, raio) já usado em Form/Input — primeiro
// uso de verdade do componente no projeto (ver src/pages/produtos, select
// de `maintenanceCategory`).
interface ISelectPickerOption {
  label: string;
  value: string;
}

interface ISelectPickerProps {
  // Precisa casar com o `id` do Trigger abaixo pra atender a regra de
  // acessibilidade "label precisa estar associado a um controle" (Biome
  // `noLabelWithoutControl`) — o Radix não gera um `<select>` nativo por
  // baixo, então o `htmlFor`/`id` tem que ser escrito à mão.
  id: string;
  label: string;
  placeholder?: string;
  data: ISelectPickerOption[];
  value: string;
  error?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}

export function SelectPicker({
  id,
  label,
  placeholder,
  data,
  value,
  error,
  disabled,
  onValueChange,
}: ISelectPickerProps) {
  return (
    <div className='mt-4'>
      <label
        htmlFor={id}
        className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
      >
        {label}
      </label>

      <RadixSelect.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <RadixSelect.Trigger
          id={id}
          className='flex w-full items-center justify-between rounded-[9px] border border-border-strong bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-muted data-[placeholder]:text-text-faint'
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon className='text-text-muted'>
            <CaretDown size={16} />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position='popper'
            sideOffset={4}
            className='z-50 overflow-hidden rounded-[9px] border border-border bg-surface shadow-[0_8px_24px_-12px_rgba(43,36,32,0.3)]'
          >
            <RadixSelect.Viewport className='max-h-72 p-1'>
              {data.map((item) => (
                <RadixSelect.Item
                  key={item.value}
                  value={item.value}
                  className='relative flex h-9 cursor-pointer items-center rounded-[7px] pl-8 pr-3 text-sm text-foreground outline-none select-none data-[highlighted]:bg-surface-2'
                >
                  <RadixSelect.ItemIndicator className='absolute left-2 inline-flex items-center'>
                    <Check size={15} className='text-clay' />
                  </RadixSelect.ItemIndicator>
                  <RadixSelect.ItemText>{item.label}</RadixSelect.ItemText>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {error && <p className='mt-1.5 text-xs text-danger'>{error}</p>}
    </div>
  );
}
