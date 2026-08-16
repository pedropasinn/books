# Fragmentos

App Android para ler os livros da biblioteca em pedacinhos — um fragmento por
tela, passando com o dedo — com lembretes diários para cutucar o hábito.

É o RSVP do site levado para o celular, com uma camada de feed em volta: o
texto chega em cartões curtos, e a leitura dinâmica (uma palavra por vez, letra
de foco ancorada) continua ali, a um toque de distância.

```
mobile/
├── src/
│   ├── lib/
│   │   ├── import/           EPUB, PDF e TXT → capítulos (carregado sob demanda)
│   │   ├── fragments.ts      corta o capítulo em cartões (respeitando frases)
│   │   ├── rsvp.ts           pivô/ORP e pausa por pontuação (portado do site)
│   │   ├── store.tsx         estado do app (contexto React)
│   │   ├── storage.ts        Preferences (estado) + IndexedDB (texto dos livros)
│   │   ├── sync.ts           cliente das rotas /api/mobile/* do site
│   │   ├── notifications.ts  lembretes locais diários
│   │   └── habit.ts          streak, meta do dia, histórico
│   ├── screens/              Feed · Biblioteca · Hábito · Ajustes
│   └── components/           RsvpOverlay, ícones
├── android/                  projeto nativo (Capacitor)
└── scripts/gen-icons.py      gera ícones e splash a partir da marca
```

## Como se lê

Abre em **modo foco**: a tela inteira é o texto, sem barras, botões ou abas —
nem a barra de status do Android. O toque divide a tela em três faixas:

```
┌────────┬──────────────────────┬────────┐
│anterior│  controles on/off    │próximo │
└────────┴──────────────────────┴────────┘
    28%            44%              28%
```

**Arrastar** funciona em qualquer ponto e nos dois eixos: para cima ou para o
lado passa adiante, o contrário volta. Com os controles à vista, o **botão
redondo** do rodapé também avança — e eles somem sozinhos depois de alguns
segundos parados, devolvendo a tela ao texto.

Os outros dois botões do rodapé salvam o trecho e abrem a **leitura dinâmica**
(RSVP) daquele fragmento. Com "emendar no próximo" ligado, ao terminar um
fragmento ele já avança e continua — dá para ler um capítulo inteiro sem
encostar na tela.

O ícone de embaralhar, no topo, troca para o modo **Explorar**: trechos
sorteados de todos os livros baixados, sem ordem. É o modo "só mais um".

### O texto sempre cabe

Um cartão é uma tela: cortar o texto em cima e embaixo seria pior do que
qualquer alternativa. Três mecanismos garantem isso, nesta ordem:

1. **o corte enxerga as quebras de linha do original** — em verso, diálogo e
   lista quase não há ponto final, e sem isso o fragmento crescia até o limite
   duro e estourava a tela. Os versos também são preservados na exibição, em
   vez de virarem um parágrafo corrido;
2. **o tamanho do fragmento é limitado pelo que cabe** — o ajuste é um pedido,
   e a tela é o teto real: o app mede quantas linhas cabem e qual a largura
   média de caractere na fonte escolhida, e usa o menor dos dois;
3. **auto-fit** — o que ainda assim passar do espaço tem a fonte reduzida até
   caber, antes do primeiro quadro (nada "pula" na tela).

A área reservada ao texto **não muda** entre o modo foco e os controles à
vista. Se mudasse, cada toque no meio da tela recortaria o livro em fragmentos
diferentes e a leitura perderia o lugar; no modo foco a área extra vira margem.

## Hábito

Cada fragmento novo conta para a meta do dia (o anel no topo do feed). Bater a
meta mantém a sequência viva. Voltar atrás e reler não conta de novo — o
contador só anda quando a leitura avança de verdade.

## Lembretes

Notificações **locais** (não precisam de internet nem de servidor de push),
uma por horário configurado em Ajustes, repetindo todo dia. O corpo da
notificação é o **começo do próximo fragmento** — a isca é o texto em si, não
um "hora de ler!". As prévias são reescritas toda vez que o app é aberto ou
fechado, para acompanharem onde a leitura parou.

No Android 13+ o app pede a permissão de notificação na primeira vez que os
lembretes são ligados. Para o lembrete cair no minuto exato, ligue também
**Alarmes e lembretes** em *Configurações → Apps → Fragmentos*; sem isso o
Android agenda de forma inexata e a notificação pode atrasar alguns minutos.

## Conteúdo

Duas portas de entrada, e as duas guardam o livro no aparelho para ler offline.

**Importar arquivo** (Biblioteca → *Importar EPUB, PDF ou TXT*), sem depender
de servidor nenhum. O parsing roda no próprio celular:

| Formato | Capítulos | Metadados | Observação |
|---------|-----------|-----------|------------|
| `.epub` | um por documento do spine, com os títulos do sumário (`nav` ou `ncx`) | título e autor do OPF | descarta imagens/CSS na descompactação e pula a página de índice |
| `.pdf`  | pelos marcadores do PDF; sem eles, blocos de 12 páginas | título e autor do PDF, quando houver | reconstrói parágrafos, junta palavras partidas no fim da linha e remove cabeçalho/rodapé repetido |
| `.txt` / `.md` | por `\f`, ou por linhas de cabeçalho ("Capítulo 3", "# Título") quando há pelo menos três | nome do arquivo | tenta UTF-8 e cai para windows-1252 se o arquivo vier acentuado errado |

PDF digitalizado (imagem pura, sem camada de texto) não dá — o app avisa em vez
de importar um livro vazio. Os parsers são carregados sob demanda: quem só lê
EPUB nunca baixa o pdf.js.

**Sincronizar com o site**: em Ajustes → Sua biblioteca, informe o endereço e a
senha (a mesma `SITE_PASSWORD`, ou um `MOBILE_SYNC_TOKEN` dedicado). O app baixa
o catálogo e, ao abrir um livro, o texto integral.

Também dá para **colar texto** direto, para um trecho avulso.

## Desenvolvimento

```bash
npm install
npm run dev      # navegador, em localhost:5273 (sem notificações nativas)
npm run build    # gera dist/
npm run sync     # build + copia para o projeto Android
npm run apk      # sync + APK de debug
```

O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`.

Para um APK assinado por você (permite atualizar por cima, sem desinstalar):

```bash
keytool -genkey -v -keystore fragmentos.keystore -alias fragmentos \
  -keyalg RSA -keysize 2048 -validity 10000

npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
$ANDROID_HOME/build-tools/35.0.0/apksigner sign \
  --ks ../fragmentos.keystore --ks-key-alias fragmentos \
  --out fragmentos.apk app/build/outputs/apk/release/app-release-unsigned.apk
```

Guarde o `.keystore` (ele está no `.gitignore`): sem ele, uma versão nova não
instala por cima da antiga.

## Instalar no celular

Copie o APK para o aparelho e abra. O Android vai pedir para autorizar
"instalar apps desconhecidos" para o app que estiver abrindo o arquivo
(Arquivos, Drive, Chrome) — é uma vez só.
