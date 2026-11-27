// Mesmo enum PaymentMethod do openapi.yaml (api-argila-auto) — usado só
// pelo formulário de registrar pagamento e pela lista de pagamentos no
// ServiceOrderDetailsModal (ver "Pagamentos em Ordens de Serviço").
// Array `as const` em vez de union direta — mesmo padrão de
// TEAM_ROLE_VALUES (utils/role.ts), precisa disso pra usar
// `zod.enum(PAYMENT_METHOD_VALUES)` no schema do formulário.
export const PAYMENT_METHOD_VALUES = [
  'CASH',
  'PIX',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'BOLETO',
  'BANK_TRANSFER',
] as const;

export type IPaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

export const PAYMENT_METHOD_LABEL: Record<IPaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BOLETO: 'Boleto',
  BANK_TRANSFER: 'Transferência bancária',
};

// Pro SelectPickerFormControl do formulário de registrar pagamento —
// mesmo formato de MAINTENANCE_CATEGORY_OPTIONS/TEAM_ROLE_OPTIONS.
export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHOD_VALUES.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));
