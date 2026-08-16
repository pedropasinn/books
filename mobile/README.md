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

Um cartão por vez, ocupando a tela. Para passar, três caminhos — o que a mão
pedir na hora:

- **arrastar** para cima **ou para o lado** → próximo; o contrário → anterior;
- **tocar** na direita da tela → próximo; na esquerda → anterior;
- **botão redondo** no rodapé → próximo.

Os outros dois botões do rodapé salvam o trecho e abrem a **leitura dinâmica**
(RSVP) daquele fragmento. Com "emendar no próximo" ligado, ao terminar um
fragmento ele já avança e continua — dá para ler um capítulo inteiro sem
encostar na tela.

O ícone de embaralhar, no topo, troca para o modo **Explorar**: trechos
sorteados de todos os livros baixados, sem ordem. É o modo "só mais um".

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

Em **Ajustes → Sua biblioteca**, informe o endereço do site e a senha (a mesma
`SITE_PASSWORD`, ou um `MOBILE_SYNC_TOKEN` dedicado). O app baixa o catálogo e,
ao abrir um livro, o texto integral — que fica guardado no aparelho. Depois
disso o feed funciona offline.

Sem servidor também dá: **Biblioteca → Colar texto** cria um livro local a
partir de qualquer texto colado.

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
