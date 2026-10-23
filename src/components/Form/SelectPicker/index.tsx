import * as Select from '@radix-ui/react-select';
import { CaretDown, Check } from 'phosphor-react';
import { SelectHTMLAttributes } from 'react';
import { FieldError } from 'react-hook-form';
import { tv, VariantProps } from 'tailwind-variants';

const selectPicker = tv({
  base: [
    'w-72 h-14 flex items-center justify-between rounded-md p-3 my-2 px-4',
    'text-base text-WHITE leading-5 bg-DARK_BLUE_900 border-2 border-DARK_BLUE_900',
    'data-[placeholder]:text-OFF_WHITE_500',
    'xs:w-72 sm:w-104 md:w-96 lg:w-96 xl:w-84.5 2xl:w-96.5',
  ],

  variants: {
    isErrored: {
      true: 'border-RED_500',
    },
  },
});

type SelectVariants = SelectHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof selectPicker>;

interface IData {
  // Label é o que será mostrado para o usuário, por exemplo banana, maça, uva
  label: string;
  value: string;
  // Value é o ID, boolean é o que tem no banco de dados
}

interface ISelectPickerProps extends SelectVariants {
  placeholder?: string;
  data: IData[];
  value: string;
  error?: FieldError;
  onValueChange: (value: string) => void;
}

const SelectPicker = ({
  placeholder,
  data,
  value,
  error,
  onValueChange,
  ...rest
}: ISelectPickerProps) => {
  return (
    <div className="w-full">
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger className={selectPicker({ isErrored: !!error })}>
          <Select.Value placeholder={placeholder} {...rest} />
          <Select.Icon className="text-WHITE">
            <CaretDown size={20} />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content className="overflow-hidden bg-DARK_BLUE_900 rounded-md">
            <Select.Viewport className="py-1">
              {data.map((item) => {
                return (
                  <Select.Item
                    className="h-6 flex items-center relative pr-9 pl-4 select-none 
                    text-sm text-WHITE leading-4 rounded-md
                   data-[disabled]:text-OFF_WHITE_500 data-[highlighted]:outline-none"
                    key={item.value}
                    value={item.value}
                  >
                    <Select.ItemText className="text-WHITE">
                      {item.label}
                    </Select.ItemText>
                    <Select.ItemIndicator className="w-6 pl-3 inline-flex items-center justify-center">
                      <Check size={20} />
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
};

export { SelectPicker };
