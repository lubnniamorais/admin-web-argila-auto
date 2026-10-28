# ArgilaAuto — Admin (admin-argila-auto)

> Atualizado em 2026-10-28 (final da sessão que terminou `/dashboard`: KPIs, gráfico de faturamento com Recharts, Insights por IA e tabela de OS recentes, tela testada no navegador com dados reais via API, ainda não commitada). Mantenha este arquivo atualizado conforme o projeto evolui — é a referência pra qualquer sessão futura (Claude ou humano) entender onde as coisas estão e por quê.

## Como trabalhar neste projeto (combinado com o usuário)

- **Passo a passo, sem decidir sozinho — vale pra tudo, inclusive criar componente/arquivo novo.** Antes de generalizar, construir uma tela inteira, criar um componente novo ou tomar qualquer decisão de design/arquitetura que não foi explicitamente definida, **perguntar e explicar o motivo em detalhe antes de escrever código**. Quando o protótipo (ver abaixo) não cobrir algo que a API suporta, **apresentar a lacuna e propor uma solução** em vez de simplesmente inventar.
- **Detalhar o que está sendo feito, e comentar o código** (não só entregar o resultado pronto).
- O protótipo visual compartilhado é **referência de estrutura de tela**, não a fonte de verdade de dados/regras — a **API é quem manda** em rotas, contratos, regras de permissão e no que de fato existe hoje.
- **TanStack Query — padrão pra código novo**: `queryFn`/`mutationFn` como arrow function **inline**, direto dentro do `useQuery`/`useMutation` (ver `src/hooks/workshop.ts`) — não como função nomeada separada. Vale a partir de `workshop.ts`; `src/hooks/auth.tsx` (login/refresh via Axios direto, fora do React Query) fica como está por decisão do usuário, não é pra refatorar sem pedir.
- **Toda operação que escreve no banco (criar/atualizar/deletar via API) usa `useMutation` + `SubmitHandler` do RHF** — nunca um `async function` solto chamando a API direto. O `SubmitHandler` fica fino (só chama `mutateAsync` + trata erro no `catch`); o que fazer no sucesso (navegar, trocar de tela, disparar outra mutation) vai no `onSuccess` da própria mutation — **exceto** quando o sucesso só muda o que é renderizado (sem nenhuma ação de verdade), caso em que se lê `isSuccess`/`error` direto do retorno do `useMutation` em vez de duplicar isso num `useState` (ver `/forgot-password`, `/reset-password`: `isSuccess` renomeado pra `isEmailSent`/`isResetDone` na desestruturação, nenhum `useState` redundante). O loading do botão de submit usa o `isPending` da mutation, não o `isSubmitting` do `formState` (mesmo padrão do `atletas/criar` do AMIP — ver abaixo).
- **Sempre desestruture o objeto** — no `mutationFn` e em qualquer lugar que consome um objeto de dados (ex.: `async ({ name, email }: IFormData) => {...}`, nunca `data.name`/`data.email` repetido).
- **Endereço: busca por CEP via ViaCEP** (`https://viacep.com.br/ws/{cep}/json/`, `axios.get` direto, não pelo client `api` configurado — é host externo, sem auth) — botão de busca ao lado do campo CEP, preenche rua/bairro/cidade/UF como campos `disabled`. Ver `src/pages/signup/index.page.tsx` e `src/pages/configuracoes/index.page.tsx`.
- **Ícones sempre da lib `phosphor-react`** (já é dependência, usada no `Menubar`) — nunca unicode/emoji cru, nem como texto solto nem dentro de botão.
- **Datas: usar `@formkit/tempo`** (pedido explícito do usuário, 27/10/2026) — **migrado** em `src/report/header.ts` e `src/pages/configuracoes/index.page.tsx`, instalado (`^1.1.0`). Uso: `format(date, 'DD/MM/YYYY', 'pt-BR')`. Escape de texto literal confirmado: **não** usa colchetes `[literal]` (sintaxe moment/dayjs) — usa **barra invertida antes de cada caractere-token** (ver `node_modules/@formkit/tempo/dist/common.mjs`, função `escapeTokens`, e `parts.mjs`). Tokens reservados de 1 char incluem `Y M D d m s H h a A Z S` — qualquer um desses dentro de texto literal precisa de `\` antes. Exemplo real (`headerReport`, "27/10/2026 às 20:45h"): `format(date, 'DD/MM/YYYY à\\s HH:mm\\h', 'pt-BR')` — "à" não precisa de escape (não é token), mas o "s" de "às" e o "h" final precisam.
- **Lição da sessão 27/10**: nunca tentar reproduzir manualmente, em uma chamada de ferramenta, uma string base64 colada pelo usuário com mais de uns poucos milhares de caracteres — risco real de truncar/corromper (aconteceu duas vezes antes de desistir). Pedir pra salvar o arquivo em disco e passar o caminho; converter pra base64 via shell/script, nunca retypar.
- **Referência de convenções**: `/home/lubnnia/Documentos/Projetos/Amip/admin-web-amip/` (projeto irmão, fora do ArgilaAuto) — mesmo stack (RHF+Zod+TanStack Query+Axios+Phosphor), usado como modelo pros pontos acima. Tela de referência: `src/pages/atletas/criar/index.page.tsx`. Módulo de relatório em PDF (`src/report/`) replicado de lá pro ArgilaAuto, adaptado pros tokens de cor daqui — ver `src/report/` neste projeto.

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
- **Autenticação**: `/` (Welcome), `/login`, **`/signup`** (3 passos: dados da oficina+endereço → plano → sucesso/checkout) e **`/forgot-password`**+**`/reset-password`** — todas testadas de ponta a ponta contra a API real (não só unit, teste manual no navegador). Cookies `argilaauto:token`/`argilaauto:refresh_token`. `signUp` novo em `auth.tsx` (ver `AuthProvider`) — mesma lógica de `signIn` (salva token, não redireciona sozinho: quem decide pra onde ir depois é a página, já que depende do plano escolhido).
- **Casco do app autenticado**: `AppShell` (sidebar + topbar) + `Menubar` (navegação com ícones Phosphor, colapsa pra só-ícones abaixo de 880px) + `ThemeToggle`. Tamanhos de fonte/logo da sidebar aumentados em 27/10 além do que o protótipo original pedia (decisão do usuário, protótipo ficava pequeno demais em telas grandes) — ver comentários em `AppShell`/`Menubar`.
- **`/dashboard`** (`src/pages/dashboard/index.page.tsx`) — **concluída e testada no navegador** nesta sessão (28/10), ainda não commitada. 4 KPIs (OS em aberto, faturamento do mês, ticket médio, peças em estoque baixo), gráfico de faturamento dos últimos 6 meses (Recharts, `BarChart`), bloco de Insights por IA (Pro — lista veículo+categoria+urgência; Básico — CTA de upgrade linkando pra `/configuracoes`) e tabela de OS recentes (5 últimas, `received_at` desc). Estado vazio ("Sua oficina ainda está vazia") quando a workshop não tem nenhuma OS — replica o do protótipo.
  - **Dados**: `src/hooks/dashboard.ts` (5 hooks TanStack Query, `queryFn` inline) — `useServiceOrdersSummary` (`GET /service-orders/summary`), `useLowStockParts` (`GET /parts/low-stock`), `useMonthlyPaymentsReport` (`GET /service-order-payments/monthly-report?months=6`), `useRecentServiceOrders` (`GET /service-orders?page=1&perPage=5`, também lê o header `x-total-count-registers` pro "de X no total" do KPI de OS em aberto), `usePreventiveMaintenanceInsight` (`GET /vehicles/preventive-maintenance-insight`, com `enabled` condicionado a `isPro` — nunca dispara a chamada numa workshop Básica, que daria 403).
  - **Util novo**: `src/utils/orderStatus.ts` — label em PT-BR + classe Tailwind (cores semânticas `good`/`warn`/`info`/`crit` do CLAUDE.md) pros 9 valores de `OrderStatus`, decisão confirmada com o usuário pra já nascer compartilhado (vai ser reaproveitado no Kanban de Ordens de Serviço e em Orçamentos).
  - **Gráfico — decisão confirmada com o usuário**: instalar uma lib (`recharts@^3.10.1`, já suporta React 19 nativamente) em vez de replicar o SVG manual do protótipo — primeira lib de gráfico do projeto. Cores do gráfico via CSS var (`fill='var(--clay)'` etc.) direto no SVG do Recharts — não é uma classe Tailwind montada dinamicamente, então a pegadinha #1 (classe montada por template string) não se aplica aqui.
  - **Links decisão confirmada com o usuário**: linhas da tabela de OS recentes apontam pra `/ordens-de-servico` e o KPI de estoque baixo pra `/produtos`, mesmo nenhuma das duas telas existir ainda (dá 404 hoje) — propositalmente, pra já deixar o caminho certo quando essas telas forem construídas.
  - **Testado com dados reais** (signup de workshop nova + seed via curl: customer/vehicle/service/part com estoque baixo/3 OS incl. uma com pagamento PIX confirmado) — KPIs, gráfico (incl. correção de um bug real: eixo Y em "k" fixo mostrava "0k" pra valores abaixo de 1000, trocado pra `Intl.NumberFormat` com `notation: 'compact'`), as 9 cores de status (testadas `PENDING_QUOTE`/`CANCELED`/`IN_PROGRESS` ao vivo, as outras 6 só por inspeção do mapeamento), bloco de IA travado (Básico) e tema claro/escuro. **Não testado**: bloco de Insights por IA com dado real de uma workshop Pro (exigiria upgrade de verdade via checkout AbacatePay, fora do escopo de um teste manual) — só o estado "sem alerta" e o estado travado (Básico) foram vistos na prática.
- **`/configuracoes`** — **concluída, testada no navegador e commitada** nesta sessão (27/10). 3 seções empilhadas numa página só (decisão confirmada: sem abas):
  1. **Dados da oficina** — form com `PUT /workshops` (nome, telefone, e-mail, endereço via ViaCEP, `logoUrl` como campo de URL de texto — não existe upload de arquivo na API). CNPJ mostrado `disabled` (API não permite editar) — testado, confirma `disabled` com "Não informado" quando vazio.
  2. **Plano e assinatura** — lê `workshop.subscription` (`GET /workshops/me`), botões condicionais: `upgrade-to-pro`/`subscribe-to-basic` (ambos redirecionam pro checkout da AbacatePay) e `cancel-subscription` (só se Pro sem cancelamento pendente). Testado o estado Básico em trial ("Teste grátis até DD/MM/AAAA" com data correta via tempo).
  3. **Relatório financeiro em PDF** — `GET /service-order-payments/report?from=&to=` + `src/report/` (módulo replicado do AMIP — ver `docDefinitions.ts`/`header.ts`/`footer.ts`/`stylesTable.ts`/`table.ts`) + `pdfmake` `^0.2.23` + `@types/pdfmake`. Tabela: código da OS, cliente, método, valor, situação (usa `order_code`/`customer_name` que a API devolve). Testado: chamada à API (200), estado "nenhum pagamento no período" (toast, sem crash), e `headerReport()` isolado com a logo real do `.env` e data formatada — **não testado com linhas de pagamento de verdade** (exigiria montar cliente+veículo+serviço+OS via API só pra isso; `table.ts`/`docDefinitions.ts` não foram alterados nesta sessão, só `header.ts`).
  - **Logo do relatório**: `NEXT_PUBLIC_REPORT_IMAGE_BASE64` no `.env` **preenchida** (27/10) a partir de `src/assets/argilaauto-logo-light.png`, convertida via script Python (nunca colar base64 gigante direto no chat — ver "Como trabalhar" acima).
  - **Ambiente local pra testar isso de novo**: Postgres já roda via docker-compose da API (`api-argila-auto/docker-compose.yml`, porta 5432, já migrado — `npx prisma migrate deploy`); API sobe com `npm run dev` em `api-argila-auto/` (porta 3333, hardcoded em `src/infra/http/server.ts`); `.env` do admin aponta `NEXT_PUBLIC_API_URL` pro IP da própria máquina (`192.168.100.117:3333`), não `localhost` — confirmar que esse IP ainda é o certo se mudar de rede. Não há usuário de teste com senha conhecida no banco (os existentes — `lubnnia@gmail.com`, contas `E2E Basic`/`E2E Pro` — têm senha com hash, sem como reaproveitar); criar oficina nova via `/signup` quando precisar testar de novo.
- `IUser` (em `auth.tsx`) e `IWorkshop`/`useWorkshop` (em `hooks/workshop.ts`, agora com `address`) já espelham o schema real da API (snake_case, roles corretos).

### Pegadinhas já descobertas nesta base (relevantes pra qualquer trabalho futuro com Tailwind v4 + Next 16)
1. **Classe Tailwind montada via template string dinâmica nunca é detectada** — o Tailwind lê o texto literal dos arquivos, não executa o JS. Nunca fazer `` `${variavel}:hidden` ``; escrever a classe por extenso em cada lugar que ela aparece.
2. **`next/image` com `style` customizado pode gerar hydration mismatch de verdade** (visto no log do `next dev`, não só visual). Pra recortar/redimensionar fora do padrão, preferir `background-image` num `<div>` comum a brigar com o `style` do `next/image`.
3. **Duas classes de `display` incondicionais no mesmo elemento brigam** pela ordem que o Tailwind decide gerar o CSS (não a ordem do JSX). Nunca combinar algo como `"inline-block hidden md:block"`; manter só UMA classe de display incondicional (o estado "padrão") e condicionar a outra ao mesmo breakpoint/variante (`"hidden md:inline-block"`).
4. **`@import` de fonte externa precisa vir ANTES de `@import "tailwindcss"`** no `globals.css` — depois que o Tailwind expande, qualquer `@import` que sobrar depois quebra (regra do próprio CSS: `@import` tem que vir antes de qualquer outra regra).
5. **`items-center` num flex `min-h-screen overflow-hidden` esconde o topo do conteúdo quando ele é mais alto que a tela** — a centralização empurra o início do elemento pra uma coordenada Y negativa, que a rolagem normal nunca alcança (confirmado: `scrollY: 0` e o `<h1>` ainda em `top: -20px`). Descoberto no `AuthShell` (`src/components/AuthShell/index.tsx`), quando o Passo 2 do Signup cortava o título. Corrigido trocando pra `items-start` + padding vertical (`py-12`) — garante que o conteúdo sempre começa visível, independente da altura. Vale pra qualquer container que centraliza verticalmente um filho de altura variável/desconhecida.
6. **Arquivo editado pela ferramenta pode ser sobrescrito pelo autosave do editor do usuário, se ele estiver com o arquivo aberto** — sintoma: a edição é aplicada (confirmada pela própria ferramenta), mas uma leitura logo depois mostra o conteúdo antigo de volta. Se isso acontecer, confirme o conteúdo direto via shell (`grep`/`cat`, fora das ferramentas de edição) antes de insistir, e peça pra fechar/recarregar o arquivo no editor antes de tentar de novo — reaplicar a edição sem isso só vai ser sobrescrito de novo.
7. **Zod `.refine(...).optional()` roda o `refine` mesmo em string vazia** — `.optional()` só livra de `undefined`, e o RHF geralmente usa `''` como default de campo de texto, não `undefined`. Bug real encontrado e corrigido em 27/10: `workshopCnpj` no Signup travava QUALQUER cadastro sem CNPJ (campo opcional) com "CNPJ inválido", porque `validateCNPJ('')` dá `false`. Correção: validar dentro do próprio `refine` (`(value) => !value || validateCNPJ(value)`), não depender da ordem com `.optional()`. Vale pra qualquer campo opcional com `.refine()` custom.

## Escopo: protótipo vs. capacidade real da API

A API já suporta bem mais do que o protótipo visual mostra. **Decisão do usuário**: seguir a API pra tudo que é regra/rota/dado; o protótipo é ponto de partida de layout, mas onde a API tiver algo que o protótipo não cobre, deve ser avaliado e trazido pra tela (ou proposto ao usuário como melhoria), não ignorado. Coisas que existem na API e **não têm equivalente no protótipo** (avaliar tela a tela, ao implementar cada módulo):

- Aprovação/rejeição da OS pelo cliente com nome/documento de quem aprovou/rejeitou.
- Sugestão de urgência por IA na OS + feedback do mecânico sobre essa sugestão.
- Fotos de checklist (entrada/saída do veículo, por categoria).
- Emissão de nota fiscal (NFS-e) por OS (hoje só esqueleto na API, sem provedor configurado — cai em erro).
- Link público de acompanhamento da OS pro cliente final (sem login).
- ~~Relatório financeiro de pagamentos~~ ✅ implementado em `/configuracoes` (ver "Estado atual" acima) — API enriquecida em 27/10/2026 com `order_code`/`customer_name` por pagamento (ver "Referência rápida da API" abaixo).

~~Em andamento (usuário mexendo na API em paralelo): faltavam nome do cliente/veículo embutidos em `ServiceOrder` e um endpoint de faturamento mensal histórico~~ ✅ **confirmado resolvido em 28/10/2026** — `ServiceOrder.customer`/`.vehicle` resolvidos e `GET /service-order-payments/monthly-report` existem de verdade (conferido direto no `openapi.yaml` e testado). Além disso, 2 endpoints novos foram criados nesta mesma sessão especificamente pro Dashboard (`GET /service-orders/summary`, `GET /parts/low-stock`) — ver "Estado atual" acima. **Dashboard não tem mais nenhum bloqueio do lado da API.**

Não existe endpoint de relatório de estoque — se for necessário, seria calculado no front a partir de `GET /parts` (comparando `quantity` com `minimumStock`).

## Referência rápida da API (resumo — consultar `openapi.yaml` para contrato completo por endpoint)

### Autenticação e convenções gerais
- Login equipe: `POST /sessions` (email/senha) → `token` + `refresh_token`. Refresh: `POST /sessions/refresh`.
- JWT assinado com **RS256** (não é um secret simples).
- Roles: `SUPER_ADMIN` | `ADMIN` | `RECEPTIONIST` | `MECHANIC`. `SUPER_ADMIN` nunca tem `workshopId` e é bloqueado em tudo que é dado de uma workshop específica (clientes, veículos, catálogo, OS, pagamentos, relatórios) — só gerencia Workshops/Users globalmente.
- Quase todas as ~45 rotas de equipe retornam **402 Payment Required** se a assinatura da workshop estiver vencida (trial de 7 dias no Básico, depois bloqueia até confirmar assinatura ou upgrade) — exceto as rotas de autogestão da própria assinatura.
- Nomenclatura no código/contrato da API é **toda em inglês** (`Workshop`, `Customer`, `Vehicle`, `Service`, `Part`, `ServiceOrder`, etc.) — ver tabela de mapeamento português→inglês no `CLAUDE.md` da API se precisar.

### Endpoints por módulo (path — método — resumo)
- **Workshops**: `POST /workshops/signup` (público, cria tenant+User ADMIN+Subscription BASIC) · `GET /workshops/me` · `GET/PUT /workshops` (update: nome/telefone/e-mail/**endereço completo (rua/número/complemento/bairro/cidade/UF/CEP, todos opcionais, adicionado 27/10)**/logo, CNPJ não editável) · `GET /workshops` e `DELETE /workshops/:id` (só `SUPER_ADMIN`) · `POST /workshops/upgrade-to-pro` · `POST /workshops/subscribe-to-basic` · `POST /workshops/cancel-subscription` · `GET/PUT /workshops/:id/fiscal-settings`. Resposta de `Workshop` agora sempre tem `address: {street,number,complement,neighborhood,city,state,zip_code}` (objeto aninhado, igual ao de `WorkshopFiscalSettings`).
- **Users** (equipe): `POST /users` · `GET /users` (paginado) · `PUT /users` · `GET /users/show/:id` · `GET /users/me` · `PATCH /users/password` · `DELETE /users/:id`.
- **Customers**: `POST /customers` · `GET /customers` · `PUT /customers` · `GET /customers/:id`. `ADMIN`/`RECEPTIONIST` criam/editam; `MECHANIC` só lista.
- **Vehicles**: `POST /vehicles` · `GET /vehicles` (filtro `?customerId=`) · `PUT /vehicles` (placa não editável) · `GET /vehicles/:id` · `GET /vehicles/:id/preventive-maintenance-insight` (**plano Pro só, 403 no Básico**).
- **Services** (catálogo): `POST/GET/PUT /services`, `GET /services/:id`.
- **Parts** (estoque): `POST/GET/PUT /parts` (sku e quantity não editáveis via PUT), `GET /parts/:id`, `POST/GET /parts/:id/stock-movements`.
- **ServiceOrders** (núcleo): `POST/GET/PUT /service-orders`, `GET /service-orders/:id`, `GET /service-orders/:id/report-data` (consolidado pra impressão), `PATCH /service-orders/:id/status` (máquina de estados), `PATCH /service-orders/:id/urgency-feedback` (só `MECHANIC`), `PATCH /service-orders/:id/service-summary`, `GET /service-orders/:id/invoice` + `POST .../invoice/retry`, `POST /service-orders/:id/items` + `DELETE .../items/:itemId`, `POST/GET /service-orders/:id/payments` + `POST .../payments/:id/confirm` + `POST .../payments/:id/cancel`, `POST/GET/DELETE /service-orders/:id/checklist-photos`, `POST /service-orders/:id/public-link/regenerate`.
  - `GET /service-orders` aceita filtros `?customerId=&vehicleId=&status=&searchParam=&aiUrgencySuggestion=&sortBy=urgency`.
  - `MECHANIC` participa de add/remove item, update geral e avançar status (mas **não** cancela — só `ADMIN`/`RECEPTIONIST`).
- **Relatórios**: `GET /service-order-payments/report?from=&to=` (cada pagamento vem com `order_code`/`customer_name` desde 27/10, além dos campos normais de `ServiceOrderPayment` — ver `ServiceOrderPaymentsReportItem` no `openapi.yaml` da API) · `GET /service-order-payments/monthly-report` (apareceu no `openapi.yaml`, agregado por mês — **não confirmado ainda** se é o endpoint de faturamento histórico que o Dashboard estava esperando, checar antes de usar).
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
- **pdfmake** `^0.2.23` + `@types/pdfmake` — instalado em 27/10/2026 pro relatório financeiro (`src/report/`, módulo replicado do admin-web-amip).
- **`@formkit/tempo`** `^1.1.0` — instalado e migrado em 27/10/2026 (`src/report/header.ts`, `src/pages/configuracoes/index.page.tsx`) — ver seção "Como trabalhar" no topo deste arquivo pra sintaxe de escape de literais.
- **`recharts`** `^3.10.1` — instalado em 28/10/2026 pro gráfico de faturamento do `/dashboard` (decisão confirmada com o usuário, ver "Estado atual"). Primeira lib de gráfico do projeto; suporta React 19 nativamente (sem precisar de `--legacy-peer-deps`).
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
│   ├── signup/index.page.tsx            # Signup, 3 passos (ver "Estado atual")
│   ├── forgot-password/index.page.tsx   # Esqueci minha senha
│   ├── reset-password/index.page.tsx    # Redefinir senha (lê ?token= da URL)
│   ├── dashboard/index.page.tsx  # Dashboard — concluída (28/10), ver "Estado atual"
│   └── configuracoes/index.page.tsx     # Dados da oficina + plano + relatório — ver "Estado atual" (testada e commitada)
├── components/
│   ├── AppShell/       # sidebar + topbar das telas autenticadas
│   ├── AuthShell/      # moldura das telas de auth (Welcome/Login/Signup/forgot-reset-password)
│   ├── Logo/           # logomarca oficial (src/assets/), variantes auto/light/dark/iconOnly
│   ├── Menubar/        # navegação da sidebar (ícones Phosphor, colapsa <880px)
│   ├── ThemeToggle/    # toggle de tema (ícone sol/lua)
│   ├── PlanCard/       # card de plano selecionável (RadioGroup do Radix), usado no Signup
│   ├── Form/
│   │   ├── Button/, Input/, InputFormControl/, ForgotPassword/, InputMask/, InputMaskFormControl/   # reconstruídos, OK (InputMask* reconstruído em 27/10 — era QUEBRADO, ver histórico se precisar)
│   │   └── AlertDialog/, SelectPicker/, Switch/  # ainda QUEBRADOS, ver abaixo
│   ├── Container/, ErrorAlert/, SuccessAlert/   # reaproveitáveis, token de cor a conferir ao usar
│   └── BulletEnabled/, Editor/, Pagination/     # QUEBRADOS, ver abaixo
├── hooks/
│   ├── auth.tsx        # AuthContext (signIn, signUp, signOut, updateToken, usuário logado) — Axios direto
│   ├── workshop.ts      # useWorkshop (TanStack Query, queryFn inline), IWorkshop agora com `address`
│   └── dashboard.ts     # 5 hooks de dados do /dashboard (TanStack Query, queryFn inline) — ver "Estado atual"
├── report/              # módulo de relatório em PDF (pdfmake), replicado do admin-web-amip
│   ├── docDefinitions.ts, header.ts, footer.ts, stylesTable.ts, table.ts
├── lib/
│   ├── api.ts           # setupAPIClient(context?) — axios com interceptor de refresh token (401)
│   ├── apiClient.ts      # instancia o client (uso client-side) — export { api }
│   ├── queryClient.ts
│   └── errors/AuthTokenError.ts
└── utils/
    ├── withSSRAuth.ts   # HOC de getServerSideProps p/ rotas autenticadas
    ├── withSSRGuest.ts  # HOC de getServerSideProps p/ rotas só-para-visitante
    ├── orderStatus.ts   # label PT-BR + cor por OrderStatus (compartilhado, usado no /dashboard e futuramente no Kanban/Orçamentos)
    └── no-image.ts
```

## Pendências / próximos passos

**`/configuracoes` concluída** (27/10) — ver "Estado atual" acima. Único detalhe não coberto: gerar o PDF do relatório com linhas de pagamento reais (só o caso vazio foi testado na UI; `header.ts` foi validado isoladamente com a logo/data reais). Se for mexer em `table.ts`/`docDefinitions.ts` futuramente, vale montar uma OS com pagamento de verdade (cliente+veículo+serviço+OS via API) pra testar o PDF completo no navegador.

**`/dashboard` concluída nesta sessão** (28/10) — ver "Estado atual" acima, inclusive o que não foi testado (Insights por IA com workshop Pro de verdade). **Ainda não commitada** — próxima sessão deve revisar e commitar (`package.json`/`package-lock.json` com `recharts` novo, `src/hooks/dashboard.ts`, `src/utils/orderStatus.ts`, `src/pages/dashboard/index.page.tsx` reescrita).

**Próxima coisa a fazer: `/clientes-veiculos`** (Clientes & Veículos — tabela de clientes com veículos aninhados) — é a tela mais lógica a seguir, já que o Dashboard, o CTA do estado vazio e o botão "Cadastrar primeiro cliente" apontam pra ela, e sem ela não dá pra popular dado de teste pela UI (precisou de seed via `curl` direto na API nesta sessão). Precisa de alinhamento com o usuário (passo a passo, como de costume) sobre layout exato antes de codar.

**Telas ainda não construídas** (rotas citadas no app, mas sem página — dão 404 hoje):
- `/orcamentos`, `/ordens-de-servico` (Kanban, 9 colunas incl. `REJECTED`), `/clientes-veiculos`, `/produtos`. (Signup, forgot/reset-password, Configurações e Dashboard já saíram desta lista — ver "Estado atual".)

**Componentes legados ainda quebrados** (do template reaproveitado — cor antiga SCREAMING_CASE inexistente nos tokens atuais, `tailwind-variants` não instalado, e/ou lib faltando): `BulletEnabled`, `Editor` (também falta `@mdxeditor/editor` inteiro), `Pagination`, `Form/AlertDialog` (falta `@radix-ui/react-alert-dialog`), `Form/SelectPicker`, `Form/Switch` (falta `@radix-ui/react-switch`). `Form/InputMask`/`Form/InputMaskFormControl` **já foram reconstruídos** (27/10, usando `react-imask` de verdade — ver "Como trabalhar" acima). **Decisão do usuário**: conserta cada um só quando a tela que precisa dele for construída, não todos de uma vez. `ContactForm` e o `Layout` antigo (shell genérico, substituído por `AppShell`/`AuthShell`) já foram **apagados** por não terem uso no produto.

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
