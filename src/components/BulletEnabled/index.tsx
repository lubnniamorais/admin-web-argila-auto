import { ComponentProps } from 'react';
import { tv, VariantProps } from 'tailwind-variants';

const spanBulletEnabled = tv({
  base: ['w-4 h-4 flex rounded-full'],

  variants: {
    active: {
      true: 'bg-GREEN_400',
      false: 'bg-RED_500',
    },
  },

  defaultVariants: {
    active: true,
  },
});

type SpanBulletVariants = ComponentProps<'span'> &
  VariantProps<typeof spanBulletEnabled>;

interface ISpanProps extends SpanBulletVariants {}

const BulletEnabled = ({ active, ...rest }: ISpanProps) => {
  return <span className={spanBulletEnabled({ active })} {...rest} />;
};

export { BulletEnabled };
