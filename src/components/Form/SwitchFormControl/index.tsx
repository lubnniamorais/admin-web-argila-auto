import { Control, Controller, FieldValues, Path } from 'react-hook-form';

import { Switch } from '../Switch';

interface SwitchFormControlProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
  description?: string;
}

// Usado pro toggle de `active` na edição de Peça/Serviço (ver
// src/pages/produtos) — único lugar do projeto, até agora, que edita um
// boolean puro via formulário (ICustomer.active, por exemplo, só muda
// como efeito colateral de uma exclusão, nunca é editado direto).
export function SwitchFormControl<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
}: SwitchFormControlProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className='mt-4 flex items-center justify-between gap-3 rounded-[9px] border border-border-strong px-3.5 py-2.5'>
          <div>
            <p className='text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
              {label}
            </p>
            {description && (
              <p className='mt-0.5 text-[12.5px] text-text-muted'>
                {description}
              </p>
            )}
          </div>

          <Switch checked={field.value} onCheckedChange={field.onChange} />
        </div>
      )}
    />
  );
}
