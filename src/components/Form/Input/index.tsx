import { Eye, EyeSlash } from 'phosphor-react';
import { InputHTMLAttributes, useCallback, useRef, useState } from 'react';
import { FieldError } from 'react-hook-form';
import { tv, VariantProps } from 'tailwind-variants';

const input = tv({
  base: [
    'w-full flex flex-row items-center border-2 border-DARK_BLUE_900 bg-DARK_BLUE_900',
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

type InputVariants = InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof input>;

interface IInputBaseProps extends InputVariants {
  label: string;
  name: string;
  secureEntry?: boolean;
  error?: FieldError;
}

const Input = ({
  label,
  name,
  secureEntry = false,
  error,
  ...rest
}: IInputBaseProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // FUNCTIONS
  const handleInputBlur = useCallback(() => {
    setIsFocused(false);

    setIsFilled(!!inputRef.current?.value);
  }, []);

  const handleInputFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handlePasswordVisible = useCallback(() => {
    setIsPasswordVisible((oldState) => !oldState);
  }, []);
  // END FUNCTIONS

  return (
    <div className="w-full flex flex-col px-4">
      <label className="text-base pb-2" htmlFor={name}>
        {label}
      </label>

      {secureEntry ? (
        <>
          <div className={input({ isErrored: !!error, isFocused, isFilled })}>
            <input
              className="w-full h-2 text-sm text-WHITE p-2 bg-transparent focus:outline-none"
              name={name}
              onBlur={handleInputBlur}
              onFocus={handleInputFocus}
              type={isPasswordVisible ? 'text' : 'password'}
              {...rest}
            />

            <button
              className="bg-transparent leading-none"
              type="button"
              onClick={handlePasswordVisible}
            >
              {isPasswordVisible ? (
                <EyeSlash
                  className="mr-3"
                  size={25}
                  color={isFocused || isFilled ? '#FFFFFF' : '#FFFFFF'}
                />
              ) : (
                <Eye
                  className="mr-3"
                  size={25}
                  color={isFocused || isFilled ? '#FFFFFF' : '#FFFFFF'}
                />
              )}
            </button>
          </div>
          {/* {error && <ErrorMessage>{error.message}</ErrorMessage>} */}
        </>
      ) : (
        <>
          <div className={input({ isErrored: !!error, isFocused, isFilled })}>
            <input
              className="w-full h-2 text-sm text-WHITE p-3 bg-transparent focus:outline-none"
              name={name}
              onBlur={handleInputBlur}
              onFocus={handleInputFocus}
              {...rest}
            />
          </div>
          {/* {error && <ErrorMessage>{error.message}</ErrorMessage>} */}
        </>
      )}
    </div>
  );
};

// const Input = forwardRef(InputBase);

export { Input };
