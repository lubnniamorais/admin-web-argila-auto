import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Head from 'next/head';
import { MagnifyingGlass, Pencil, Plus, Trash } from 'phosphor-react';
import { useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { z as zod } from 'zod';

import { AppShell } from '@/components/AppShell';
import { Dialog } from '@/components/Dialog';
import { AlertDialog } from '@/components/Form/AlertDialog';
import { Button, buttonClassName } from '@/components/Form/Button';
import { InputFormControl } from '@/components/Form/InputFormControl';
import { SelectPickerFormControl } from '@/components/Form/SelectPickerFormControl';
import { SwitchFormControl } from '@/components/Form/SwitchFormControl';
import { Pagination } from '@/components/Pagination';
import { ITeamUser, useUsers } from '@/hooks/users';
import { api } from '@/lib/apiClient';
import { usePermissions } from '@/utils/permissions';
import {
  TEAM_ROLE_LABEL,
  TEAM_ROLE_OPTIONS,
  TEAM_ROLE_VALUES,
} from '@/utils/role';
import { withSSRAuth } from '@/utils/withSSRAuth';

// ============ SCHEMA: CADASTRAR USUÁRIO ============
// Mesmos 4 campos que POST /users exige (name/email/password/role) — ver
// openapi.yaml da API.
const createUserFormSchema = zod.object({
  name: zod.string().trim().min(1, 'Informe o nome'),
  email: zod.string().trim().email('E-mail inválido'),
  password: zod.string().min(8, 'Mínimo 8 caracteres'),
  role: zod.enum(TEAM_ROLE_VALUES, { message: 'Selecione o papel' }),
});

type ICreateUserFormData = zod.infer<typeof createUserFormSchema>;
// ============ FIM SCHEMA: CADASTRAR USUÁRIO ============

// ============ SCHEMA: EDITAR USUÁRIO ============
// `password` não entra aqui — PUT /users não aceita trocar senha de
// outra pessoa (só PATCH /users/password, e só a própria senha, logado).
const editUserFormSchema = zod.object({
  name: zod.string().trim().min(1, 'Informe o nome'),
  email: zod.string().trim().email('E-mail inválido'),
  active: zod.boolean(),
  role: zod.enum(TEAM_ROLE_VALUES, { message: 'Selecione o papel' }),
});

type IEditUserFormData = zod.infer<typeof editUserFormSchema>;
// ============ FIM SCHEMA: EDITAR USUÁRIO ============

const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;

function RoleBadge({ role }: { role: ITeamUser['role'] }) {
  return (
    <span className='inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-text-muted'>
      {TEAM_ROLE_LABEL[role as keyof typeof TEAM_ROLE_LABEL] ?? role}
    </span>
  );
}

export default function EquipePage() {
  const queryClient = useQueryClient();
  const { canManageTeam } = usePermissions();

  // FUNCTIONS
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchParam, setSearchParam] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchParam(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // GET /users já exclui o próprio usuário autenticado do resultado
  // (decisão pré-existente do repositório Prisma, não mexida nesta
  // sessão — ver prisma-users-repository.ts, `id: { not:
  // authenticateUserId }`) — por isso esta tela nunca mostra o ADMIN
  // logado, só o resto da equipe que ele convidou. Decisão confirmada
  // com o usuário: manter como está, sem badge "Você" nem lógica de
  // "esconder ações na própria linha" (nunca seriam usadas).
  const { data: usersData, isLoading: isLoadingUsers } = useUsers({
    page,
    perPage: PER_PAGE,
    searchParam,
    enabled: canManageTeam,
  });
  // END FUNCTIONS

  // ============ MODAL: CADASTRAR USUÁRIO ============
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
  } = useForm<ICreateUserFormData>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      // '' força a pessoa a escolher ativamente (decisão confirmada com
      // o usuário) — nenhum dos 3 papéis é "mais provável" o suficiente
      // pra vir pré-selecionado. Cast necessário porque o tipo do campo
      // é o enum (ADMIN/RECEPTIONIST/MECHANIC), não aceita '' de
      // verdade — mesmo racional de '' as unknown as number em
      // produtos/index.page.tsx pros campos numéricos obrigatórios.
      role: '' as unknown as ICreateUserFormData['role'],
    },
  });

  // MUTATION CREATE USER
  const { mutateAsync: createUserMutate, isPending: isLoadingCreate } =
    useMutation({
      mutationFn: async ({
        name,
        email,
        password,
        role,
      }: ICreateUserFormData) => {
        await api.post('/users', { name, email, password, role });
      },
      onSuccess: () => {
        toast.success('Usuário convidado pra equipe.', {
          position: 'bottom-center',
          autoClose: 4000,
        });

        queryClient.invalidateQueries({ queryKey: ['users'] });
        setIsCreateModalOpen(false);
        resetCreateForm();
      },
      onError: (error) => {
        const message =
          axios.isAxiosError(error) && error.response?.status === 400
            ? 'Já existe um usuário com esse e-mail.'
            : 'Não foi possível cadastrar o usuário.';

        toast.error(message, { position: 'bottom-center', autoClose: 5000 });
      },
    });
  // END MUTATION CREATE USER

  const handleCreateUser: SubmitHandler<ICreateUserFormData> = async (
    formData
  ) => {
    try {
      await createUserMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM MODAL: CADASTRAR USUÁRIO ============

  // ============ MODAL: EDITAR USUÁRIO ============
  const [editingUser, setEditingUser] = useState<ITeamUser | null>(null);

  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
  } = useForm<IEditUserFormData>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      name: '',
      email: '',
      active: true,
      role: 'RECEPTIONIST',
    },
  });

  useEffect(() => {
    if (!editingUser) {
      return;
    }

    resetEditForm({
      name: editingUser.name,
      email: editingUser.email,
      active: editingUser.active,
      role: editingUser.role as IEditUserFormData['role'],
    });
  }, [editingUser, resetEditForm]);

  // MUTATION UPDATE USER
  const { mutateAsync: updateUserMutate, isPending: isLoadingEdit } =
    useMutation({
      mutationFn: async ({ name, email, active, role }: IEditUserFormData) => {
        if (!editingUser) {
          return;
        }

        await api.put('/users', {
          id: editingUser.id,
          name,
          email,
          active,
          role,
        });
      },
      onSuccess: () => {
        toast.success('Usuário atualizado.', {
          position: 'bottom-center',
          autoClose: 4000,
        });

        queryClient.invalidateQueries({ queryKey: ['users'] });
        setEditingUser(null);
      },
      onError: (error) => {
        // "E-mail already in use!" vem em {message} (403); as outras
        // causas de 403 (não ser ADMIN, trocar a própria role) nunca
        // deveriam acontecer por esta tela — GET /users já exclui o
        // próprio usuário autenticado da lista (ver hooks/users.ts), então
        // esta tela nunca abre o modal de editar pra si mesmo — ficam só
        // no fallback genérico.
        const message =
          axios.isAxiosError(error) && error.response?.status === 403
            ? 'Já existe outro usuário com esse e-mail.'
            : 'Não foi possível salvar as alterações.';

        toast.error(message, { position: 'bottom-center', autoClose: 5000 });
      },
    });
  // END MUTATION UPDATE USER

  const handleEditUser: SubmitHandler<IEditUserFormData> = async (formData) => {
    try {
      await updateUserMutate(formData);
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM MODAL: EDITAR USUÁRIO ============

  // ============ EXCLUIR USUÁRIO ============
  // Mesmo padrão de clientes-veiculos: `null` = nenhum pedido de exclusão
  // em andamento; um ITeamUser = o AlertDialog está aberto pra ESSE
  // usuário.
  const [userToDelete, setUserToDelete] = useState<ITeamUser | null>(null);

  // MUTATION DELETE USER
  const { mutateAsync: deleteUserMutate, isPending: isLoadingDelete } =
    useMutation({
      mutationFn: async () => {
        if (!userToDelete) {
          return;
        }

        await api.delete(`/users/${userToDelete.id}`);
      },
      onSuccess: () => {
        toast.success('Usuário removido da equipe.', {
          position: 'bottom-center',
          autoClose: 4000,
        });

        queryClient.invalidateQueries({ queryKey: ['users'] });
        setUserToDelete(null);
      },
      onError: () => {
        toast.error('Não foi possível remover o usuário.', {
          position: 'bottom-center',
          autoClose: 5000,
        });
      },
    });
  // END MUTATION DELETE USER

  const handleDeleteUser = async () => {
    try {
      await deleteUserMutate();
    } catch {
      // erro já tratado no onError da mutation acima.
    }
  };
  // ============ FIM EXCLUIR USUÁRIO ============

  return (
    <AppShell title='Equipe' subtitle='Quem tem acesso à sua oficina'>
      <Head>
        <title>Equipe | ArgilaAuto</title>
      </Head>

      {/* ADMIN only (canManageTeam) — mesmo padrão de /configuracoes pro
          MECHANIC: a tela não depende só do item sumir do Menubar, bloqueia
          acesso direto por URL também. */}
      {canManageTeam && (
        <div className='rounded-[10px] border border-border bg-surface p-5'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='relative w-full sm:max-w-xs'>
              <MagnifyingGlass
                size={16}
                className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted'
              />
              <input
                type='text'
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder='Buscar por nome, e-mail...'
                className='w-full rounded-[9px] border border-border-strong bg-background py-2.5 pr-3.5 pl-9 text-sm text-foreground outline-none focus:outline-2 focus:outline-clay focus:outline-offset-1'
              />
            </div>

            <button
              type='button'
              onClick={() => setIsCreateModalOpen(true)}
              className={buttonClassName('primary', 'w-auto px-5')}
            >
              <span className='inline-flex items-center gap-2'>
                <Plus size={18} />
                Convidar pra equipe
              </span>
            </button>
          </div>

          {!usersData || usersData.users.length === 0 ? (
            <p className='mt-5 py-6 text-center text-text-muted'>
              {isLoadingUsers
                ? 'Carregando...'
                : searchParam
                  ? 'Nenhum usuário encontrado pra essa busca.'
                  : 'Nenhum usuário cadastrado ainda.'}
            </p>
          ) : (
            <>
              {/* ===== TABELA (telas largas) ===== */}
              <div className='mt-5 max-[880px]:hidden overflow-x-auto'>
                <table className='w-full border-collapse text-[13.5px]'>
                  <thead>
                    <tr className='border-b border-border text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                      <th className='pb-2 pr-3'>Nome</th>
                      <th className='pb-2 pr-3'>E-mail</th>
                      <th className='pb-2 pr-3'>Papel</th>
                      <th className='pb-2'>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersData.users.map((teamUser) => {
                      return (
                        <tr
                          key={teamUser.id}
                          className='border-b border-border last:border-0 align-top'
                        >
                          <td className='py-2.5 pr-3 font-semibold'>
                            {teamUser.name}
                          </td>
                          <td className='py-2.5 pr-3 text-text-muted'>
                            {teamUser.email}
                          </td>
                          <td className='py-2.5 pr-3'>
                            <RoleBadge role={teamUser.role} />
                          </td>
                          <td className='py-2.5'>
                            {canManageTeam && (
                              <div className='flex items-center gap-3'>
                                <button
                                  type='button'
                                  onClick={() => setEditingUser(teamUser)}
                                  aria-label={`Editar ${teamUser.name}`}
                                  className='text-text-muted transition-colors hover:text-clay'
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type='button'
                                  onClick={() => setUserToDelete(teamUser)}
                                  aria-label={`Remover ${teamUser.name}`}
                                  className='text-text-muted transition-colors hover:text-crit'
                                >
                                  <Trash size={15} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ===== CARDS (telas estreitas) ===== */}
              <div className='mt-5 hidden max-[880px]:flex flex-col gap-3'>
                {usersData.users.map((teamUser) => {
                  return (
                    <div
                      key={teamUser.id}
                      className='rounded-[10px] border border-border p-4'
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <p className='font-semibold'>{teamUser.name}</p>
                          <p className='mt-0.5 text-[12.5px] text-text-muted'>
                            {teamUser.email}
                          </p>
                          <div className='mt-1.5'>
                            <RoleBadge role={teamUser.role} />
                          </div>
                        </div>
                        {canManageTeam && (
                          <div className='flex shrink-0 items-center gap-3'>
                            <button
                              type='button'
                              onClick={() => setEditingUser(teamUser)}
                              aria-label={`Editar ${teamUser.name}`}
                              className='text-text-muted transition-colors hover:text-clay'
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type='button'
                              onClick={() => setUserToDelete(teamUser)}
                              aria-label={`Remover ${teamUser.name}`}
                              className='text-text-muted transition-colors hover:text-crit'
                            >
                              <Trash size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {usersData && usersData.totalCount > 0 && (
            <Pagination
              pageCurrent={page}
              totalCount={usersData.totalCount}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {!canManageTeam && (
        <div className='rounded-[10px] border border-border bg-surface p-10 text-center shadow-[0_1px_2px_rgba(43,36,32,0.06),0_8px_24px_-12px_rgba(43,36,32,0.14)]'>
          <h3 className='font-display text-lg font-bold'>
            Sem acesso a esta página
          </h3>
          <p className='mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-text-muted'>
            Gestão de equipe é restrita a administradores.
          </p>
        </div>
      )}

      {/* ===== MODAL: CADASTRAR USUÁRIO ===== */}
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title='Convidar pra equipe'
        description='Cria um acesso novo pra essa oficina.'
      >
        <form onSubmit={handleCreateSubmit(handleCreateUser)} noValidate>
          <InputFormControl
            control={createControl}
            name='name'
            label='Nome'
            placeholder='Ana Maria'
          />

          <InputFormControl
            control={createControl}
            name='email'
            label='E-mail'
            type='email'
            placeholder='ana@suaoficina.com.br'
          />

          <InputFormControl
            control={createControl}
            name='password'
            label='Senha'
            type='password'
            placeholder='Mínimo 8 caracteres'
          />

          <SelectPickerFormControl
            control={createControl}
            name='role'
            label='Papel'
            placeholder='Selecione'
            data={TEAM_ROLE_OPTIONS}
          />

          <div className='mt-6'>
            <Button type='submit' disabled={isLoadingCreate}>
              {isLoadingCreate ? 'Convidando...' : 'Convidar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ===== MODAL: EDITAR USUÁRIO ===== */}
      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUser(null);
          }
        }}
        title='Editar usuário'
        description='Desativar impede o login, sem apagar o histórico associado.'
      >
        <form onSubmit={handleEditSubmit(handleEditUser)} noValidate>
          <InputFormControl
            control={editControl}
            name='name'
            label='Nome'
            placeholder='Ana Maria'
          />

          <InputFormControl
            control={editControl}
            name='email'
            label='E-mail'
            type='email'
            placeholder='ana@suaoficina.com.br'
          />

          <SelectPickerFormControl
            control={editControl}
            name='role'
            label='Papel'
            placeholder='Selecione'
            data={TEAM_ROLE_OPTIONS}
          />

          <SwitchFormControl
            control={editControl}
            name='active'
            label='Usuário ativo'
            description='Desativar impede o login imediatamente.'
          />

          <div className='mt-6'>
            <Button type='submit' disabled={isLoadingEdit}>
              {isLoadingEdit ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ===== CONFIRMAR EXCLUSÃO DE USUÁRIO ===== */}
      <AlertDialog
        open={userToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUserToDelete(null);
          }
        }}
        title='Remover da equipe'
        description={
          userToDelete
            ? `Tem certeza que quer remover ${userToDelete.name} da equipe? Nome e e-mail são anonimizados e essa pessoa não vai mais conseguir entrar no sistema.`
            : ''
        }
        tone='destructive'
        confirmLabel='Remover'
        confirmLoadingLabel='Removendo...'
        isLoading={isLoadingDelete}
        onConfirm={handleDeleteUser}
      />
    </AppShell>
  );
}

export const getServerSideProps = withSSRAuth(async () => {
  return {
    props: {},
  };
});
