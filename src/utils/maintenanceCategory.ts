// `MaintenanceCategory` da API (ver openapi.yaml, schemas `Part`/`Service`)
// — 17 valores, obrigatório nos dois cadastros desde o início. Categoriza
// peça/serviço pro insight de manutenção preventiva (plano Pro) poder
// cruzar com o histórico de OS do veículo — `OTHER` é a categoria
// explícita de quem não é rastreado (ex.: alinhamento, diagnóstico
// eletrônico), nunca fica sem categoria.
export const MAINTENANCE_CATEGORY_VALUES = [
  'MOTOR_OIL_CHANGE',
  'OIL_FILTER',
  'AIR_FILTER',
  'CABIN_AIR_FILTER',
  'FUEL_FILTER',
  'TIMING_BELT',
  'ACCESSORY_BELT',
  'BRAKE_PADS',
  'BRAKE_DISCS',
  'BRAKE_FLUID',
  'SPARK_PLUGS',
  'BATTERY',
  'COOLANT',
  'TRANSMISSION_FLUID',
  'TIRES',
  'SUSPENSION',
  'OTHER',
] as const;

export type IMaintenanceCategory = (typeof MAINTENANCE_CATEGORY_VALUES)[number];

// Tradução PT-BR — não existe em nenhum lugar da API (nomenclatura do
// contrato é toda em inglês, ver CLAUDE.md). Extraído do mapa que já
// existia só dentro de `dashboard/index.page.tsx` (bloco de Insights por
// IA, que usa os mesmos 16 valores rastreados, todos exceto `OTHER`) —
// o comentário de lá já previa essa extração "quando Produtos precisar
// dele"; mantida a mesma redação já em produção pra não ter dois rótulos
// diferentes pra a mesma categoria em telas diferentes. `OTHER` é o único
// rótulo novo, adicionado agora porque o Dashboard nunca precisou dele.
export const MAINTENANCE_CATEGORY_LABEL: Record<IMaintenanceCategory, string> =
  {
    MOTOR_OIL_CHANGE: 'Troca de óleo do motor',
    OIL_FILTER: 'Filtro de óleo',
    AIR_FILTER: 'Filtro de ar',
    CABIN_AIR_FILTER: 'Filtro de cabine',
    FUEL_FILTER: 'Filtro de combustível',
    TIMING_BELT: 'Correia dentada',
    ACCESSORY_BELT: 'Correia de acessórios',
    BRAKE_PADS: 'Pastilhas de freio',
    BRAKE_DISCS: 'Discos de freio',
    BRAKE_FLUID: 'Fluido de freio',
    SPARK_PLUGS: 'Velas de ignição',
    BATTERY: 'Bateria',
    COOLANT: 'Líquido de arrefecimento',
    TRANSMISSION_FLUID: 'Fluido de transmissão',
    TIRES: 'Pneus',
    SUSPENSION: 'Suspensão',
    OTHER: 'Outro',
  };

// Formato {value,label} que `SelectPicker` espera (ver
// src/components/Form/SelectPicker) — usado no cadastro/edição de Peça
// e Serviço (ver src/pages/produtos).
export const MAINTENANCE_CATEGORY_OPTIONS = MAINTENANCE_CATEGORY_VALUES.map(
  (value) => ({ value, label: MAINTENANCE_CATEGORY_LABEL[value] })
);
