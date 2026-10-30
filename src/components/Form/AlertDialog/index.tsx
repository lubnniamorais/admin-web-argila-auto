import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';
import { tv } from 'tailwind-variants';

// Reconstruído a partir do template antigo (ver CLAUDE.md, "Componentes
// legados ainda quebrados"): a versão original usava `tailwind-variants`
// (já reinstalado, ver Pagination) e cores SCREAMING_CASE que não
// existem mais (`bg-GREEN_400`, `bg-RED_500`...). Reescrito com os
// tokens atuais e a mesma API controlada (open/onOpenChange) do Dialog
// de conteúdo livre (ver src/components/Dialog) — sem <Trigger>, porque
// quem abre isso é sempre uma ação de UI que já sabe o que confirmar
// (ex: excluir ESTE cliente), não um elemento declarativo fixo na tela.
const alertButton = tv({
  base: 'inline-flex w-full items-center justify-center rounded-[9px] px-3 py-3 text-[14.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70',
  variants: {
    tone: {
      // Ação principal "normal" (ex: confirmar algo não-destrutivo) —
      // mesma cor do botão primary do Form/Button.
      default: 'bg-clay text-white hover:bg-clay-deep',
      // Ação destrutiva (ex: excluir) — usa --crit em vez de --clay,
      // igual à semântica de cor já documentada no CLAUDE.md (cancelado/
      // erro).
      destructive: 'bg-crit text-white hover:opacity-90',
      cancel:
        'border border-border-strong bg-surface text-foreground hover:bg-surface-2',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  // Texto do botão de confirmar enquanto `isLoading` — cada ação
  // destrutiva tem seu próprio verbo ("Excluindo...", "Removendo...");
  // sem valor fixo aqui pra este componente continuar genérico.
  confirmLoadingLabel?: string;
  cancelLabel?: string;
  // 'destructive' pinta o botão de confirmar com --crit (ex: excluir) —
  // 'default' usa a cor normal (clay), pra confirmações não-destrutivas.
  tone?: 'default' | 'destructive';
  onConfirm: () => void;
  // Desabilita os 2 botões e troca o texto do de confirmar — igual ao
  // isPending de uma mutation, evitado clique duplo enquanto a chamada
  // à API ainda está em voo.
  isLoading?: boolean;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  confirmLoadingLabel,
  cancelLabel = 'Cancelar',
  tone = 'default',
  onConfirm,
  isLoading = false,
}: AlertDialogProps) {
  return (
    <RadixAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className='fixed inset-0 z-40 bg-black/50' />

        <RadixAlertDialog.Content className='fixed top-1/2 left-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-border bg-surface p-6 shadow-[0_8px_24px_-12px_rgba(43,36,32,0.3)] outline-none'>
          <RadixAlertDialog.Title className='font-display text-lg font-bold'>
            {title}
          </RadixAlertDialog.Title>

          <RadixAlertDialog.Description className='mt-2 text-[13px] leading-relaxed text-text-muted'>
            {description}
          </RadixAlertDialog.Description>

          <div className='mt-6 flex gap-3'>
            <RadixAlertDialog.Cancel
              disabled={isLoading}
              className={alertButton({ tone: 'cancel' })}
            >
              {cancelLabel}
            </RadixAlertDialog.Cancel>

            {/* Sem <RadixAlertDialog.Action> aqui de propósito: Action
                fecha o diálogo sozinho ao clicar, mas quem chama este
                componente precisa primeiro esperar a mutation terminar
                (onSuccess) pra então fechar — closeOnConfirm ficaria
                sob controle de quem usa, via onOpenChange, não daqui. */}
            <button
              type='button'
              disabled={isLoading}
              onClick={onConfirm}
              className={alertButton({ tone })}
            >
              {isLoading ? (confirmLoadingLabel ?? confirmLabel) : confirmLabel}
            </button>
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  );
}
