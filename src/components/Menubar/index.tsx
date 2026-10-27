import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ClipboardText,
  Gauge,
  GearSix,
  type Icon,
  Package,
  Receipt,
  Users,
} from 'phosphor-react';

interface NavItem {
  label: string;
  href: string;
  icon: Icon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Mesmos grupos/itens/ordem do protótipo (design/argila-auto-oficina.html):
// Operação, Cadastros, Conta.
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Gauge },
      { label: 'Orçamentos', href: '/orcamentos', icon: Receipt },
      {
        label: 'Ordens de Serviço',
        href: '/ordens-de-servico',
        icon: ClipboardText,
      },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { label: 'Clientes & Veículos', href: '/clientes-veiculos', icon: Users },
      { label: 'Produtos', href: '/produtos', icon: Package },
    ],
  },
  {
    label: 'Conta',
    items: [{ label: 'Configurações', href: '/configuracoes', icon: GearSix }],
  },
];

// Ponto de corte do protótipo pra colapsar a sidebar pra só ícones
// (`@media (max-width: 880px)`) — repetido aqui via variante arbitrária do
// Tailwind (max-[880px]:) pra não depender de um breakpoint "md"/"lg"
// padrão que não bate com esse valor exato. O AppShell usa o MESMO valor
// pra encolher a largura da sidebar e esconder marca/tenant-box/rodapé,
// senão o menu colapsado ficaria sobrando dentro de uma sidebar ainda larga.
//
// IMPORTANTE: as classes "max-[880px]:..." abaixo precisam aparecer por
// EXTENSO no código (não como `${algumaVariavel}:hidden` montada em
// template string) — o Tailwind decide quais classes gerar lendo o texto
// literal dos arquivos, não executando o JS; uma classe só "montada" em
// tempo de execução nunca é detectada e nenhum CSS é gerado pra ela (bug
// que aconteceu aqui com uma primeira versão deste arquivo, usando uma
// constante JS pro prefixo do breakpoint).
// Tamanhos +1px em relação ao protótipo (10→11 no rótulo, 13→14 no item,
// ícone 17→18) — decisão confirmada com o usuário: aumento deliberado
// além da referência original (ver mesmo comentário em AppShell, no
// tenant-box).
const NAV_LABEL_CLASSNAME =
  'max-[880px]:hidden px-2.5 pt-2.5 pb-1 text-[11px] font-bold tracking-[0.09em] text-white/55 uppercase';
const NAV_ITEM_LABEL_CLASSNAME = 'max-[880px]:hidden';

/**
 * Navegação da sidebar: grupos de links com ícone (Phosphor) + rótulo.
 * Cuida sozinho do próprio responsivo — abaixo de 880px, o cabeçalho de
 * cada grupo e o texto de cada item somem, sobrando só o ícone centralizado
 * (equivalente ao `.nav-item span.lbl, .nav-label { display:none }` do
 * protótipo). Quem usa este componente (AppShell) não precisa saber nada
 * de mobile pra navegação — só precisa encolher a sidebar ao redor dela.
 */
export function Menubar() {
  const router = useRouter();

  return (
    <nav className='flex flex-1 flex-col gap-0.5 overflow-y-auto'>
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className={NAV_LABEL_CLASSNAME}>{group.label}</div>

          {group.items.map((item) => {
            const active = router.pathname === item.href;
            const ItemIcon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                // title: só é útil de verdade no modo colapsado (ícone sem
                // rótulo visível) — sobra inofensivo no modo expandido.
                title={item.label}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-semibold max-[880px]:justify-center ${
                  active ? 'bg-white/15' : 'hover:bg-white/10'
                }`}
              >
                <ItemIcon
                  size={18}
                  weight={active ? 'fill' : 'regular'}
                  className='flex-none opacity-90'
                />
                <span className={NAV_ITEM_LABEL_CLASSNAME}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
