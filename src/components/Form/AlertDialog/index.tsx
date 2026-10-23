import { AlertDialogProps } from '@radix-ui/react-alert-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { ButtonHTMLAttributes } from 'react';
import { tv, VariantProps } from 'tailwind-variants';

const alertButton = tv({
  base: [
    'h-9 inline-flex items-center justify-center rounded-md py-0 px-6',
    'text-base text-WHITE font font-bold leading-4 cursor-pointer',
  ],

  variants: {
    styleButton: {
      success:
        'bg-GREEN_400 hover:bg-GREEN_600 focus:shadow-alertDialogSuccess',
      destroy: 'bg-RED_500 hover:bg-RED_600 focus:shadow-alertDialogDestroy',
      cancel:
        'text-BLACK bg-OFF_WHITE_400 hover:bg-OFF_WHITE_500 focus:shadow-alertDialogCancel',
    },
  },
});

type ButtonVariants = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof alertButton>;

interface IAlertDialogProps extends AlertDialogProps, ButtonVariants {
  title: string;
  description: string;
  textButtonCancel?: string;
  textButtonAction: string;
  isOpenCancel?: boolean;
  onAction: () => void;
}

const AlertDialogBase = ({
  title,
  description,
  textButtonCancel,
  textButtonAction,
  isOpenCancel = true,
  styleButton,
  onAction,
  ...rest
}: IAlertDialogProps) => {
  return (
    <AlertDialog.Root {...rest}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="bg-black/[0.6] fixed inset-0 animate-animationOverlayShow" />

        <AlertDialog.Content
          className="bg-WHITE rounded-md fixed top-1/2 left-1/2 
          -translate-x-2/4 -translate-y-2/4 w-[90vw] max-w-lg max-h-[85vh] p-6"
        >
          <AlertDialog.Title className="m-0 mb-3 text-BLACK text-base font-bold">
            {title}
          </AlertDialog.Title>

          <AlertDialog.Description className="mb-5 text-OFF_WHITE_800 text-base font-medium leading-6">
            {description}
          </AlertDialog.Description>

          <div className="flex justify-end gap-4">
            {isOpenCancel && (
              <AlertDialog.Cancel asChild>
                <button
                  className={alertButton({ styleButton: 'cancel' })}
                  type="button"
                >
                  {textButtonCancel}
                </button>
              </AlertDialog.Cancel>
            )}
            <AlertDialog.Action asChild>
              <button
                className={alertButton({ styleButton })}
                type="button"
                onClick={onAction}
              >
                {textButtonAction}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export { AlertDialogBase };
