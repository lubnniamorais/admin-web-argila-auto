import { Control, Controller, FieldValues, Path } from 'react-hook-form';

import { InputMask } from '../InputMask';

interface InputMaskFormControlProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
  mask: string;
  unmask?: boolean | 'typed';
  placeholder?: string;
  disabled?: boolean;
}

// Mesmo padrão auto-contido do InputFormControl (erro lido direto do
// fieldState do Controller, não precisa receber "error" de fora) — ver
// explicação em ForgotPassword/signup sobre essa diferença em relação ao
// admin-web-amip.
export function InputMaskFormControl<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  mask,
  unmask = true,
  ...rest
}: InputMaskFormControlProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <InputMask
          label={label}
          mask={mask}
          unmask={unmask}
          name={field.name}
          value={field.value}
          onBlur={field.onBlur}
          onAccept={(value) => field.onChange(value)}
          error={fieldState.error?.message}
          {...rest}
        />
      )}
    />
  );
}
