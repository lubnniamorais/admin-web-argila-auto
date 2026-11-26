import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z as zod } from 'zod';

import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Form/Button';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { api } from '@/lib/apiClient';

// Mesmo padrão de /reset-password (ver reset-password/index.page.tsx):
// pede confirmação da senha nova (passwordConfirmation) além do campo em
// si — decisão confirmada com o usuário em 24/11/2026, reaproveitando o
// precedente que já existia nessa outra tela, só que aqui também exige a
// senha ATUAL (PATCH /users/password troca a senha do próprio usuário
// logado, diferente de /password/reset que vem de um link de e-mail — por
// isso aqui precisa confirmar que é a pessoa dona da conta).
const changePasswordFormSchema = zod
  .object({
    oldPassword: zod.string().min(1, 'Informe sua senha atual'),
    password: zod
      .string()
      .min(8, 'A senha precisa ter pelo menos 8 caracteres'),
    passwordConfirmation: zod.string().min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'As senhas não coincidem',
    path: ['passwordConfirmation'],
  });

type IChangePasswordFormData = zod.infer<typeof changePasswordFormSchema>;

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Modal de trocar a própria senha — aberto clicando no avatar/nome do
// rodapé da sidebar (ver AppShell/index.tsx). Decisão confirmada com o
// usuário: um modal à parte, fora de Configurações (que tem 2 das 3
// seções restritas a ADMIN — trocar a própria senha é ação pessoal,
// qualquer papel deve conseguir fazer, então não faz sentido morar atrás
// desse gate).
export function ChangePasswordModal({
  open,
  onOpenChange,
}: ChangePasswordModalProps) {
  const { control, handleSubmit, reset } = useForm<IChangePasswordFormData>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { oldPassword: '', password: '', passwordConfirmation: '' },
  });

  // MUTATION CHANGE PASSWORD
  const { mutateAsync: changePasswordMutate, isPending: isLoadingChange } =
    useMutation({
      mutationFn: async ({
        oldPassword,
        password,
      }: IChangePasswordFormData) => {
        // PATCH /users/password espera old_password/password (snake_case,
        // igual ao resto do contrato da API) — ver openapi.yaml.
        await api.patch('/users/password', {
          old_password: oldPassword,
          password,
        });
      },
      onSuccess: () => {
        toast.success('Senha atualizada com sucesso.', {
          position: 'bottom-center',
          autoClose: 4000,
        });

        reset();
        onOpenChange(false);
      },
      onError: (error) => {
        // 409 é o único erro de domínio documentado pra essa rota (senha
        // atual incorreta, ou usuário não encontrado — este segundo caso
        // não deveria acontecer numa sessão autenticada de verdade, mas a
        // API devolve a mesma mensagem genérica pros dois, então não dá
        // pra diferenciar aqui — ver "Nunca mostrar a mensagem de erro
        // crua da API" no CLAUDE.md).
        const message =
          error instanceof AxiosError && error.response?.status === 409
            ? 'Senha atual incorreta.'
            : 'Não foi possível atualizar a senha. Tente novamente.';

        toast.error(message, { position: 'bottom-center', autoClose: 5000 });
      },
    });
  // END MUTATION CHANGE PASSWORD

  const handleChangePassword: SubmitHandler<IChangePasswordFormData> = async (
    formData
  ) => {
    try {
      await changePasswordMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);

        // Fechou sem salvar (Esc, clique fora, botão X) — limpa os 3
        // campos, pra nunca deixar uma senha já digitada visível (mesmo
        // que escondida pelo toggle de mostrar/esconder) se a pessoa
        // reabrir o modal depois.
        if (!nextOpen) {
          reset();
        }
      }}
      title='Trocar senha'
      description='Pra sua própria conta — informe a senha atual pra confirmar.'
    >
      <form onSubmit={handleSubmit(handleChangePassword)} noValidate>
        <InputFormControl
          control={control}
          name='oldPassword'
          label='Senha atual'
          type='password'
        />

        <InputFormControl
          control={control}
          name='password'
          label='Nova senha'
          type='password'
          placeholder='Mínimo 8 caracteres'
        />

        <InputFormControl
          control={control}
          name='passwordConfirmation'
          label='Confirmar nova senha'
          type='password'
          placeholder='Repita a senha nova'
        />

        <div className='mt-6'>
          <Button type='submit' disabled={isLoadingChange}>
            {isLoadingChange ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
