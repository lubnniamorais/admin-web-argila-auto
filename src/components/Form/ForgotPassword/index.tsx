import Link, { LinkProps } from 'next/link';
import { tv, VariantProps } from 'tailwind-variants';

const link = tv({
  base: [
    'flex justify-end no-underline text-WHITE font-bold my-4 mx-6',
    'duration-200 hover:text-OFF_WHITE_500 before:opacity-10',
  ],

  variants: {
    active: {
      true: 'font-bold text-OFF_WHITE_700 before:opacity-10',
    },
  },
});

type LinkVariants = LinkProps<HTMLLinkElement> & VariantProps<typeof link>;

interface ILinkBaseProps extends LinkVariants {
  href: string;
  children: React.ReactNode;
}

const ForgotPassword = ({ href, children, ...rest }: ILinkBaseProps) => {
  return (
    <Link className={link({ active: false })} href={href} {...rest}>
      {children}
    </Link>
  );
};

export { ForgotPassword };
