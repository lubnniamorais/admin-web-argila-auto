// Papéis de EQUIPE (tela /equipe) — mesmos 3 valores que POST /users
// aceita pro papel do usuário novo (nunca SUPER_ADMIN, decisão de
// produto — ver CLAUDE.md da API). PUT /users tecnicamente aceita um 4º
// valor (SUPER_ADMIN) no enum, mas essa tela não oferece essa opção:
// SUPER_ADMIN é papel de plataforma, sem workshop própria, não faz
// sentido promover alguém da equipe pra esse papel por aqui (decisão
// confirmada com o usuário).
export const TEAM_ROLE_VALUES = ['ADMIN', 'RECEPTIONIST', 'MECHANIC'] as const;

export type ITeamRole = (typeof TEAM_ROLE_VALUES)[number];

export const TEAM_ROLE_LABEL: Record<ITeamRole, string> = {
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Recepção',
  MECHANIC: 'Mecânico',
};

// Formato {value,label} que SelectPicker espera (ver
// src/components/Form/SelectPicker), mesmo padrão de
// MAINTENANCE_CATEGORY_OPTIONS.
export const TEAM_ROLE_OPTIONS = TEAM_ROLE_VALUES.map((value) => ({
  value,
  label: TEAM_ROLE_LABEL[value],
}));
