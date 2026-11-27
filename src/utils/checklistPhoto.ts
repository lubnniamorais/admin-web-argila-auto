// Enums de POST/GET /service-orders/{id}/checklist-photos (openapi.yaml,
// api-argila-auto) — usados pelo seletor de fase (SegmentedControl,
// Entrada/Saída) e pelo dropdown de categoria do formulário de upload em
// ServiceOrderDetailsModal, ver CLAUDE.md "Fotos de checklist".
export const CHECKLIST_PHASE_VALUES = ['CHECK_IN', 'CHECK_OUT'] as const;

export type IChecklistPhase = (typeof CHECKLIST_PHASE_VALUES)[number];

export const CHECKLIST_PHASE_LABEL: Record<IChecklistPhase, string> = {
  CHECK_IN: 'Entrada',
  CHECK_OUT: 'Saída',
};

export const CHECKLIST_PHOTO_CATEGORY_VALUES = [
  'EXTERIOR_BODY',
  'TIRES_WHEELS',
  'INTERIOR',
  'DASHBOARD_PANEL',
  'DOCUMENTS_ACCESSORIES',
  'OTHER',
] as const;

export type IChecklistPhotoCategory =
  (typeof CHECKLIST_PHOTO_CATEGORY_VALUES)[number];

export const CHECKLIST_PHOTO_CATEGORY_LABEL: Record<
  IChecklistPhotoCategory,
  string
> = {
  EXTERIOR_BODY: 'Lataria/carroceria',
  TIRES_WHEELS: 'Pneus/rodas',
  INTERIOR: 'Interior',
  DASHBOARD_PANEL: 'Painel',
  DOCUMENTS_ACCESSORIES: 'Documentos/acessórios',
  OTHER: 'Outro',
};

// Pro SelectPickerFormControl do formulário de upload — mesmo formato de
// PAYMENT_METHOD_OPTIONS/MAINTENANCE_CATEGORY_OPTIONS.
export const CHECKLIST_PHOTO_CATEGORY_OPTIONS =
  CHECKLIST_PHOTO_CATEGORY_VALUES.map((value) => ({
    value,
    label: CHECKLIST_PHOTO_CATEGORY_LABEL[value],
  }));
