import * as RadixPopover from '@radix-ui/react-popover';
import { Command as CommandPrimitive } from 'cmdk';
import { CaretDown, Check, MagnifyingGlass, SpinnerGap } from 'phosphor-react';
import { useState } from 'react';

// Campo de busca-e-seleção (combobox) pra listas que vêm da API em vez
// de um conjunto fixo pequeno (ver Form/SelectPicker, pra esse outro
// caso) — ex.: escolher um cliente ou uma peça/serviço do catálogo pra
// montar uma OS. Nenhum primitivo do Radix cobre isso sozinho; `cmdk`
// cuida da lista filtrável/navegação por teclado dentro do "balão" que
// o `@radix-ui/react-popover` posiciona — mesma dupla usada pelo
// shadcn/ui pra combobox. Decisão confirmada com o usuário em 02/11/2026
// (ver CLAUDE.md), junto da extração de um `ComboboxFormControl` próprio
// (mesmo papel de SelectPickerFormControl).
export interface IComboboxOption {
  value: string;
  label: string;
  // Linha secundária menor abaixo do label (ex.: documento do cliente,
  // SKU da peça) — opcional, só cosmético.
  description?: string;
}

interface IComboboxProps {
  id: string;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  // Opções da BUSCA atual (página de resultado), não a lista inteira —
  // quem usa o componente já filtra isso via `onSearchChange` (debounce
  // + chamada à API, mesmo padrão de busca já usado em Clientes/Produtos).
  options: IComboboxOption[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  isLoading?: boolean;
  // Valor selecionado (id) e o rótulo a mostrar fechado — separados de
  // propósito: o rótulo do item escolhido pode não estar mais na lista
  // de `options` atual (ex.: usuário limpou a busca depois de escolher).
  value: string;
  selectedLabel?: string;
  onSelect: (option: IComboboxOption) => void;
  error?: string;
  disabled?: boolean;
}

export function Combobox({
  id,
  label,
  placeholder,
  searchPlaceholder = 'Buscar...',
  emptyLabel = 'Nenhum resultado.',
  options,
  searchValue,
  onSearchChange,
  isLoading,
  value,
  selectedLabel,
  onSelect,
  error,
  disabled,
}: IComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className='mt-4'>
      <label
        htmlFor={id}
        className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
      >
        {label}
      </label>

      <RadixPopover.Root open={open} onOpenChange={setOpen}>
        <RadixPopover.Trigger asChild>
          <button
            id={id}
            type='button'
            disabled={disabled}
            className='flex w-full items-center justify-between rounded-[9px] border border-border-strong bg-background px-3.5 py-2.5 text-left text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-muted'
          >
            <span className={value ? 'truncate' : 'truncate text-text-faint'}>
              {value ? selectedLabel : placeholder}
            </span>
            <CaretDown size={16} className='ml-2 shrink-0 text-text-muted' />
          </button>
        </RadixPopover.Trigger>

        <RadixPopover.Portal>
          <RadixPopover.Content
            align='start'
            sideOffset={4}
            className='z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-[9px] border border-border bg-surface shadow-[0_8px_24px_-12px_rgba(43,36,32,0.3)]'
          >
            {/* shouldFilter=false: a busca já é feita no servidor (ver
                onSearchChange) — o cmdk só precisa renderizar/navegar
                pelas opções que já vieram filtradas, nunca refiltrar o
                texto digitado contra o label. */}
            <CommandPrimitive shouldFilter={false}>
              <div className='flex items-center gap-2 border-b border-border px-3'>
                <MagnifyingGlass
                  size={15}
                  className='shrink-0 text-text-muted'
                />
                <CommandPrimitive.Input
                  autoFocus
                  value={searchValue}
                  onValueChange={onSearchChange}
                  placeholder={searchPlaceholder}
                  className='h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-text-faint'
                />
                {isLoading && (
                  <SpinnerGap
                    size={15}
                    className='shrink-0 animate-spin text-text-muted'
                  />
                )}
              </div>

              <CommandPrimitive.List className='max-h-64 overflow-y-auto p-1'>
                <CommandPrimitive.Empty className='px-3 py-6 text-center text-[13px] text-text-muted'>
                  {isLoading ? 'Buscando...' : emptyLabel}
                </CommandPrimitive.Empty>

                {options.map((option) => (
                  <CommandPrimitive.Item
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onSelect(option);
                      setOpen(false);
                    }}
                    className='relative flex cursor-pointer flex-col rounded-[7px] py-2 pr-3 pl-8 text-sm text-foreground data-[selected=true]:bg-surface-2'
                  >
                    {option.value === value && (
                      <Check
                        size={15}
                        className='absolute top-2.5 left-2 text-clay'
                      />
                    )}
                    <span className='truncate'>{option.label}</span>
                    {option.description && (
                      <span className='truncate text-[12px] text-text-muted'>
                        {option.description}
                      </span>
                    )}
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.List>
            </CommandPrimitive>
          </RadixPopover.Content>
        </RadixPopover.Portal>
      </RadixPopover.Root>

      {error && <p className='mt-1.5 text-xs text-danger'>{error}</p>}
    </div>
  );
}
