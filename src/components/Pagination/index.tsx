import {
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretLeft,
  CaretRight,
} from 'phosphor-react';
import { ButtonHTMLAttributes, ComponentProps } from 'react';
import { tv, VariantProps } from 'tailwind-variants';

const paginationButton = tv({
  base: [
    'w-7 h-7 flex justify-center items-center',
    'rounded-md p-0 text-base font-bold text-WHITE',
  ],
  variants: {
    styleButton: {
      enabled: 'bg-LIGHT_BLUE_700 hover:bg-LIGHT_BLUE_800',
      disabled: 'bg-OFF_WHITE_500 hover:bg-OFF_WHITE_600 cursor-not-allowed',
    },
  },

  defaultVariants: {
    styleButton: 'enabled',
  },
});

type PaginationButtonVariants = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof paginationButton>;

interface PaginationProps extends PaginationButtonVariants {
  pageCurrent: number;
  totalCount: number;
  perPage: number;
  onPageChange: (pageCurrent: number) => Promise<void> | void;
}

const Pagination = ({
  pageCurrent,
  totalCount,
  perPage,
  styleButton = 'enabled',
  onPageChange,
}: PaginationProps) => {
  const pages = Math.ceil(totalCount / perPage) || 1;

  return (
    <div
      className="flex flex-row items-end justify-between gap-1 mt-10
      xs:flex-col
      sm:flex-col
      md:flex-row
      lg:flex-row
      xl:flex-row
      2xl:flex-row
      3xl:flex-row"
    >
      <div>
        <span>Total de {totalCount} item(s)</span>
      </div>

      <div
        className="flex items-end gap-5
        xs:flex-col
        sm:flex-col
        md:flex-row
        lg:flex-row
        xl:flex-row
        2xl:flex-row
        3xl:flex-row"
      >
        <div className="flex text-base">
          Página {pageCurrent} de {pages}
        </div>

        <div className="flex items-center gap-3">
          {pageCurrent === 1 ? (
            <button
              className={paginationButton({ styleButton: 'disabled' })}
              type="button"
              onClick={() => {
                onPageChange(1);
              }}
              disabled={true}
            >
              <CaretDoubleLeft size={20} />
            </button>
          ) : (
            <button
              className={paginationButton({ styleButton })}
              type="button"
              onClick={() => {
                onPageChange(1);
              }}
            >
              <CaretDoubleLeft size={20} />
            </button>
          )}

          {pageCurrent === 1 ? (
            <button
              className={paginationButton({ styleButton: 'disabled' })}
              type="button"
              onClick={() => {
                onPageChange(pageCurrent - 1);
              }}
              disabled={true}
            >
              <CaretLeft size={20} />
            </button>
          ) : (
            <button
              className={paginationButton({ styleButton })}
              type="button"
              onClick={() => {
                onPageChange(pageCurrent - 1);
              }}
            >
              <CaretLeft size={20} />
            </button>
          )}

          {pages < pageCurrent + 1 ? (
            <button
              className={paginationButton({ styleButton: 'disabled' })}
              type="button"
              onClick={() => {
                onPageChange(pageCurrent + 1);
              }}
              disabled={true}
            >
              <CaretRight size={20} />
            </button>
          ) : (
            <button
              className={paginationButton({ styleButton })}
              type="button"
              onClick={() => {
                onPageChange(pageCurrent + 1);
              }}
            >
              <CaretRight size={20} />
            </button>
          )}

          {pages < pageCurrent + 1 ? (
            <button
              className={paginationButton({ styleButton: 'disabled' })}
              type="button"
              onClick={() => {
                onPageChange(pages);
              }}
              disabled={true}
            >
              <CaretDoubleRight size={20} />
            </button>
          ) : (
            <button
              className={paginationButton({ styleButton })}
              type="button"
              onClick={() => {
                onPageChange(pages);
              }}
            >
              <CaretDoubleRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export { Pagination };
