import { InputHTMLAttributes } from 'react';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';

import { Input } from '../Input';

interface InputFormControlProps<TFieldValues extends FieldValues>
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
}

export function InputFormControl<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  ...rest
}: InputFormControlProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          {...field}
          {...rest}
          label={label}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
