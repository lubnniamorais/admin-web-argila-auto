import { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'ghost';

const baseClassName =
  'inline-flex w-full items-center justify-center rounded-[9px] px-3 py-3 text-[14.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70';

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'bg-clay text-white hover:bg-clay-deep',
  ghost:
    'border border-border-strong bg-surface text-foreground hover:bg-surface-2',
};

export function buttonClassName(
  variant: ButtonVariant = 'primary',
  className?: string
) {
  return [baseClassName, variantClassName[variant], className]
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = 'primary',
  className,
  ...rest
}: ButtonProps) {
  return <button className={buttonClassName(variant, className)} {...rest} />;
}
