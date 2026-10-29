import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'phosphor-react';
import { ReactNode } from 'react';

interface DialogProps {
  // Controlado pelo componente pai (ex: `isCreateModalOpen` na página de
  // Clientes & Veículos) — não usamos <Dialog.Trigger> do Radix porque
  // os gatilhos (ícones de lápis/+ na tabela) precisam saber QUAL
  // cliente/veículo abrir, o que é mais simples resolver com estado
  // normal do React do que com a API de trigger declarativo do Radix.
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  // Sempre informar — o Radix emite um aviso de acessibilidade no
  // console se o Content não tiver nenhuma Description associada
  // (leitor de tela fica sem contexto do que o diálogo faz).
  description: string;
  children: ReactNode;
}

// Modal genérico reaproveitável (cadastro combinado de cliente+veículo,
// edição de cliente, adicionar/editar veículo — ver
// src/pages/clientes-veiculos/index.page.tsx). Reconstrução não existia
// nenhum componente de modal "de conteúdo livre" no projeto até agora —
// só o Form/AlertDialog (quebrado, e mesmo se funcionasse seria o
// componente errado: AlertDialog é pra confirmação sim/não, não pra
// formulário). Decisão confirmada com o usuário: instalar
// @radix-ui/react-dialog (mesma família do @radix-ui/react-radio-group
// já usado em PlanCard) em vez de implementar overlay/foco/Esc na mão.
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        {/* Overlay escurece o fundo e fecha o modal ao clicar fora —
            comportamento de clique-fora já vem de graça do Radix, sem
            precisar escrever handler nenhum pra isso. */}
        <RadixDialog.Overlay className='fixed inset-0 z-40 bg-black/50' />

        <RadixDialog.Content
          className='fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[12px] border border-border bg-surface p-6 shadow-[0_8px_24px_-12px_rgba(43,36,32,0.3)] outline-none'
          // Esc e foco preso dentro do modal também já vêm do Radix.
        >
          <div className='flex items-start justify-between gap-4'>
            <div>
              <RadixDialog.Title className='font-display text-lg font-bold'>
                {title}
              </RadixDialog.Title>
              <RadixDialog.Description className='mt-1 text-[13px] text-text-muted'>
                {description}
              </RadixDialog.Description>
            </div>

            <RadixDialog.Close
              aria-label='Fechar'
              className='shrink-0 rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text'
            >
              <X size={18} />
            </RadixDialog.Close>
          </div>

          <div className='mt-5'>{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
