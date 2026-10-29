import { InputMask as InputMaskIMask } from 'imask';
import { InputHTMLAttributes } from 'react';
import { IMaskInput } from 'react-imask';
import { tv } from 'tailwind-variants';

// Reconstruído a partir do template antigo (ver CLAUDE.md, "Componentes
// legados ainda quebrados"): a versão original usava `tailwind-variants`
// e cores SCREAMING_CASE que não existem nos tokens do ArgilaAuto, além
// de 3 variantes visuais (erro/foco/preenchido, bordas vermelha/branca
// num tema escuro que não existe mais). Reescrito em 27/10 pra espelhar
// exatamente o `Input` (mesmo label/caixa/erro — sem mudar de cor ao
// focar/preencher, só o texto de erro embaixo), e `tailwind-variants`
// tinha saído de cena nessa reescrita.
//
// 29/10: `tailwind-variants` voltou a ser dependência do projeto
// (decisão do usuário, ver Pagination). Esta classe volta a usar `tv()`
// — mas só pra compor a classe base, sem reintroduzir as 3 variantes
// antigas: decisão confirmada com o usuário de manter o InputMask
// visualmente idêntico ao Input (que não tem esses estados), em vez de
// os dois componentes divergirem.
const inputMaskStyle = tv({
  base: 'w-full rounded-[9px] border border-border-strong bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1',
});
// Além da máscara fixa (string, ex: '(00) 00000-0000'), o IMask aceita
// um array de máscaras candidatas pra ele escolher sozinha qual bate
// melhor com o que já foi digitado (ex: CPF de 11 dígitos vs. CNPJ de
// 14 — ver uso em validateDocument.ts / clientes-veiculos). Tipo restrito
// só às 2 formas que este projeto usa (não o leque completo que o IMask
// aceita — datas, regex, função), mas cobre os casos reais.
type InputMaskPattern = string | Array<{ mask: string }>;

interface InputMaskProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  error?: string;
  mask: InputMaskPattern;
  // true (padrão) = guarda só os dígitos digitados; false = guarda com a
  // formatação da máscara (ex: "01310-100", com o traço); 'typed' = valor
  // tipado internamente pelo IMask. Ver uso em InputMaskFormControl.
  unmask?: boolean | 'typed';
  value?: string;
  onAccept: (
    value: string,
    mask: InputMaskIMask<{ [x: string]: unknown }>
  ) => void;
}

export function InputMask({
  label,
  error,
  id,
  name,
  mask,
  unmask = true,
  value,
  className,
  onAccept,
  ...rest
}: InputMaskProps) {
  const inputId = id ?? name;

  return (
    <div className='mt-4'>
      <label
        htmlFor={inputId}
        className='mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'
      >
        {label}
      </label>

      <IMaskInput
        id={inputId}
        name={name}
        // `as any`: o IMaskInput é tipado como união discriminada pelo
        // valor literal de `mask` (cada formato de máscara — string,
        // array dinâmico, data, regex — tem seu próprio conjunto de
        // props aceitas). Como este componente aceita `mask` como união
        // (string | array), o TS não consegue mais escolher um ramo só
        // e passa a exigir uma interseção impossível nos outros atributos
        // do input (ex: `max` vira `Date`, que não bate com o HTML
        // padrão). Em runtime o IMask lida com os dois formatos
        // perfeitamente — é só a tipagem da lib que não modela bem um
        // wrapper genérico como este. `noExplicitAny` já é só aviso
        // neste projeto (ver biome.json).
        mask={mask as any}
        unmask={unmask}
        value={value}
        onAccept={onAccept}
        className={inputMaskStyle({ className })}
        {...rest}
      />

      {error && <p className='mt-1.5 text-xs text-danger'>{error}</p>}
    </div>
  );
}
