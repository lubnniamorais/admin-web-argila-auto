type Props = {
  message: string;
  icon?: React.ReactNode;
};

export function ErrorAlert({ message, icon }: Props) {
  return (
    <div
      className='
        border border-danger
        bg-danger-light
        text-danger
        rounded-xl
        p-4
      '
    >
      {icon}
      {message}
    </div>
  );
}
