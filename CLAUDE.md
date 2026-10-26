# ArgilaAuto — Admin (admin-argila-auto)

> Atualizado em 2026-10-26. Mantenha este arquivo atualizado conforme o projeto evolui — é a referência pra qualquer sessão futura (Claude ou humano) entender onde as coisas estão e por quê.

## Como trabalhar neste projeto (combinado com o usuário)

- **Passo a passo, sem decidir sozinho — vale pra tudo, inclusive criar componente/arquivo novo.** Antes de generalizar, construir uma tela inteira, criar um componente novo ou tomar qualquer decisão de design/arquitetura que não foi explicitamente definida, **perguntar e explicar o motivo em detalhe antes de escrever código**. Quando o protótipo (ver abaixo) não cobrir algo que a API suporta, **apresentar a lacuna e propor uma solução** em vez de simplesmente inventar.
- **Detalhar o que está sendo feito, e comentar o código** (não só entregar o resultado pronto).
- O protótipo visual compartilhado é **referência de estrutura de tela**, não a fonte de verdade de dados/regras — a **API é quem manda** em rotas, contratos, regras de permissão e no que de fato existe hoje.
- **TanStack Query — padrão pra código novo**: `queryFn`/`mutationFn` como arrow function **inline**, direto dentro do `useQuery`/`useMutation` (ver `src/hooks/workshop.ts`) — não como função nomeada separada. Vale a partir de `workshop.ts`; `src/hooks/auth.tsx` (login/refresh via Axios direto, fora do React Query) fica como está por decisão do usuário, não é pra refatorar sem pedir.

## O que é o projeto

Front-end administrativo (painel da oficina) do **ArgilaAuto**, SaaS multi-tenant de gestão de oficina mecânica, produto da **Argila Tecnologia**. Cada oficina cadastrada é um tenant (`Workshop`) isolado. Dono/recepção/mecânico usam este admin; existe também um app separado pro cliente final (dono do veículo) que **não faz parte deste repositório**.

Repositórios irmãos (fora desta pasta, mas usados como referência):
- **API**: `/home/lubnnia/Documentos/Projetos/ArgilaAuto/api-argila-auto/` — tem seu próprio `CLAUDE.md` bem mais detalhado sobre regras de negócio; este arquivo aqui só resume o que o front-end precisa saber. Contratos completos (request/response, exemplos, erros) estão em `openapi.yaml` (6287 linhas) — consultar pontualmente por endpoint ao implementar cada tela, não ler inteiro de uma vez.
- **Materiais de design**: `/home/lubnnia/Documentos/Projetos/MateriaisProjetos/materiais-argila-auto/` — logo (`logo/`), imagens de divulgação (`images/`) e o protótipo navegável (`prototipo/argila-auto-oficina.html`, idêntico a `api-argila-auto/design/argila-auto-oficina.html`).

## Identidade visual (decisões confirmadas com o usuário)

- **Logo**: versão **v2** — selo com ícone de **carro + checkmark** (não os "anéis de torno de oleiro" da v1, que aparecem no protótipo HTML mas estão **descartados**). Arquivos de referência: `materiais-argila-auto/images/argilaauto-logo-light.png` / `argilaauto-logo-dark.png` / `argilaauto-badge.png`, e os SVGs `materiais-argila-auto/logo/argila-auto-logo.svg`, `logo-completed.svg`, `logo-completed-dark.svg`. A doc completa da marca v2 (com a explicação do porquê do ícone, uso, clearspace) está em `api-argila-auto/design/argila-brand.html`.
- **Wordmark**: fonte **Baloo 2** (arredondada) — "Argila" em tinta escura + "**Auto**" na cor clay. Zilla Slab continua só para títulos de página (não é mais a fonte do wordmark).
- **Tokens de cor** (iguais entre v1 e v2, não mudaram):
  - `--clay: #B0562F` (cor dominante — botão primário, links, ativo)
  - `--clay-deep: #8A431F`
  - `--clay-soft: #F3DDCC`
  - `--steel: #4F6B66` (acento raro — badge do plano Pro, nunca botão grande)
  - `--steel-soft: #DCE6E4`
  - `--paper/--bg: #FAF7F3` (fundo)
  - `--surface: #FFFFFF`, `--surface-2: #F2ECE5`
  - `--text: #2B2420`, `--text-muted: #6B5C50`
  - `--border: #E4D9CE`, `--border-strong: #D2C1B0`
  - Semânticas: `--good:#2E8B57` (concluído/aprovado/pago), `--warn:#C98A2E` (aguardando/estoque baixo), `--info:#3E7CB8` (aprovado/em andamento), `--crit:#B23A3A` (cancelado/erro)
  - Modo escuro: variáveis equivalentes documentadas em `argila-brand.html` (`:root[data-theme="dark"]` / `prefers-color-scheme`).
- Fontes: **Zilla Slab** (títulos), **Manrope** (interface/texto corrido), **JetBrains Mono** (dados — valores, placas, OS #).
- As **imagens de divulgação** (`screen_argila_auto.png`, `screen_home_argila_auto.png`, laranja mais vibrante, nav diferente) **não são referência** — são material de marketing com outra paleta e estrutura, descartadas para efeito de implementação.
- Componentes de UI devem usar **Radix UI** como base (primitivos de select, dialog, tabs, radio etc. — já há `@radix-ui/react-select` e `@radix-ui/react-radio-group` no `package.json`, provavelmente vai precisar de mais).

## Estrutura de telas (baseada no protótipo, com ajustes já combinados)

O protótipo (`prototipo/argila-auto-oficina.html`) define o fluxo de referência. Decisões já tomadas em cima dele:

### Fluxo de autenticação
- **Welcome** → **Login** (email/senha, `POST /sessions`) → app.
  - **Sem** o bloco de "ambiente de demonstração" com login direto em tenants — isso era só um atalho do protótipo estático, não existe no produto real.
- **Signup** em 3 passos: dados da oficina → **plano** → sucesso.
  - **Atenção**: no protótipo dava pra escolher Pro direto no cadastro. Na API real (`POST /workshops/signup`), **todo cadastro nasce como `BASIC`**, mesmo se Pro for pedido — não tem gateway de pagamento aceitando Pro nessa rota. Upgrade pra Pro é ação separada (`POST /workshops/upgrade-to-pro`, checkout AbacatePay). A tela de signup precisa refletir isso (plano Pro pode aparecer como "disponível após o cadastro", não selecionável ali).

### App (pós-login)
Sidebar com 3 grupos de navegação — **Operação** (Dashboard, Orçamentos, Ordens de Serviço), **Cadastros** (Clientes & Veículos, Produtos), **Conta** (Configurações) — mais tenant box (nome da oficina + badge do plano) e topbar com toggle de tema.

- **Dashboard**: KPIs (OS em aberto, faturamento do mês, ticket médio, peças em estoque baixo), gráfico de faturamento, bloco de Insights por IA (só plano Pro — bloqueado com CTA de upgrade no Básico), tabela de OS recentes.
- **Orçamentos**: lista de OS nos status de orçamento (`PENDING_QUOTE`, `AWAITING_APPROVAL`, `APPROVED` — ver seção de status abaixo).
- **Ordens de Serviço**: quadro (Kanban) com uma coluna por status, cartões arrastáveis. **9 colunas** (ver "Status da OS" abaixo — inclui `REJECTED` como coluna própria, diferente do protótipo original que só tinha 8).
- **Clientes & Veículos**: tabela de clientes com veículos aninhados.
- **Produtos**: abas Peças / Serviços.
- **Configurações**: dados da oficina, plano atual. **Vai incluir também um relatório financeiro** (ver seção própria abaixo — fora do escopo do protótipo original, adicionado por decisão do usuário).
- **Modal de detalhes da OS**: status, cliente/veículo, queixa, itens (serviço/peça) com total, resumo por IA (Pro).

### Status da OS (`OrderStatus` — fonte de verdade é a API, não o protótipo)
Sequência estrita, sem pular nem retroceder:
`PENDING_QUOTE → AWAITING_APPROVAL → APPROVED → IN_PROGRESS → AWAITING_PART → READY_FOR_PICKUP → COMPLETED`

Mais dois estados fora da sequência:
- **`REJECTED`**: cliente recusou o orçamento. Só sai de `AWAITING_APPROVAL`, e pode **voltar** pra `AWAITING_APPROVAL` (não é estado final). **Decisão confirmada**: tem coluna própria no quadro, posicionada entre "Aguard. Aprovação" e "Aprovado".
- **`CANCELED`**: alcançável de qualquer status não-final. Estado final.

`COMPLETED` e `CANCELED` são finais (nenhuma transição sai deles).

## Estado atual — o que já está construído e testado

- **Identidade visual**: tokens de cor (claro/escuro), fontes e `@theme` configurados em `globals.css`; favicon de verdade (`public/favicon.ico`, `.svg`, `favicon-96x96.png`, `apple-touch-icon.png`, gerados a partir do selo v2).
- **Autenticação**: `/` (Welcome) e `/login` (`src/pages/login/index.page.tsx`) funcionando de ponta a ponta contra `POST /sessions` de verdade, com validação (Zod + React Hook Form), cookies `argilaauto:token`/`argilaauto:refresh_token` (renomeados do resíduo antigo `autismo:*`).
- **Casco do app autenticado**: `AppShell` (sidebar + topbar) + `Menubar` (navegação com ícones Phosphor, colapsa pra só-ícones abaixo de 880px, mesmo critério do protótipo) + `ThemeToggle` (ícone sol/lua de verdade, via `next-themes`).
- **`/dashboard`** (`src/pages/dashboard/index.page.tsx`): só **placeholder** — prova que login → AppShell → dados reais de usuário/oficina funciona, mas sem KPIs/gráfico/tabela ainda (bloqueado por mudanças em andamento na API — ver "Escopo" abaixo).
- `IUser` (em `auth.tsx`) e `IWorkshop`/`useWorkshop` (em `hooks/workshop.ts`) já espelham o schema real da API (snake_case, roles corretos).

### Pegadinhas já descobertas nesta base (relevantes pra qualquer trabalho futuro com Tailwind v4 + Next 16)
1. **Classe Tailwind montada via template string dinâmica nunca é detectada** — o Tailwind lê o texto literal dos arquivos, não executa o JS. Nunca fazer `` `${variavel}:hidden` ``; escrever a classe por extenso em cada lugar que ela aparece.
2. **`next/image` com `style` customizado pode gerar hydration mismatch de verdade** (visto no log do `next dev`, não só visual). Pra recortar/redimensionar fora do padrão, preferir `background-image` num `<div>` comum a brigar com o `style` do `next/image`.
3. **Duas classes de `display` incondicionais no mesmo elemento brigam** pela ordem que o Tailwind decide gerar o CSS (não a ordem do JSX). Nunca combinar algo como `"inline-block hidden md:block"`; manter só UMA classe de display incondicional (o estado "padrão") e condicionar a outra ao mesmo breakpoint/variante (`"hidden md:inline-block"`).
4. **`@import` de fonte externa precisa vir ANTES de `@import "tailwindcss"`** no `globals.css` — depois que o Tailwind expande, qualquer `@import` que sobrar depois quebra (regra do próprio CSS: `@import` tem que vir antes de qualquer outra regra).

## Escopo: protótipo vs. capacidade real da API

A API já suporta bem mais do que o protótipo visual mostra. **Decisão do usuário**: seguir a API pra tudo que é regra/rota/dado; o protótipo é ponto de partida de layout, mas onde a API tiver algo que o protótipo não cobre, deve ser avaliado e trazido pra tela (ou proposto ao usuário como melhoria), não ignorado. Coisas que existem na API e **não têm equivalente no protótipo** (avaliar tela a tela, ao implementar cada módulo):

- Aprovação/rejeição da OS pelo cliente com nome/documento de quem aprovou/rejeitou.
- Sugestão de urgência por IA na OS + feedback do mecânico sobre essa sugestão.
- Fotos de checklist (entrada/saída do veículo, por categoria).
- Emissão de nota fiscal (NFS-e) por OS (hoje só esqueleto na API, sem provedor configurado — cai em erro).
- Link público de acompanhamento da OS pro cliente final (sem login).
- Relatório financeiro de pagamentos (ver abaixo).

**Em andamento (usuário mexendo na API agora, 2026-10-26):** adicionar nome do cliente e dados do veículo embutidos direto na resposta de `ServiceOrder` (hoje só vêm `customer_id`/`vehicle_id` crus), e um endpoint de faturamento mensal histórico (hoje só existe `GET /service-order-payments/report?from=&to=`, que devolve um período por vez — pra reconstruir um gráfico de 6 meses seriam 6 chamadas). O conteúdo real do Dashboard (KPIs, gráfico, tabela de OS recentes) está **pausado esperando isso** — não implementar a partir do que está documentado aqui sem confirmar que essas mudanças já foram pro ar.

## Relatório financeiro (Configurações) — pendente de especificação

Decisão confirmada: vai existir, usando a lib **pdfmake** (ainda não está no `package.json`, adicionar quando for implementar). Endpoint: `GET /service-order-payments/report?from=&to=` (total recebido, totais por método de pagamento, filtra por data de pagamento, exclui `CANCELED` do total mas lista). **Aguardando o usuário detalhar como o relatório deve ficar** antes de implementar — não inventar layout/conteúdo disso sozinho.

Não existe endpoint de relatório de estoque — se for necessário, seria calculado no front a partir de `GET /parts` (comparando `quantity` com `minimumStock`).

## Referência rápida da API (resumo — consultar `openapi.yaml` para contrato completo por endpoint)

### Autenticação e convenções gerais
- Login equipe: `POST /sessions` (email/senha) → `token` + `refresh_token`. Refresh: `POST /sessions/refresh`.
- JWT assinado com **RS256** (não é um secret simples).
- Roles: `SUPER_ADMIN` | `ADMIN` | `RECEPTIONIST` | `MECHANIC`. `SUPER_ADMIN` nunca tem `workshopId` e é bloqueado em tudo que é dado de uma workshop específica (clientes, veículos, catálogo, OS, pagamentos, relatórios) — só gerencia Workshops/Users globalmente.
- Quase todas as ~45 rotas de equipe retornam **402 Payment Required** se a assinatura da workshop estiver vencida (trial de 7 dias no Básico, depois bloqueia até confirmar assinatura ou upgrade) — exceto as rotas de autogestão da própria assinatura.
- Nomenclatura no código/contrato da API é **toda em inglês** (`Workshop`, `Customer`, `Vehicle`, `Service`, `Part`, `ServiceOrder`, etc.) — ver tabela de mapeamento português→inglês no `CLAUDE.md` da API se precisar.

### Endpoints por módulo (path — método — resumo)
- **Workshops**: `POST /workshops/signup` (público, cria tenant+User ADMIN+Subscription BASIC) · `GET /workshops/me` · `GET/PUT /workshops` (update: nome/telefone/e-mail/logo, CNPJ não editável) · `GET /workshops` e `DELETE /workshops/:id` (só `SUPER_ADMIN`) · `POST /workshops/upgrade-to-pro` · `POST /workshops/subscribe-to-basic` · `POST /workshops/cancel-subscription` · `GET/PUT /workshops/:id/fiscal-settings`.
- **Users** (equipe): `POST /users` · `GET /users` (paginado) · `PUT /users` · `GET /users/show/:id` · `GET /users/me` · `PATCH /users/password` · `DELETE /users/:id`.
- **Customers**: `POST /customers` · `GET /customers` · `PUT /customers` · `GET /customers/:id`. `ADMIN`/`RECEPTIONIST` criam/editam; `MECHANIC` só lista.
- **Vehicles**: `POST /vehicles` · `GET /vehicles` (filtro `?customerId=`) · `PUT /vehicles` (placa não editável) · `GET /vehicles/:id` · `GET /vehicles/:id/preventive-maintenance-insight` (**plano Pro só, 403 no Básico**).
- **Services** (catálogo): `POST/GET/PUT /services`, `GET /services/:id`.
- **Parts** (estoque): `POST/GET/PUT /parts` (sku e quantity não editáveis via PUT), `GET /parts/:id`, `POST/GET /parts/:id/stock-movements`.
- **ServiceOrders** (núcleo): `POST/GET/PUT /service-orders`, `GET /service-orders/:id`, `GET /service-orders/:id/report-data` (consolidado pra impressão), `PATCH /service-orders/:id/status` (máquina de estados), `PATCH /service-orders/:id/urgency-feedback` (só `MECHANIC`), `PATCH /service-orders/:id/service-summary`, `GET /service-orders/:id/invoice` + `POST .../invoice/retry`, `POST /service-orders/:id/items` + `DELETE .../items/:itemId`, `POST/GET /service-orders/:id/payments` + `POST .../payments/:id/confirm` + `POST .../payments/:id/cancel`, `POST/GET/DELETE /service-orders/:id/checklist-photos`, `POST /service-orders/:id/public-link/regenerate`.
  - `GET /service-orders` aceita filtros `?customerId=&vehicleId=&status=&searchParam=&aiUrgencySuggestion=&sortBy=urgency`.
  - `MECHANIC` participa de add/remove item, update geral e avançar status (mas **não** cancela — só `ADMIN`/`RECEPTIONIST`).
- **Relatórios**: `GET /service-order-payments/report?from=&to=`.
- **Canal público (sem auth)**: `GET /track/:token`, `POST /track/:token/approve`, `POST /track/:token/reject`.
- Módulos de `CustomerAccount` (login do cliente final) existem na API mas são do **app do cliente**, fora do escopo deste admin.

### Enums relevantes pro front
- `OrderStatus`: ver seção "Status da OS" acima.
- `PlanType`: `BASIC` | `PRO`.
- `ServiceOrderItemType`: `PART` | `SERVICE`.
- `UrgencyLevel`: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`.
- `PaymentStatus`: `PENDING` | `PAID` | `CANCELED` (`PARTIALLY_PAID` existe no schema mas não é usado na prática).
- `PaymentMethod`: `CASH` | `PIX` | `CREDIT_CARD` | `DEBIT_CARD` | `BOLETO` | `BANK_TRANSFER`.
- `MaintenanceCategory` (obrigatório em `Service`/`Part`): 17 valores (`MOTOR_OIL_CHANGE`, `OIL_FILTER`, `AIR_FILTER`, `CABIN_AIR_FILTER`, `FUEL_FILTER`, `TIMING_BELT`, `ACCESSORY_BELT`, `BRAKE_PADS`, `BRAKE_DISCS`, `BRAKE_FLUID`, `SPARK_PLUGS`, `BATTERY`, `COOLANT`, `TRANSMISSION_FLUID`, `TIRES`, `SUSPENSION`, `OTHER`).

### Preços e planos (confirmados)
- **Basic**: R$ 89,90/mês, 7 dias de trial — depois bloqueia (402) até confirmar assinatura ou virar Pro.
- **Pro**: R$ 179,90/mês, via checkout AbacatePay.

## Stack técnica (admin)

- **Next.js 16.4.2** (breaking changes relevantes — ver nota abaixo) + **React 19.3.0** / **React DOM 19.3.0**.
- **Pages Router** customizado: `pageExtensions: ['page.tsx', 'api.ts', 'api.tsx']` em [next.config.ts](next.config.ts), páginas em `src/pages/*.page.tsx`.
- **Tailwind CSS v4** via `@tailwindcss/postcss` e `@tailwindcss/turbopack`.
- **Biome** (não ESLint/Prettier) — config em [biome.json](biome.json).
- **TanStack Query v5** para data fetching/cache.
- **React Hook Form + Zod + @hookform/resolvers** para formulários/validação.
- **Axios + nookies** para cliente HTTP e cookies (JWT em cookies, com refresh token).
- **Radix UI**, `react-imask`, `next-themes`, `react-toastify`, `next-seo`.
- **pdfmake** — a adicionar quando implementarmos o relatório financeiro.
- Alias de import: `@/*` → `./src/*` ([tsconfig.json](tsconfig.json)).

### Nota sobre o Next.js 16
O arquivo [AGENTS.md](AGENTS.md) na raiz é **gerado automaticamente pelo `next dev`** (confirmado em `node_modules/next/dist/server/lib/generate-agent-files.js`) porque esta versão do Next.js tem convenções que diferem do "Next.js clássico" que modelos de IA conhecem de treino. Aponta para `node_modules/next/dist/docs/` como fonte de verdade — consultar antes de mudanças estruturais (roteamento, config).

## Estrutura de diretórios (`src/`) — estado atual

```
src/
├── pages/
│   ├── _app.page.tsx          # ThemeProvider + QueryClientProvider + AuthProvider + ToastContainer
│   ├── _document.page.tsx     # favicon, preconnect de fontes, suppressHydrationWarning (next-themes)
│   ├── index.page.tsx         # Welcome ("/")
│   ├── login/index.page.tsx   # Login ("/login")
│   └── dashboard/index.page.tsx  # Dashboard — PLACEHOLDER, ver "Estado atual"
├── components/
│   ├── AppShell/       # sidebar + topbar das telas autenticadas
│   ├── AuthShell/      # moldura das telas de auth (Welcome/Login/Signup)
│   ├── Logo/           # logomarca oficial (src/assets/), variantes auto/light/dark/iconOnly
│   ├── Menubar/        # navegação da sidebar (ícones Phosphor, colapsa <880px)
│   ├── ThemeToggle/    # toggle de tema (ícone sol/lua)
│   ├── Form/
│   │   ├── Button/, Input/, InputFormControl/, ForgotPassword/   # reconstruídos, OK
│   │   └── AlertDialog/, InputMask/, InputMaskFormControl/, SelectPicker/, Switch/  # QUEBRADOS, ver abaixo
│   ├── Container/, ErrorAlert/, SuccessAlert/   # reaproveitáveis, token de cor a conferir ao usar
│   └── BulletEnabled/, Editor/, Pagination/     # QUEBRADOS, ver abaixo
├── hooks/
│   ├── auth.tsx        # AuthContext (signIn, signOut, updateToken, usuário logado) — Axios direto
│   └── workshop.ts      # useWorkshop (TanStack Query, queryFn inline — padrão pra código novo)
├── lib/
│   ├── api.ts           # setupAPIClient(context?) — axios com interceptor de refresh token (401)
│   ├── apiClient.ts      # instancia o client (uso client-side) — export { api }
│   ├── queryClient.ts
│   └── errors/AuthTokenError.ts
└── utils/
    ├── withSSRAuth.ts   # HOC de getServerSideProps p/ rotas autenticadas
    ├── withSSRGuest.ts  # HOC de getServerSideProps p/ rotas só-para-visitante
    └── no-image.ts
```

## Pendências / próximos passos

**Bloqueado pelo usuário** (mudanças na API em andamento — ver "Em andamento" acima):
- Conteúdo real do Dashboard (KPIs, gráfico de faturamento, tabela de OS recentes).

**Telas ainda não construídas** (rotas citadas no app, mas sem página — dão 404 hoje):
- Signup (3 passos), `/forgot-password`, `/orcamentos`, `/ordens-de-servico` (Kanban, 9 colunas incl. `REJECTED`), `/clientes-veiculos`, `/produtos`, `/configuracoes` (vai incluir gestão de assinatura/upgrade e o relatório financeiro em PDF via `pdfmake`, layout pendente de especificação do usuário).

**Componentes legados ainda quebrados** (do template reaproveitado — cor antiga SCREAMING_CASE inexistente nos tokens atuais, `tailwind-variants` não instalado, e/ou lib faltando): `BulletEnabled`, `Editor` (também falta `@mdxeditor/editor` inteiro), `Pagination`, `Form/AlertDialog` (falta `@radix-ui/react-alert-dialog`), `Form/InputMask` + `Form/InputMaskFormControl`, `Form/SelectPicker`, `Form/Switch` (falta `@radix-ui/react-switch`). **Decisão do usuário**: conserta cada um só quando a tela que precisa dele for construída, não todos de uma vez. `ContactForm` e o `Layout` antigo (shell genérico, substituído por `AppShell`/`AuthShell`) já foram **apagados** por não terem uso no produto.

**Pendências técnicas menores**:
- `Container`/`ErrorAlert`/`SuccessAlert` usam uma paleta semântica (`primary`, `success`) parcialmente diferente da nossa (`clay`, `good`) — `ErrorAlert` já funciona por coincidência (`danger`/`danger-light` apontam pra `crit`/`crit-soft`), `SuccessAlert`/`ContactForm` não — conferir ao reaproveitar.
- `IUser.role` tipado certo, mas nada na UI ainda trata diferença de permissão por papel (ex.: esconder seção bloqueada pra `MECHANIC`) — só vai ser relevante quando as telas de dado real existirem.

## Scripts

```bash
npm run dev      # next dev
npm run build    # next build
npm run start    # next start
npm run lint     # biome check
npm run format   # biome format --write
```

## Convenções de código observadas

- Componentes em `index.tsx` dentro de pasta com o nome do componente (`PascalCase/index.tsx`).
- Aspas simples, ponto-e-vírgula obrigatório, trailing comma estilo ES5 (Biome).
- Muitas regras do Biome recomendado desativadas em [biome.json](biome.json) (`noExplicitAny` só warn, `noNonNullAssertion` off, `useExhaustiveDependencies` off).
- Comentários `// FUNCTIONS` / `// END FUNCTIONS` seccionam hooks/handlers dentro de componentes.
