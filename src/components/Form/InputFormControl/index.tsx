import { InputHTMLAttributes } from 'react';
import { Control, Controller, FieldError } from 'react-hook-form';

import { Input } from '../Input';

interface IInputFormControlProps extends InputHTMLAttributes<HTMLInputElement> {
  control: Control<any>;
  label: string;
  name: string;
  secureEntry?: boolean;
  error?: FieldError;
}

const InputFormControl = ({
  control,
  label,
  name,
  secureEntry = false,
  error,
  ...rest
}: IInputFormControlProps) => {
  return (
    <div className='w-[3.6/4] flex flex-col items-center justify-center mx-auto mt-5 mb-6'>
      <Controller
        control={control}
        name={name}
        render={({ field: { value, onChange } }) => (
          <Input
            label={label}
            name={name}
            secureEntry={secureEntry}
            error={error}
            value={value}
            onChange={(text) => {
              onChange(text);
            }}
            {...rest}
          />
        )}
      />
    </div>
  );
};

export { InputFormControl };
