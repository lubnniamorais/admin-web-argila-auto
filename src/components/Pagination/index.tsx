import {
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretLeft,
  CaretRight,
} from 'phosphor-react';
import { tv } from 'tailwind-variants';

// Reconstruído a partir do template antigo (ver CLAUDE.md, "Componentes
// legados ainda quebrados"): a versão original já usava `tailwind-variants`
// (decisão do usuário: manter a lib, só trocar as cores SCREAMING_CASE
// que não existem nos tokens do ArgilaAuto — ex: `bg-LIGHT_BLUE_700` —
// pelos tokens atuais). Mesma API de props de antes (pageCurrent/
// totalCount/perPage/onPageChange); o `styleButton` do template antigo
// virou uma variante interna (`enabled`), decidida aqui dentro conforme
// o botão faz sentido ou não pra página atual, em vez de vir de fora.
const paginationButton = tv({
  base: 'flex h-7 w-7 items-center justify-center rounded-md p-0 text-white transition-colors',
  variants: {
    enabled: {
      true: 'bg-clay hover:bg-clay-deep',
      false: 'cursor-not-allowed bg-border-strong',
    },
  },
  defaultVariants: {
    enabled: true,
  },
});

interface PaginationProps {
  pageCurrent: number;
  totalCount: number;
  perPage: number;
  onPageChange: (pageCurrent: number) => Promise<void> | void;
}

export function Pagination({
  pageCurrent,
  totalCount,
  perPage,
  onPageChange,
}: PaginationProps) {
  const pages = Math.ceil(totalCount / perPage) || 1;
  const isFirstPage = pageCurrent === 1;
  const isLastPage = pageCurrent >= pages;

  return (
    <div className='mt-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center'>
      <span className='text-[13px] text-text-muted'>
        Total de {totalCount} item(ns)
      </span>

      <div className='flex items-center gap-4'>
        <span className='text-[13px] text-text-muted'>
          Página {pageCurrent} de {pages}
        </span>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            className={paginationButton({ enabled: !isFirstPage })}
            onClick={() => onPageChange(1)}
            disabled={isFirstPage}
            aria-label='Primeira página'
          >
            <CaretDoubleLeft size={16} />
          </button>

          <button
            type='button'
            className={paginationButton({ enabled: !isFirstPage })}
            onClick={() => onPageChange(pageCurrent - 1)}
            disabled={isFirstPage}
            aria-label='Página anterior'
          >
            <CaretLeft size={16} />
          </button>

          <button
            type='button'
            className={paginationButton({ enabled: !isLastPage })}
            onClick={() => onPageChange(pageCurrent + 1)}
            disabled={isLastPage}
            aria-label='Próxima página'
          >
            <CaretRight size={16} />
          </button>

          <button
            type='button'
            className={paginationButton({ enabled: !isLastPage })}
            onClick={() => onPageChange(pages)}
            disabled={isLastPage}
            aria-label='Última página'
          >
            <CaretDoubleRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
