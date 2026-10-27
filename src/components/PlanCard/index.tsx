import * as RadioGroup from '@radix-ui/react-radio-group';
import { Check } from 'phosphor-react';
import { ReactNode } from 'react';

interface PlanCardProps {
  value: string;
  title: string;
  description: string;
  features: string[];
  badge?: ReactNode;
}

// Card de plano selecionável, usado dentro de um <RadioGroup.Root> (ver
// uso em src/pages/signup/index.page.tsx). Cada PlanCard é um
// <RadioGroup.Item> de verdade — não uma div com onClick — pra ganhar de
// graça a semântica de radio group (role, navegação por teclado, só uma
// opção marcada por vez) que o Radix já resolve, em vez de reimplementar
// isso na mão. O estado "selecionado" é estilizado via atributo
// data-state="checked" que o próprio Radix aplica no item ativo.
export function PlanCard({
  value,
  title,
  description,
  features,
  badge,
}: PlanCardProps) {
  return (
    <RadioGroup.Item
      value={value}
      className='relative flex flex-col items-start gap-1 rounded-[14px] border border-border-strong bg-surface p-5 text-left outline-none transition-colors hover:border-clay-deep data-[state=checked]:border-clay data-[state=checked]:bg-clay-soft focus-visible:outline-2 focus-visible:outline-clay focus-visible:outline-offset-2'
    >
      {/* Selo de "selecionado" — a Indicator do Radix só entra no DOM
          quando este item é o escolhido do grupo (data-state="checked"),
          então não precisa de nenhuma condicional nossa aqui. Sem isso, o
          único sinal de seleção era a cor da borda/fundo, sutil demais
          no tema escuro. */}
      <RadioGroup.Indicator className='absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full bg-clay text-white'>
        <Check size={12} weight='bold' />
      </RadioGroup.Indicator>

      {badge && (
        <span className='mb-1 inline-flex items-center gap-1 rounded-full bg-steel-soft px-2.5 py-1 text-[11px] font-bold text-steel'>
          {badge}
        </span>
      )}

      <span className='font-display text-lg font-bold text-foreground'>
        {title}
      </span>

      <span className='mb-3 text-[13px] text-text-muted'>{description}</span>

      <ul className='flex flex-col gap-1.5 text-[13px] text-text'>
        {features.map((feature) => (
          <li key={feature} className='flex items-start gap-1.5'>
            <Check
              className='mt-0.5 shrink-0 text-good'
              size={14}
              weight='bold'
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </RadioGroup.Item>
  );
}
