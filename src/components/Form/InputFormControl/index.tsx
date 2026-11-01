import { InputHTMLAttributes } from 'react';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';

import { Input } from '../Input';

interface InputFormControlProps<TFieldValues extends FieldValues>
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
  // Converte o valor em maiúsculo a cada tecla digitada (não é só CSS
  // visual — é o valor de verdade que vai pro form/API) — decisão
  // confirmada com o usuário em 01/11/2026, pra campos "âncora"/de busca
  // que não podem distinguir maiúsculo de minúsculo (ex.: sku, código do
  // fabricante, nome de peça/serviço em `/produtos`). Opt-in: só afeta o
  // campo em que for passada, o resto do app continua igual.
  uppercase?: boolean;
}

export function InputFormControl<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  uppercase,
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
          onChange={(event) => {
            if (uppercase) {
              event.target.value = event.target.value.toUpperCase();
            }

            field.onChange(event);
          }}
          label={label}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
