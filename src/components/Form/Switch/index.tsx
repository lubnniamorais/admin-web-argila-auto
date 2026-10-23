import * as Switch from '@radix-ui/react-switch';
import { SwitchProps } from '@radix-ui/react-switch';

type ISwitchProps = SwitchProps;

const SwitchBase = ({ ...rest }: ISwitchProps) => {
  return (
    <Switch.Root
      className="w-11 h-6 bg-OFF_WHITE_600 rounded-full relative data-[state=checked]:bg-LIGHT_BLUE_600"
      {...rest}
    >
      <Switch.Thumb
        className="block w-4 h-4 bg-WHITE rounded-full shadow-[0 2px 2px bg-LIGHT_BLUE_600]
       delay-100 translate-x-1 will-change-transform data-[state=checked]:translate-x-6"
      />
    </Switch.Root>
  );
};

export { SwitchBase };
