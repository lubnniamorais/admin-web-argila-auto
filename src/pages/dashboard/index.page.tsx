import { format } from '@formkit/tempo';
import Head from 'next/head';
import Link from 'next/link';
import {
  ClipboardText,
  LockSimple,
  Sparkle,
  TrendUp,
  TrendDown,
} from 'phosphor-react';
import { ReactNode, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AppShell } from '@/components/AppShell';
import { buttonClassName } from '@/components/Form/Button';
import { useCustomers } from '@/hooks/customers';
import {
  IMonthlyPaymentsReportItem,
  useLowStockParts,
  useMonthlyPaymentsReport,
  usePreventiveMaintenanceInsight,
  useRecentServiceOrders,
  useServiceOrdersSummary,
} from '@/hooks/dashboard';
import { useWorkshop } from '@/hooks/workshop';
import {
  ORDER_STATUS_BADGE_CLASSNAME,
  ORDER_STATUS_LABEL,
} from '@/utils/orderStatus';
import { withSSRAuth } from '@/utils/withSSRAuth';

// Mesmos 16 valores rastreados de `MaintenanceCategory` (todos exceto
// `OTHER`, que nunca entra no insight — ver openapi.yaml,
// VehiclePreventiveMaintenanceInsight). Mapa só usado aqui por enquanto;
// se "Produtos" precisar dele mais pra frente (cadastro de peça/serviço),
// vale extrair pra um util compartilhado nesse momento.
const MAINTENANCE_CATEGORY_LABEL: Record<string, string> = {
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
};

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Formato compacto pro eixo Y do gráfico (ex.: 120 -> "120", 22000 ->
// "22 mil") — evita o "0k" que apareceria pra valores abaixo de 1000 com
// uma divisão fixa por 1000 (ex.: faturamento ainda baixo, workshop nova).
function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

// "2026-10" -> "Out" (mês curto em PT-BR, primeira letra maiúscula pro
// eixo do gráfico).
function formatMonthShortLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00`);
  const label = format(date, 'MMM', 'pt-BR');

  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ============ KPI CARD ============
interface IKpiCardProps {
  label: string;
  value: ReactNode;
  delta: ReactNode;
  deltaTone: 'up' | 'down' | 'muted';
}

const KPI_DELTA_TONE_CLASSNAME: Record<IKpiCardProps['deltaTone'], string> = {
  up: 'text-good',
  down: 'text-crit',
  muted: 'text-text-muted',
};

function KpiCard({ label, value, delta, deltaTone }: IKpiCardProps) {
  return (
    <div className='rounded-[10px] border border-border bg-surface p-5'>
      <div className='text-[12px] font-bold uppercase tracking-[0.04em] text-text-muted'>
        {label}
      </div>
      <div className='mt-1.5 font-display text-[26px] font-bold'>{value}</div>
      <div
        className={`mt-1 text-[12.5px] font-semibold ${KPI_DELTA_TONE_CLASSNAME[deltaTone]}`}
      >
        {delta}
      </div>
    </div>
  );
}
// ============ FIM KPI CARD ============

export default function DashboardPage() {
  const { data: workshop } = useWorkshop();
  const isPro = workshop?.subscription.plan === 'PRO';

  const { data: summary } = useServiceOrdersSummary();
  const { data: lowStockParts } = useLowStockParts();
  const { data: monthlyReport } = useMonthlyPaymentsReport(6);
  const { data: recentServiceOrders } = useRecentServiceOrders(5);
  const { data: preventiveInsight } = usePreventiveMaintenanceInsight(
    Boolean(isPro)
  );
  // Só pra saber se a oficina já tem algum cliente — não interessa o
  // conteúdo da página, por isso perPage=1 (o mínimo que ainda devolve o
  // header x-total-count-registers). Ver `hasAnyCustomer` abaixo: o
  // estado vazio do Dashboard depende de CLIENTE existir, não de OS (uma
  // oficina pode ter clientes cadastrados e ainda nenhuma OS — nesse
  // caso o Dashboard de verdade, com KPIs zerados, é mais correto que a
  // tela de boas-vindas, que promete "cadastre seu primeiro cliente").
  const { data: customersCheck } = useCustomers({ page: 1, perPage: 1 });

  // FUNCTIONS
  const chartData = useMemo(
    () =>
      (monthlyReport ?? []).map((item: IMonthlyPaymentsReportItem) => ({
        month: formatMonthShortLabel(item.month),
        total: item.total_received,
      })),
    [monthlyReport]
  );

  const currentMonthRevenue = monthlyReport?.at(-1)?.total_received ?? 0;
  const previousMonthRevenue = monthlyReport?.at(-2)?.total_received;

  // Sem mês anterior pra comparar (workshop muito nova): não mostra
  // variação nenhuma, em vez de inventar uma divisão por zero.
  const revenueVariationPercent =
    previousMonthRevenue !== undefined
      ? previousMonthRevenue === 0
        ? null
        : ((currentMonthRevenue - previousMonthRevenue) /
            previousMonthRevenue) *
          100
      : null;

  const lowStockCount = lowStockParts?.length ?? 0;
  // END FUNCTIONS

  const hasAnyCustomer = (customersCheck?.totalCount ?? 0) > 0;

  return (
    <AppShell title='Dashboard' subtitle='Visão geral da oficina hoje'>
      <Head>
        <title>Dashboard | ArgilaAuto</title>
      </Head>

      {customersCheck && !hasAnyCustomer ? (
        <div className='rounded-[10px] border border-border bg-surface p-10 text-center shadow-[0_1px_2px_rgba(43,36,32,0.06),0_8px_24px_-12px_rgba(43,36,32,0.14)]'>
          <h3 className='font-display text-lg font-bold'>
            Sua oficina ainda está vazia
          </h3>
          <p className='mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-text-muted'>
            Cadastre seu primeiro cliente e crie a primeira Ordem de Serviço pra
            começar a ver os números aparecerem aqui.
          </p>
          <Link
            href='/clientes-veiculos'
            className={`mt-5 inline-flex ${buttonClassName('primary', 'w-auto px-5')}`}
          >
            Cadastrar primeiro cliente
          </Link>
        </div>
      ) : (
        <>
          {/* ===== KPIs ===== */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <KpiCard
              label='OS em aberto'
              value={summary?.open_orders_count ?? '—'}
              delta={`de ${recentServiceOrders?.totalCount ?? '—'} no total`}
              deltaTone='muted'
            />
            <KpiCard
              label='Faturamento do mês'
              value={formatCurrencyBRL(currentMonthRevenue)}
              delta={
                revenueVariationPercent === null ? (
                  'sem comparativo ainda'
                ) : (
                  <span className='inline-flex items-center gap-1'>
                    {revenueVariationPercent >= 0 ? (
                      <TrendUp size={13} weight='bold' />
                    ) : (
                      <TrendDown size={13} weight='bold' />
                    )}
                    {Math.abs(revenueVariationPercent).toFixed(1)}% vs. mês
                    anterior
                  </span>
                )
              }
              deltaTone={
                revenueVariationPercent === null
                  ? 'muted'
                  : revenueVariationPercent >= 0
                    ? 'up'
                    : 'down'
              }
            />
            <KpiCard
              label='Ticket médio'
              value={formatCurrencyBRL(
                summary?.current_month_average_ticket ?? 0
              )}
              delta='por ordem de serviço'
              deltaTone='muted'
            />
            <KpiCard
              label='Peças em estoque baixo'
              value={lowStockCount}
              delta={
                <Link
                  href='/produtos'
                  className='underline-offset-2 hover:underline'
                >
                  {lowStockCount > 0 ? 'requer reposição' : 'tudo normal'}
                </Link>
              }
              deltaTone={lowStockCount > 0 ? 'down' : 'up'}
            />
          </div>

          {/* ===== GRÁFICO + INSIGHTS IA ===== */}
          <div className='mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2'>
            <div className='rounded-[10px] border border-border bg-surface p-5'>
              <h3 className='font-display text-[15px] font-bold'>
                Faturamento — últimos 6 meses
              </h3>
              <div className='mt-4 h-55'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      stroke='var(--border)'
                      vertical={false}
                    />
                    <XAxis
                      dataKey='month'
                      stroke='var(--text-muted)'
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke='var(--text-muted)'
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatCompactNumber}
                      width={40}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--surface-2)' }}
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                      formatter={(value) => formatCurrencyBRL(Number(value))}
                    />
                    <Bar
                      dataKey='total'
                      fill='var(--clay)'
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {isPro ? (
              <div className='rounded-[10px] border border-border bg-surface p-5'>
                <div className='flex items-center gap-2'>
                  <Sparkle size={17} weight='fill' className='text-clay' />
                  <h3 className='font-display text-[15px] font-bold'>
                    Insights por IA
                  </h3>
                  <span className='rounded-full bg-clay-soft px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-clay-deep'>
                    Pro
                  </span>
                </div>

                {!preventiveInsight || preventiveInsight.length === 0 ? (
                  <p className='mt-3 text-[13px] text-text-muted'>
                    Nenhum veículo com manutenção preventiva prevista no
                    momento.
                  </p>
                ) : (
                  <ul className='mt-3 flex flex-col gap-2.5 text-[13px] leading-relaxed'>
                    {preventiveInsight
                      .slice(0, 5)
                      .map(({ vehicle, categories }) => {
                        const [mostUrgent] = categories;

                        return (
                          <li key={vehicle.id}>
                            <span className='font-bold'>
                              {vehicle.brand} {vehicle.model}
                              {vehicle.year ? ` ${vehicle.year}` : ''}
                            </span>{' '}
                            —{' '}
                            {MAINTENANCE_CATEGORY_LABEL[mostUrgent.category] ??
                              mostUrgent.category}
                            :{' '}
                            {mostUrgent.status === 'OVERDUE'
                              ? `atrasada${
                                  mostUrgent.km_remaining !== null
                                    ? ` há ${Math.abs(mostUrgent.km_remaining).toLocaleString('pt-BR')} km`
                                    : ''
                                }`
                              : `vence em breve${
                                  mostUrgent.km_remaining !== null
                                    ? ` (${mostUrgent.km_remaining.toLocaleString('pt-BR')} km)`
                                    : ''
                                }`}
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            ) : (
              <div className='flex flex-col items-center justify-center gap-3 rounded-[10px] border border-border bg-surface p-6 text-center'>
                <LockSimple size={26} className='text-text-muted' />
                <p className='max-w-xs text-[13px] text-text-muted'>
                  <span className='font-bold text-text'>Insights por IA</span>{' '}
                  disponível no plano Pro — a IA cruza quilometragem e histórico
                  pra avisar quando um cliente provavelmente precisa de
                  manutenção.
                </p>
                <Link
                  href='/configuracoes'
                  className={buttonClassName('primary', 'w-auto px-5')}
                >
                  <span className='inline-flex items-center gap-2'>
                    <Sparkle size={16} />
                    Fazer upgrade pro Pro
                  </span>
                </Link>
              </div>
            )}
          </div>

          {/* ===== OS RECENTES ===== */}
          <div className='mt-5 rounded-[10px] border border-border bg-surface p-5'>
            <h3 className='font-display text-[15px] font-bold'>
              Ordens de serviço recentes
            </h3>

            {!recentServiceOrders ||
            recentServiceOrders.serviceOrders.length === 0 ? (
              <p className='mt-3 text-[13px] text-text-muted'>
                Nenhuma ordem de serviço ainda.
              </p>
            ) : (
              <div className='mt-3 overflow-x-auto'>
                <table className='w-full border-collapse text-[13.5px]'>
                  <thead>
                    <tr className='border-b border-border text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-text-muted'>
                      <th className='pb-2 pr-3'>OS</th>
                      <th className='pb-2 pr-3'>Veículo</th>
                      <th className='pb-2 pr-3'>Cliente</th>
                      <th className='pb-2 pr-3'>Status</th>
                      <th className='pb-2'>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentServiceOrders.serviceOrders.map((serviceOrder) => (
                      <tr
                        key={serviceOrder.id}
                        className='border-b border-border last:border-0'
                      >
                        <td className='py-2.5 pr-3'>
                          <Link
                            href='/ordens-de-servico'
                            className='flex items-center gap-1.5 font-mono text-text-muted hover:text-clay hover:underline'
                          >
                            <ClipboardText size={14} />
                            {serviceOrder.order_code}
                          </Link>
                        </td>
                        <td className='py-2.5 pr-3 font-semibold'>
                          {serviceOrder.vehicle.brand}{' '}
                          {serviceOrder.vehicle.model}
                        </td>
                        <td className='py-2.5 pr-3'>
                          {serviceOrder.customer.name}
                        </td>
                        <td className='py-2.5 pr-3'>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-bold ${ORDER_STATUS_BADGE_CLASSNAME[serviceOrder.status]}`}
                          >
                            {ORDER_STATUS_LABEL[serviceOrder.status]}
                          </span>
                        </td>
                        <td className='py-2.5 font-mono'>
                          {serviceOrder.total_amount
                            ? formatCurrencyBRL(serviceOrder.total_amount)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

export const getServerSideProps = withSSRAuth(async () => {
  return {
    props: {},
  };
});
