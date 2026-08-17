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
│   │   ├── outline.ts        índice: capítulos, marcadores e números dos cartões
│   │   ├── position.ts       posição por (capítulo, palavra) e regra de avanço
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

### Índice: capítulos, marcadores e números

O ícone de lista no topo do feed (ou um toque no "Capítulo · 3/12") abre o
índice do livro. Cada capítulo mostra quantos cartões tem, quantos trechos
você marcou nele e quanto já leu; o capítulo aberto vem expandido, com a
**grade dos números dos cartões**:

```
  ┌────┬────┬────┬────┐
  │ 1  │ 2 •│ 3  │ 4  │   • = tem trecho marcado
  └────┴────┴────┴────┘   cheio = onde você está
                          apagado = já lido
```

Tocar num número pula direto para aquele cartão — é o equivalente a virar para
uma página. O botão de marcador na barra filtra só os capítulos que guardam
trechos salvos, então dá para ir de marcador em marcador sem sair do índice.

Na aba Hábito, tocar num trecho salvo **volta ao contexto**: abre o livro (se
for outro) e cai no ponto exato de onde ele saiu.

Os números vêm da mesma lista de fragmentos que o feed usa, então continuam
batendo quando o tamanho do fragmento muda — e o salto é gravado como posição
de leitura normal, em palavra.

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

## Posição, progresso e hábito

A unidade é sempre **(capítulo, palavra)** — nunca "fragmento 37". Índice de
fragmento muda com o tamanho escolhido, com o tamanho da tela e com a fonte:
o cartão 37 de hoje não é o trecho de amanhã, e guardar isso apodreceria o
histórico. Palavra é propriedade do texto, não da renderização.

São dois pontos distintos por livro:

- **retomada** — onde você parou, para onde o app volta;
- **mais distante** — o ponto mais adiantado que você realmente leu.

Reler para trás move o primeiro e não o segundo. É o segundo que alimenta a
barra de progresso da Biblioteca e o contador do dia, então voltar e avançar de
novo não infla nada.

O modo **Explorar** conta para a meta do dia (ler é ler), mas **não toca na
posição de nenhum livro**: os trechos vêm sorteados de qualquer capítulo, e se
mexessem no progresso, cair num trecho do capítulo 17 apagaria o lugar onde a
leitura estava — o app reabriria lá.

Bater a meta mantém a sequência viva.

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

**Sincronizar com o site**: em Ajustes → Sua biblioteca, informe o endereço e o
`MOBILE_SYNC_TOKEN`. O app baixa o catálogo e, ao abrir um livro, o texto
integral.

O token é **exclusivo do app** — a senha do site não é aceita, de propósito. Ele
fica guardado no aparelho e entra no backup do Android, então precisa ser
descartável: se o celular sumir, troca-se a variável de ambiente no site e o
acesso morre, sem mexer na senha que abre tudo. Sem `MOBILE_SYNC_TOKEN` definido,
as rotas respondem 503 explicando o que falta em vez de 401.

Na Biblioteca, **Baixar** e **abrir** são coisas separadas: baixar traz o texto
para o aparelho sem interromper o que você está lendo.

Também dá para **colar texto** direto, para um trecho avulso.

## Desenvolvimento

```bash
npm install
npm run dev      # navegador, em localhost:5273 (sem notificações nativas)
npm run test     # testes de unidade (vitest)
npm run build    # gera dist/
npm run e2e      # testes de ponta a ponta sobre o build (Playwright)
npm run sync     # build + copia para o projeto Android
npm run apk      # sync + APK de debug
```

### Testes

`npm run test` cobre a lógica pura, que é onde um erro passa despercebido e
estraga o histórico meses depois: corte de fragmentos, recuperação da posição
ao mudar o tamanho do cartão, avanço × releitura, streak, pivô e pausas do
RSVP, parser de TXT (incluindo o fallback de windows-1252) e normalização da
URL do servidor.

`npm run e2e` roda o app **buildado** num Chromium, em três suítes:

| Suíte | Cobre |
|-------|-------|
| `feed` | as três formas de avançar, RSVP, hábito, persistência, mudar o tamanho do fragmento |
| `foco` | abertura em modo foco, faixas de toque, auto-esconder, e a medição de que **nenhum fragmento vaza** do cartão |
| `import` | TXT, EPUB e PDF de ponta a ponta, conferindo o resultado no IndexedDB |
| `indice` | capítulos, marcadores, salto pelos números e volta ao contexto |

As fixtures de EPUB e PDF são **geradas em código** (`e2e/fixtures.mjs`), não
arquivos binários commitados: a suíte roda offline, sem depender de download, e
o gerador é obrigado a produzir arquivos válidos de verdade.

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
