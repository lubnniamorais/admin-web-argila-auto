type Props = {
  message: string;
  icon?: React.ReactNode;
};

export function SuccessAlert({ message, icon }: Props) {
  return (
    <div
      className='
        border border-success
        bg-success-light
        text-success
        rounded-xl
        p-4
      '
    >
      {icon}
      {message}
    </div>
  );
}
