# Audiobook Lab

Biblioteca pessoal de podcasts por capítulo. Cada livro vira uma série de episódios curtos (script + áudio gerado por TTS), com player, progresso, leitor EPUB e — em fase posterior — sincronização palavra-a-palavra (karaoke).

## Estrutura

```
/home/pedro/repo/books/
├── content/                       ← source of truth (fora do app)
│   └── <slug>/
│       ├── book.yml               metadados
│       ├── cover.jpg
│       ├── book.epub              (opcional, p/ leitor)
│       ├── scripts/NN_titulo.txt
│       ├── audio/NN_titulo.mp3    (gerado externamente — OmniVoice)
│       └── alignment/NN_titulo.json (gerado por WhisperX — fase karaoke)
└── site/                          ← este projeto Next.js
```

## Fluxo de trabalho

```bash
cd site/
pnpm exec next dev --port 4444   # localhost:4444
pnpm ingest                       # re-sincroniza /content → SQLite. Idempotente.
pnpm new-book <slug>              # scaffold de /content/<slug>/
pnpm db:studio                    # interface visual do banco
```

Adicionar um livro novo:

1. `pnpm new-book sapiens` — cria estrutura
2. Editar `content/sapiens/book.yml`
3. Colocar `cover.jpg` e `book.epub` em `content/sapiens/`
4. Escrever scripts em `content/sapiens/scripts/01_titulo.txt`, `02_...`, ...
5. (externo) Gerar áudios no OmniVoice → `content/sapiens/audio/NN_titulo.mp3`
6. `pnpm ingest` — site exibe imediatamente

## Pipeline de áudio

Os scripts são gerados manualmente (ou por outro Claude) e colocados em `scripts/`. O áudio vem do OmniVoice (fluxo externo). O ingest detecta automaticamente:

| Tem script | Tem mp3 | Tem alignment | status          |
|------------|---------|---------------|-----------------|
| ✓          | —       | —             | `audio_pending` |
| ✓          | ✓       | —             | `aligned`       |
| ✓          | ✓       | ✓             | `ready`         |

O player aparece quando há mp3. O karaoke (highlight palavra-a-palavra) liga quando há alignment JSON.

## App Android (Fragmentos)

O APK vive em `../mobile/` (Vite + React + Capacitor) e lê os mesmos livros em
formato de feed: um fragmento curto por tela, passando com o dedo, com o RSVP
a um toque e lembretes diários. Veja `mobile/README.md`.

O app consome duas rotas JSON deste projeto, fora do gate de senha do
`proxy.ts` e autenticadas por header `Authorization: Bearer <token>`:

| Rota                       | Devolve                                   |
|----------------------------|-------------------------------------------|
| `GET /api/mobile/library`  | catálogo: livros + índice de capítulos    |
| `GET /api/mobile/book/:slug` | texto integral do livro (leitura offline) |

O token aceito é **somente** `MOBILE_SYNC_TOKEN` — a `SITE_PASSWORD` não vale
aqui, de propósito. O token fica guardado no celular (e entra no backup do
Android), então precisa ser descartável: sumindo o aparelho, troca-se a
variável e o acesso morre, sem mexer na senha que abre o site inteiro.

```bash
# .env.local (e nas env vars da Vercel)
MOBILE_SYNC_TOKEN=$(openssl rand -base64 32)
```

Sem a variável definida, as rotas respondem `503` com a explicação, em vez de
`401` — erro de configuração do servidor não deve mandar você procurar o
problema no celular.

## Fases futuras

**Fase 2 — Karaoke (forced alignment).** Script Python rodando WhisperX em pt-BR pra gerar `alignment/NN_*.json` no formato `[{word, start, end}]`. O player já consome esse JSON — só falta o gerador.

**Fase 5 — Deploy público.**

- DB: trocar `LIBSQL_URL=file:./local.db` por URL Turso + `LIBSQL_AUTH_TOKEN`. Schema é idêntico.
- Assets: o atual `app/content/[...path]/route.ts` serve arquivos locais. Pra prod, fazer upload pra Supabase Storage (ou R2) e trocar `coverUrl`/`audioUrl`/`epubUrl` na tabela `books`/`episodes` por URLs absolutas.
- Auth: adicionar Supabase Auth (magic link); `NEXT_PUBLIC_USER_ID` vira `auth.user.id`.
- Vercel: `vercel link` + env vars; sem ajustes de código.

## Stack

- Next.js 16 (App Router, async params, Turbopack default)
- shadcn/ui · Tailwind 4
- Drizzle ORM · libSQL (SQLite local; Turso em prod)
- react-reader + epub.js
- TypeScript estrito

## Atalhos do player

| Tecla    | Ação            |
|----------|------------------|
| espaço, k | play/pausa      |
| ← / j    | −10 s           |
| → / l    | +10 s           |
| ↑        | velocidade ↑    |
| ↓        | velocidade ↓    |

No leitor EPUB: ← / → viram página.
