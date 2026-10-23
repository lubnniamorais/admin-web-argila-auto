# ArgilaAuto — Admin (admin-argila-auto)

Relatório de reconhecimento do projeto, gerado em 2026-10-22 para dar contexto a trabalhos futuros nesta base de código.

## Visão geral

Painel administrativo em Next.js (Pages Router) com TypeScript, React 19 e Tailwind CSS v4. O repositório tem apenas 1 commit (`c40ce04 Initial commit from Create Next App`) e todo o trabalho de customização ainda está **não commitado** (`git status` mostra o scaffold padrão do `create-next-app` deletado e uma pasta `src/` nova não rastreada). Ou seja: este é, na prática, o primeiro commit real do projeto, ainda não feito.

## Stack técnica

- **Next.js 16.4.2** (versão recente, com breaking changes relevantes — ver nota abaixo) + **React 19.3.0** / **React DOM 19.3.0**.
- **Pages Router** customizado: `pageExtensions: ['page.tsx', 'api.ts', 'api.tsx']` em [next.config.ts](next.config.ts), com as páginas vivendo em `src/pages/*.page.tsx` (não na raiz `pages/`, que ainda existe fisicamente mas está marcada para remoção no git).
- **Tailwind CSS v4** via `@tailwindcss/postcss` e `@tailwindcss/turbopack`.
- **Biome** (não ESLint/Prettier) para lint e format — config em [biome.json](biome.json).
- **TanStack Query v5** para data fetching/cache.
- **React Hook Form + Zod + @hookform/resolvers** para formulários/validação.
- **Axios + nookies** para cliente HTTP e cookies (auth via JWT em cookies, com refresh token).
- **Radix UI** (`react-select`, `react-radio-group`), `react-imask`, `next-themes`, `react-toastify`, `next-seo`.
- Alias de import: `@/*` → `./src/*` ([tsconfig.json](tsconfig.json)).

### Nota importante sobre o Next.js 16
O arquivo [AGENTS.md](AGENTS.md) na raiz é **gerado automaticamente pelo `next dev`** (confirmado em `node_modules/next/dist/server/lib/generate-agent-files.js`) porque esta versão do Next.js tem mudanças de convenção que diferem do que modelos de IA "sabem de treino". Ele aponta para `node_modules/next/dist/docs/` como fonte de verdade — vale consultar essa pasta antes de alterações estruturais (roteamento, config, etc.), já que o comportamento pode não ser o do Next.js "clássico".

## Estrutura de diretórios (`src/`)

```
src/
├── pages/            # rotas (Pages Router, extensão .page.tsx)
│   ├── _app.page.tsx
│   ├── _document.page.tsx
│   ├── index.page.tsx        # reexporta a página de login
│   └── login/index.tsx       # tela de login real
├── components/        # componentes de UI
│   ├── Form/          # Button, Input, InputMask, SelectPicker, Switch, AlertDialog, ForgotPassword...
│   ├── Layout, Container, Pagination, Editor, ContactForm,
│   │   BulletEnabled, ErrorAlert, SuccessAlert, ThemeToggle
├── hooks/auth.tsx     # AuthContext (signIn, signOut, updateToken, usuário logado)
├── lib/
│   ├── api.ts          # instancia o client (uso client-side)
│   ├── apiClient.ts     # setupAPIClient(context?) — axios com interceptor de refresh token (401)
│   ├── queryClient.ts
│   └── errors/AuthTokenError.ts
└── utils/
    ├── withSSRAuth.ts   # HOC de getServerSideProps p/ rotas autenticadas
    ├── withSSRGuest.ts  # HOC de getServerSideProps p/ rotas só-para-visitante
    └── no-image.ts
```

## Autenticação

- Login via `POST /sessions` (email/senha) → recebe `token` + `refresh_token`, salvos em cookies por 30 dias.
- Refresh automático em `apiClient.ts` via interceptor de resposta 401, com fila de requisições pendentes (`failedRequestQueue`) enquanto o token é renovado.
- `withSSRAuth` / `withSSRGuest` protegem rotas no SSR redirecionando para `/` ou `/dashboard`.
- **Atenção:** os cookies usam o prefixo `autismo:token` / `autismo:refresh_token` (ex.: [auth.tsx:45](src/hooks/auth.tsx:45), [apiClient.ts:24](src/lib/apiClient.ts:24)). Isso é um forte indício de que o código de auth foi copiado de outro projeto (aparentemente ligado a autismo/cuidado infantil — o título da página de login é *"Meu neném bem"*, ver [login/index.tsx:76](src/pages/login/index.tsx:76)) e **ainda não foi adaptado** para o domínio "ArgilaAuto". Vale revisar/renomear antes de ir para produção.
- `NEXT_PUBLIC_API_URL` é a única env var esperada ([.env.example](.env.example)), e está vazia no `.env` local — o backend/API consumida por este admin ainda não está configurado aqui.

## Estado atual (incompleto / pontos de atenção)

1. **Componentes faltantes**: `src/pages/login/index.tsx` importa `@/components/Footer` e `@/components/Typography`, e `src/components/Layout/index.tsx` importa `../Footer` e `../Header` — nenhum desses existe em `src/components/`. O build/typecheck quebra nesse estado.
2. **Dependências faltando no `package.json`**: `src/components/ContactForm` e `BulletEnabled` importam de `@phosphor-icons/react`, mas a dependência instalada é a lib antiga `phosphor-react`. `src/components/Editor` importa `@mdxeditor/editor`, que não consta em nenhuma dependência. Esses componentes não compilam no estado atual.
3. **Nada comitado ainda**: todo o diretório `src/`, `biome.json`, `postcss.config.js` e `.vscode/` estão como untracked; o scaffold antigo (`pages/`, `styles/`, `public/*`) está marcado como deletado mas não commitado.
4. **`public/` está vazio** — nenhum asset (favicon, imagens) foi adicionado ainda.
5. Em [login/index.tsx:40](src/pages/login/index.tsx:40), `zodResolver(loginFormSchema)` está comentado no `useForm`, então a validação Zod do formulário de login não está ativa de fato.

## Scripts

```bash
npm run dev      # next dev
npm run build    # next build
npm run start    # next start
npm run lint     # biome check
npm run format   # biome format --write
```

## Convenções de código observadas

- Componentes em `index.tsx` dentro de uma pasta com o nome do componente (padrão `PascalCase/index.tsx`).
- Aspas simples, ponto-e-vírgula obrigatório, trailing comma estilo ES5 (Biome).
- Muitas regras do Biome recomendado foram desativadas no [biome.json](biome.json) (ex.: `noExplicitAny` só como warn, `noNonNullAssertion` off, `useExhaustiveDependencies` off) — o projeto é mais permissivo que o padrão do Biome.
- Comentários `// FUNCTIONS` / `// END FUNCTIONS` são usados para seccionar hooks/handlers dentro de componentes (ver `auth.tsx`, `login/index.tsx`).
