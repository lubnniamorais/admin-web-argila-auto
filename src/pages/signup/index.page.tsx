import { zodResolver } from '@hookform/resolvers/zod';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { useMutation } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Check,
  CreditCard,
  MagnifyingGlass,
  Sparkle,
} from 'phosphor-react';
import { useCallback, useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z as zod } from 'zod';

import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/Form/Button';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { InputMaskFormControl } from '@/components/Form/InputMaskFormControl';
import { Logo } from '@/components/Logo';
import { PlanCard } from '@/components/PlanCard';
import { useAuth } from '@/hooks/auth';
import { api } from '@/lib/apiClient';
import { withSSRGuest } from '@/utils/withSSRGuest';

// Resposta da ViaCEP (https://viacep.com.br/ws/{cep}/json/) — "erro: true"
// é o formato que ela usa pra CEP sintaticamente válido mas inexistente
// (devolve 200 mesmo assim, não um 4xx).
interface IAddressViaCep {
  logradouro: string;
  bairro: string;
  uf: string;
  localidade: string;
  erro?: boolean;
}

// E-mail/UF são opcionais nesta tela (mesmo padrão da API — ver
// ISignUpWorkshopDTO em api-argila-auto): só validamos o FORMATO quando
// algo foi digitado. zod.string().email().optional() não cobre isso
// sozinho, porque "optional" só libera undefined, não string vazia — por
// isso o union com zod.literal('').
const optionalEmail = zod
  .union([zod.literal(''), zod.string().trim().email('E-mail inválido')])
  .optional();

const optionalUf = zod
  .union([
    zod.literal(''),
    zod.string().trim().length(2, 'UF deve ter 2 letras'),
  ])
  .optional();

const signUpFormSchema = zod.object({
  // Passo 1 — Sobre a oficina
  workshopName: zod.string().trim().min(1, 'Informe o nome da oficina'),
  workshopCnpj: zod.string().trim().optional(),
  workshopPhone: zod.string().trim().optional(),
  workshopEmail: optionalEmail,
  // Passo 1 — Endereço (opcional, ver CLAUDE.md da API: campos novos em
  // Workshop, todos opcionais)
  addressStreet: zod.string().trim().optional(),
  addressNumber: zod.string().trim().optional(),
  addressComplement: zod.string().trim().optional(),
  addressNeighborhood: zod.string().trim().optional(),
  addressCity: zod.string().trim().optional(),
  addressState: optionalUf,
  addressZipCode: zod.string().trim().optional(),
  // Passo 1 — Dados de acesso do dono (vira o User ADMIN)
  ownerName: zod.string().trim().min(1, 'Informe seu nome'),
  ownerEmail: zod
    .string()
    .trim()
    .min(1, 'Informe o e-mail')
    .email('Informe um e-mail válido'),
  // Mesmo mínimo exigido pela API (ver sign-up-workshop.controller.ts).
  ownerPassword: zod
    .string()
    .min(8, 'A senha precisa ter pelo menos 8 caracteres'),
  // Passo 2 — Plano. Tem default porque a validação do passo 1 roda o
  // schema inteiro (ver handleContinueToStep2) — sem default, avançar do
  // passo 1 falharia por "plan" ainda não ter sido escolhido.
  plan: zod.enum(['BASIC', 'PRO']).default('BASIC'),
});

type ISignUpFormData = zod.infer<typeof signUpFormSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  // 3 passos, numa página só com estado local (decisão confirmada com o
  // usuário) — mesmo espírito do protótipo, que troca a div visível via
  // JS, só que aqui trocamos o que o React renderiza.
  const [step, setStep] = useState<1 | 2>(1);
  // Só usado quando o plano escolhido é Pro: depois de criar a conta (que
  // sempre nasce Básico, ver CLAUDE.md da API), chamamos
  // upgrade-to-pro e guardamos o link de pagamento da AbacatePay pra
  // mostrar o passo de "ir pro pagamento" em vez de ir direto pro
  // dashboard.
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  // Sem isso, trocar de passo mantém a posição de rolagem de onde a
  // pessoa estava (ex: perto do botão "Continuar", lá embaixo do Passo
  // 1), cortando o título do passo novo lá em cima.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step, checkoutUrl]);
  const [isLoadingSearchAddressByZipCode, setIsLoadingSearchAddressByZipCode] =
    useState(false);

  const { control, handleSubmit, watch, setValue } = useForm<ISignUpFormData>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      workshopName: '',
      workshopCnpj: '',
      workshopPhone: '',
      workshopEmail: '',
      addressStreet: '',
      addressNumber: '',
      addressComplement: '',
      addressNeighborhood: '',
      addressCity: '',
      addressState: '',
      addressZipCode: '',
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '',
      plan: 'BASIC',
    },
  });

  const addressZipCodeField = watch('addressZipCode');

  // MUTATION SIGN UP
  const { mutateAsync: signUpMutate, isPending: isLoadingSignUp } = useMutation(
    {
      mutationFn: async ({
        workshopName,
        workshopCnpj,
        workshopPhone,
        workshopEmail,
        addressStreet,
        addressNumber,
        addressComplement,
        addressNeighborhood,
        addressCity,
        addressState,
        addressZipCode,
        ownerName,
        ownerEmail,
        ownerPassword,
      }: ISignUpFormData) => {
        await signUp({
          workshop: {
            name: workshopName,
            cnpj: workshopCnpj || null,
            phone: workshopPhone || null,
            email: workshopEmail || null,
            addressStreet: addressStreet || null,
            addressNumber: addressNumber || null,
            addressComplement: addressComplement || null,
            addressNeighborhood: addressNeighborhood || null,
            addressCity: addressCity || null,
            addressState: addressState || null,
            addressZipCode: addressZipCode || null,
          },
          user: {
            name: ownerName,
            email: ownerEmail,
            password: ownerPassword,
          },
        });
      },
      // "variables" é o segundo argumento que o TanStack Query sempre
      // passa pro onSuccess — o mesmo objeto (ISignUpFormData) que foi
      // passado pra mutateAsync. Usamos ele pra decidir o próximo passo
      // sem precisar guardar "plan" em outro lugar.
      onSuccess: async (_data, variables) => {
        // A conta já existe de verdade a partir daqui — qualquer erro no
        // upgrade pro Pro abaixo não desfaz o cadastro (signUp já teve
        // sucesso e já salvou o token).
        if (variables.plan === 'BASIC') {
          router.push('/dashboard');
          return;
        }

        try {
          const checkoutUrlResponse = await upgradeToProMutate();
          setCheckoutUrl(checkoutUrlResponse);
        } catch {
          toast.error(
            'Conta criada no plano Básico — não foi possível iniciar o pagamento do Pro agora. Você pode tentar de novo depois, em Configurações.',
            { position: 'bottom-center', autoClose: 7000 }
          );
          router.push('/dashboard');
        }
      },
    }
  );
  // END MUTATION SIGN UP

  // MUTATION UPGRADE TO PRO
  const { mutateAsync: upgradeToProMutate, isPending: isLoadingUpgradeToPro } =
    useMutation({
      mutationFn: async () => {
        const response = await api.post('/workshops/upgrade-to-pro');

        return response.data.checkout_url as string;
      },
    });
  // END MUTATION UPGRADE TO PRO

  // FUNCTIONS
  const handleContinueToStep2: SubmitHandler<ISignUpFormData> =
    useCallback(() => {
      setStep(2);
    }, []);

  // O objeto validado pelo Zod já bate exatamente com o que a mutation
  // espera, então basta repassar ele inteiro pro mutateAsync (mesmo
  // padrão de handleCreateAthleteSubmit em admin-web-amip) — o sucesso
  // (decidir entre /dashboard ou o checkout do Pro) já está no onSuccess
  // do signUpMutate, aqui só sobra tratar o erro de cadastro em si.
  const handleSignUp: SubmitHandler<ISignUpFormData> = useCallback(
    async (formData) => {
      try {
        await signUpMutate(formData);
      } catch (err) {
        // 400 aqui só tem 2 causas possíveis (ver
        // sign-up-workshop.controller.ts na API): CNPJ ou e-mail já
        // cadastrados. Mensagem genérica cobrindo as duas, em vez de
        // repetir o texto em inglês que a API devolve.
        if (err instanceof AxiosError && err.response?.status === 400) {
          toast.error(
            'Não foi possível concluir o cadastro: o CNPJ ou o e-mail informado já estão cadastrados.',
            { position: 'bottom-center', autoClose: 6000 }
          );
          return;
        }

        toast.error('Não foi possível concluir o cadastro. Tente novamente.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      }
    },
    [signUpMutate]
  );

  // Busca endereço via ViaCEP (mesmo padrão de admin-web-amip) — chamada
  // direta com axios, não pelo client "api" da aplicação, já que é um
  // host externo, sem autenticação. Rua/bairro/cidade/UF ficam travados
  // (disabled) na tela, só preenchidos por aqui.
  const handleSearchAddressByZipCode = useCallback(async () => {
    if (!addressZipCodeField) {
      toast.error('Informe um CEP pra buscar.', {
        position: 'bottom-center',
        autoClose: 4000,
      });
      return;
    }

    try {
      setIsLoadingSearchAddressByZipCode(true);

      const response = await axios.get(
        `https://viacep.com.br/ws/${addressZipCodeField}/json/`
      );

      const { logradouro, bairro, localidade, uf, erro } =
        response.data as IAddressViaCep;

      if (erro) {
        toast.error('CEP não encontrado.', {
          position: 'bottom-center',
          autoClose: 4000,
        });
        return;
      }

      setValue('addressStreet', logradouro);
      setValue('addressNeighborhood', bairro);
      setValue('addressCity', localidade);
      setValue('addressState', uf);
    } catch {
      toast.error('CEP inválido.', {
        position: 'bottom-center',
        autoClose: 4000,
      });
    } finally {
      setIsLoadingSearchAddressByZipCode(false);
    }
  }, [addressZipCodeField, setValue]);
  // END FUNCTIONS

  return (
    <AuthShell wide={step === 2}>
      <Head>
        <title>Criar conta | ArgilaAuto</title>
      </Head>

      <div className='mb-5 flex justify-center'>
        <Logo size={30} />
      </div>

      {!checkoutUrl && (
        <div className='mb-5 flex items-center justify-center gap-2'>
          {[1, 2].map((dot) => (
            <span
              key={dot}
              className={`h-2 rounded-full transition-all ${
                dot === step ? 'w-5 bg-clay' : 'w-2 bg-border-strong'
              }`}
            />
          ))}
        </div>
      )}

      {step === 1 && !checkoutUrl && (
        <>
          <h1 className='font-display text-center text-2xl font-bold'>
            Sobre a sua oficina
          </h1>
          <p className='mt-1 text-center text-[13px] text-text-muted'>
            Leva menos de 2 minutos.
          </p>

          <form onSubmit={handleSubmit(handleContinueToStep2)} noValidate>
            <p className='mt-6 mb-1 text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
              Sobre a oficina
            </p>
            <InputFormControl
              control={control}
              name='workshopName'
              label='Nome da oficina'
              placeholder='Ex: Oficina do João'
            />
            <div className='flex gap-3'>
              <div className='flex-1'>
                <InputMaskFormControl
                  control={control}
                  name='workshopCnpj'
                  label='CNPJ (opcional)'
                  mask='00.000.000/0000-00'
                  placeholder='00.000.000/0001-00'
                />
              </div>
              <div className='flex-1'>
                <InputMaskFormControl
                  control={control}
                  name='workshopPhone'
                  label='Telefone (opcional)'
                  mask='(00) 00000-0000'
                  placeholder='(11) 99999-9999'
                />
              </div>
            </div>
            <InputFormControl
              control={control}
              name='workshopEmail'
              label='E-mail da oficina (opcional)'
              type='email'
              placeholder='contato@suaoficina.com.br'
            />

            <p className='mt-6 mb-1 text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
              Endereço (opcional)
            </p>
            {/* CEP + busca via ViaCEP — mesmo padrão de admin-web-amip:
                preenche rua/bairro/cidade/UF sozinho, que por isso ficam
                "disabled" logo abaixo (só editáveis pelo resultado da
                busca, nunca digitados direto). */}
            <div className='flex items-end gap-3'>
              <div className='flex-1'>
                <InputMaskFormControl
                  control={control}
                  name='addressZipCode'
                  label='CEP'
                  mask='00000-000'
                  unmask={false}
                  placeholder='00000-000'
                />
              </div>
              <div className='mb-4'>
                <Button
                  type='button'
                  onClick={handleSearchAddressByZipCode}
                  disabled={isLoadingSearchAddressByZipCode}
                  className='w-auto! px-4'
                >
                  <MagnifyingGlass size={18} />
                </Button>
              </div>
            </div>
            <div className='flex gap-3'>
              <div className='flex-3'>
                <InputFormControl
                  control={control}
                  name='addressStreet'
                  label='Rua'
                  placeholder='Preenchido pelo CEP'
                  disabled
                />
              </div>
              <div className='flex-1'>
                <InputFormControl
                  control={control}
                  name='addressNumber'
                  label='Número'
                  placeholder='123'
                />
              </div>
            </div>
            <InputFormControl
              control={control}
              name='addressComplement'
              label='Complemento'
              placeholder='Sala, bloco, etc.'
            />
            <div className='flex gap-3'>
              <div className='flex-1'>
                <InputFormControl
                  control={control}
                  name='addressNeighborhood'
                  label='Bairro'
                  placeholder='Preenchido pelo CEP'
                  disabled
                />
              </div>
              <div className='flex-1'>
                <InputFormControl
                  control={control}
                  name='addressCity'
                  label='Cidade'
                  placeholder='Preenchido pelo CEP'
                  disabled
                />
              </div>
            </div>
            <div className='w-20'>
              <InputFormControl
                control={control}
                name='addressState'
                label='UF'
                placeholder='UF'
                disabled
              />
            </div>

            <p className='mt-6 mb-1 text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
              Seus dados de acesso
            </p>
            <InputFormControl
              control={control}
              name='ownerName'
              label='Seu nome'
              placeholder='Como podemos te chamar'
            />
            <InputFormControl
              control={control}
              name='ownerEmail'
              label='E-mail'
              type='email'
              placeholder='voce@suaoficina.com.br'
            />
            <InputFormControl
              control={control}
              name='ownerPassword'
              label='Senha'
              type='password'
              placeholder='Mínimo 8 caracteres'
            />

            <Button type='submit' className='mt-5'>
              Continuar
            </Button>
          </form>

          <p className='mt-4 text-center text-[13px] text-text-muted'>
            Já tem conta?{' '}
            <Link href='/login' className='font-bold text-clay-deep'>
              Entrar
            </Link>
          </p>
        </>
      )}

      {step === 2 && !checkoutUrl && (
        <>
          <h1 className='font-display text-center text-2xl font-bold'>
            Escolha o plano da sua oficina
          </h1>
          <p className='mt-1 text-center text-[13px] text-text-muted'>
            Dá pra trocar de plano quando quiser depois.
          </p>

          <form onSubmit={handleSubmit(handleSignUp)} noValidate>
            <Controller
              control={control}
              name='plan'
              render={({ field }) => (
                <RadioGroup.Root
                  value={field.value}
                  onValueChange={field.onChange}
                  className='mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2'
                >
                  <PlanCard
                    value='BASIC'
                    title='Básico'
                    description='R$ 89,90/mês — 7 dias de teste grátis'
                    features={[
                      'Ordens de serviço e orçamentos',
                      'Controle de estoque e produtos',
                      'Clientes e veículos ilimitados',
                      'Dashboard de faturamento',
                    ]}
                  />
                  <PlanCard
                    value='PRO'
                    title='Pro'
                    badge={
                      <>
                        <Sparkle size={12} weight='fill' /> Inteligência
                        Artificial
                      </>
                    }
                    description='R$ 179,90/mês'
                    features={[
                      'Tudo do plano Básico',
                      'Manutenção preventiva sugerida por IA',
                      'Resumo do serviço em linguagem simples pro cliente',
                      'Suporte prioritário',
                    ]}
                  />
                </RadioGroup.Root>
              )}
            />

            <Button
              type='submit'
              disabled={isLoadingSignUp || isLoadingUpgradeToPro}
              className='mt-6'
            >
              {isLoadingSignUp || isLoadingUpgradeToPro
                ? 'Criando...'
                : 'Criar minha conta'}
            </Button>
          </form>

          <div className='mt-4 text-center'>
            <button
              type='button'
              onClick={() => setStep(1)}
              className='inline-flex items-center gap-1.5 text-[13px] font-bold text-clay-deep'
            >
              <ArrowLeft size={14} />
              Voltar
            </button>
          </div>
        </>
      )}

      {checkoutUrl && (
        <div className='text-center'>
          <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-good'>
            <Check size={28} weight='bold' />
          </div>
          <h1 className='font-display text-2xl font-bold'>Conta criada!</h1>
          <p className='mt-2 text-[13px] leading-relaxed text-text-muted'>
            Sua oficina já existe no ArgilaAuto. Falta só confirmar o pagamento
            do plano Pro — você vai ser levado pra página segura da AbacatePay.
            Depois de concluir, volte aqui e faça login.
          </p>
          <Button
            onClick={() => {
              window.location.href = checkoutUrl;
            }}
            className='mt-5'
          >
            <span className='inline-flex items-center justify-center gap-2'>
              <CreditCard size={18} />
              Ir para o pagamento
            </span>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}

export const getServerSideProps = withSSRGuest(async () => {
  return {
    props: {},
  };
});
