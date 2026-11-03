import { Control, Controller, FieldValues, Path } from 'react-hook-form';

import { Combobox, IComboboxOption } from '../Combobox';

interface ComboboxFormControlProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  options: IComboboxOption[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  isLoading?: boolean;
  // Rótulo do item hoje selecionado no campo (`field.value`) — quem usa
  // o componente guarda isso à parte (ver Combobox: o valor escolhido
  // pode não estar mais em `options`, se a busca mudou depois).
  selectedLabel?: string;
  // Disparado além do `field.onChange` do RHF — pra side-effects que
  // dependem de QUAL opção foi escolhida (ex.: trocar de cliente limpa
  // o veículo selecionado), não só do novo valor.
  onSelect?: (option: IComboboxOption) => void;
  disabled?: boolean;
}

// Mesmo papel de SelectPickerFormControl: conecta o Combobox (controlado,
// value/onSelect) ao RHF via Controller.
export function ComboboxFormControl<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  options,
  searchValue,
  onSearchChange,
  isLoading,
  selectedLabel,
  onSelect,
  disabled,
}: ComboboxFormControlProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Combobox
          id={name}
          label={label}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          emptyLabel={emptyLabel}
          options={options}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          isLoading={isLoading}
          value={field.value ?? ''}
          selectedLabel={selectedLabel}
          onSelect={(option) => {
            field.onChange(option.value);
            onSelect?.(option);
          }}
          error={fieldState.error?.message}
          disabled={disabled}
        />
      )}
    />
  );
}
