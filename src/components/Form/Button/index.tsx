import Link from 'next/link';

interface Props {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'light';
}

export function Button({ href, children, variant = 'primary' }: Props) {
  return (
    <Link
      href={href}
      className={`
        inline-flex
        items-center
        justify-center
        rounded-2xl
        px-6
        py-4
        font-medium
        transition-all
        duration-300

        ${
          variant === 'primary'
            ? `
              bg-primary
              text-primary-foreground
              hover:-translate-y-1
              hover:shadow-lg
            `
            : `
              border
              border-border
              hover:border-primary
              hover:text-primary
              hover:-translate-y-1
            `
        }

        ${
          variant === 'light'
            ? `
                bg-white
                text-primary

                hover:bg-neutral-100
                hover:-translate-y-1
                hover:shadow-lg
              `
            : ''
        }
      `}
    >
      {children}
    </Link>
  );
}
