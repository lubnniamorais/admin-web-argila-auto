import { Control, Controller, FieldValues, Path } from 'react-hook-form';

import { SelectPicker } from '../SelectPicker';

interface ISelectPickerOption {
  label: string;
  value: string;
}

interface SelectPickerFormControlProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
  placeholder?: string;
  data: ISelectPickerOption[];
  disabled?: boolean;
}

// Mesmo papel de InputFormControl/InputMaskFormControl: conecta o
// SelectPicker (controlado, value/onValueChange) ao RHF via Controller.
export function SelectPickerFormControl<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  data,
  disabled,
}: SelectPickerFormControlProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SelectPicker
          id={name}
          label={label}
          placeholder={placeholder}
          data={data}
          value={field.value ?? ''}
          onValueChange={field.onChange}
          error={fieldState.error?.message}
          disabled={disabled}
        />
      )}
    />
  );
}
