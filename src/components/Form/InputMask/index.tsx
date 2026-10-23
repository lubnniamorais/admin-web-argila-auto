import { InputMask as InputMaskIMask } from 'imask';
import { InputHTMLAttributes, useCallback, useRef, useState } from 'react';
import { FieldError } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import { tv, VariantProps } from 'tailwind-variants';

const inputMask = tv({
  base: [
    'w-full h-[52px] flex flex-row items-center border-2 border-DARK_BLUE_900 bg-DARK_BLUE_900',
    'rounded-md p-3 focus:outline-none',
  ],

  variants: {
    isErrored: {
      true: 'border-RED_500',
    },
    isFocused: {
      true: 'border-WHITE',
    },
    isFilled: {
      true: 'border-WHITE',
    },
  },
});

type InputMaskVariants = InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputMask>;

interface IInputMaskBaseProps extends InputMaskVariants {
  label: string;
  name: string;
  mask?: string;
  unmask?: true | false | 'typed';
  error?: FieldError;
  value?: string;
  onAccept?: (
    value: string,
    mask: InputMaskIMask<{
      [x: string]: unknown;
    }>,
  ) => void;
}

const InputMaskBase = ({
  label,
  name,
  mask,
  unmask = true,
  value,
  onAccept,
  error,
  ...rest
}: IInputMaskBaseProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [isFilled, setIsFilled] = useState(false);

  // FUNCTIONS
  const handleInputBlur = useCallback(() => {
    setIsFocused(false);

    setIsFilled(!!inputRef.current?.value);
  }, []);

  const handleInputFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // FUNCTIONS

  return (
    <div className="w-full flex flex-col px-4">
      <label className="text-base pb-3" htmlFor={name}>
        {label}
      </label>

      <div className={inputMask({ isErrored: !!error, isFocused, isFilled })}>
        <IMaskInput
          className="w-full h-2 text-sm text-WHITE p-2 bg-transparent focus:outline-none"
          inputRef={inputRef}
          name={name}
          unmask={unmask}
          mask={mask}
          value={value}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          onAccept={onAccept}
          {...rest}
        />
      </div>
      {/* {error && <ErrorMessage>{error.message}</ErrorMessage>} */}
    </div>
  );
};

// const InputMask = forwardRef(InputMaskBase);

export { InputMaskBase };
