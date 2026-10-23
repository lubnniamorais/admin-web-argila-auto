import { InputHTMLAttributes } from 'react';
import { Control, Controller, FieldError } from 'react-hook-form';

import { InputMaskBase } from '../InputMask';

interface IInputMaskFormControlProps
  extends InputHTMLAttributes<HTMLInputElement> {
  control: Control<any>;
  label: string;
  name: string;
  mask?: string;
  unmask?: true | false | 'typed';
  error?: FieldError;
}

const InputMaskFormControl = ({
  control,
  label,
  name,
  mask,
  unmask = true,
  error,
  ...rest
}: IInputMaskFormControlProps) => {
  return (
    <div
      className="w-11/12 flex flex-col items-center justify-center mx-auto mt-5 mb-6
    text-base leading-4"
    >
      <Controller
        control={control}
        name={name}
        render={({ field: { value, onChange } }) => (
          <InputMaskBase
            label={label}
            name={name}
            mask={mask}
            unmask={unmask}
            error={error}
            value={value}
            onAccept={(value, _) => {
              onChange(value);
            }}
            {...rest}
          />
        )}
      />
    </div>
  );
};

export { InputMaskFormControl };
