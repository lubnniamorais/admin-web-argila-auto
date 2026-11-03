import { TextareaHTMLAttributes } from 'react';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';

import { Textarea } from '../Textarea';

interface TextareaFormControlProps<TFieldValues extends FieldValues>
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
}

// Mesmo papel de InputFormControl, pro Textarea.
export function TextareaFormControl<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  ...rest
}: TextareaFormControlProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Textarea
          {...field}
          {...rest}
          label={label}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
