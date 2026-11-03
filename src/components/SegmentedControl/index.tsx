import { tv } from 'tailwind-variants';

// `tone` é opcional por opção (decisão confirmada com o usuário em
// 01/11/2026, pro seletor de Direção do movimento de estoque em
// Produtos) — quando uma opção realmente significa "bom"/"ruim" (ex.:
// Entrada soma, Saída subtrai), fica mais fácil de ler com verde/vermelho
// em vez da cor neutra padrão (clay). Sem `tone`, nenhuma das opções é
// "boa" ou "ruim", só métodos/escolhas diferentes (ex.: Peça/Serviço).
const segmentButton = tv({
  base: 'flex-1 rounded-lg px-3 py-2 text-center text-[13.5px] font-semibold transition-colors',
  variants: {
    selected: {
      true: '',
      false: 'text-text-muted hover:bg-surface-2',
    },
    tone: {
      neutral: '',
      good: '',
      crit: '',
    },
  },
  compoundVariants: [
    { selected: true, tone: 'neutral', className: 'bg-clay text-white' },
    { selected: true, tone: 'good', className: 'bg-good text-white' },
    { selected: true, tone: 'crit', className: 'bg-crit text-white' },
  ],
  defaultVariants: {
    tone: 'neutral',
  },
});

// Controle de poucas opções (tipicamente 2) apresentado como par/trio de
// botões, em vez de puxar RadioGroup/Select pra uma escolha binária
// simples — nasceu local ao form de movimento de estoque (Produtos,
// 31/10/2026) e foi promovido a componente compartilhado em 02/11/2026,
// quando Ordens de Serviço passou a precisar do mesmo controle (tipo de
// item: Peça/Serviço) — mesmo comportamento, sem nenhuma mudança visual.
export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
}: {
  options: {
    value: TValue;
    label: string;
    tone?: 'neutral' | 'good' | 'crit';
  }[];
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className='flex gap-1 rounded-[9px] border border-border-strong bg-surface-2 p-1'>
      {options.map((option) => (
        <button
          key={option.value}
          type='button'
          onClick={() => onChange(option.value)}
          className={segmentButton({
            selected: option.value === value,
            tone: option.tone ?? 'neutral',
          })}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
