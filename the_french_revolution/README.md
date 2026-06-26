# Karaokê — The Rest Is History: A Revolução Francesa (EN ↔ PT)

Ouça os episódios vendo, ao mesmo tempo, o que é dito em **inglês** e a **tradução em português**, com a linha (e a palavra) atual destacada. 13 episódios da saga da Revolução Francesa do podcast *The Rest Is History*.

## Estrutura

```
the_french_revolution/
├─ index.html                ← PÁGINA INICIAL: biblioteca dos 13 episódios
├─ karaoke.html              ← player (vídeo + leitura + sidebar de capítulos)
├─ episodes.js               ← metadados dos episódios (usado pelas 2 páginas)
├─ chapters.json             ← capítulos de cada vídeo (sidebar de navegação)
├─ transcribe_colab.ipynb    ← processa TODA a série no Colab GPU
├─ french_revolution_audios.zip  ← os 13 áudios (subir pro Drive)
├─ episodes.tsv              ← manifesto (índice, id, slug, título)
├─ epNN_slug/
│   ├─ audio.mp3             ← já baixado
│   └─ segments.json         ← gerado pelo Colab (alimenta o player)
│   └─ transcript.en/pt.srt  ← gerado pelo Colab (legendas p/ VLC)
```

## Passo a passo

### 1. Subir os áudios pro Drive
Arraste **`french_revolution_audios.zip`** (937 MB) para a **raiz** do seu Google Drive (MyDrive).
*Por que o zip e não o YouTube direto no Colab:* IPs de datacenter levam bloqueio anti-bot do YouTube. O áudio fica só na sua conta privada.

### 2. Rodar o notebook (Colab GPU, ~1–2 h, uma vez)
1. Suba `transcribe_colab.ipynb` em <https://colab.research.google.com>.
2. `Ambiente de execução → Alterar tipo → GPU (T4)`.
3. `Ambiente de execução → Executar tudo` → autorize a montagem do Drive.
4. Ele transcreve (**Whisper large-v3**, timestamps por palavra) e traduz (**EN→PT**, MarianMT) os 13, salvando cada um em `MyDrive/fr_outputs/epNN_slug/` assim que termina. No fim baixa `fr_outputs.zip`.

> Tolerante a falhas: se a sessão do Colab cair, rode de novo — ele pula os episódios já prontos.

### 3. Distribuir os resultados localmente
Descompacte `fr_outputs.zip` e jogue cada `segments.json` (+ `.srt`) na pasta `epNN_slug/` correspondente. Atalho:
```bash
# a partir do zip baixado:
python3 distribute_outputs.py fr_outputs.zip
```

### 4. Abrir o karaokê
```bash
cd books/the_french_revolution
python3 serve.py        # servidor local COM suporte a seek (Range); padrão porta 8000
# abra http://localhost:8000/index.html
```
> Use o `serve.py`, **não** o `python3 -m http.server` — este último não suporta HTTP Range,
> e sem isso o áudio não dá *seek* (clicar numa palavra/linha ou arrastar a barra volta ao início).
A **página inicial** (`index.html`) lista os 13 episódios em cards e mostra "Continuar ouvindo" de onde você parou. Clique num card → abre o player. (Sem servidor: dá pra abrir o `karaoke.html` direto e arrastar o `segments.json` + `audio.mp3` de um episódio.)

### Player (estilo ElevenReader)
- **Sidebar de capítulos** (de `chapters.json`): clique pula no tempo; o capítulo atual fica destacado. A troca de **episódio** acontece só ao terminar o atual (popup "próximo / reescutar") ou voltando à biblioteca.
- **Vídeo do YouTube** embutido e sincronizado com a fala (ícone de vídeo na topbar ou no painel): ocupa a metade superior, com **divisória arrastável** para ajustar a proporção. Mexer no vídeo move a legenda e vice-versa. Ocultando o vídeo, toca o `audio.mp3` local (funciona offline).
- Leitura central: linha **e palavra** atual destacadas; rolagem contínua suave. **Voltar ao trecho atual** quando você rola para longe.
- Barra de progresso clicável/arrastável; retoma de onde parou (salvo no navegador).
- **Painel "⋯"**: tema (noturno/claro/bege), idioma (ambos/inglês/português), tradução (embaixo/ao lado), cor do destaque, largura e tamanhos de fonte, mostrar/ocultar vídeo.

### Atalhos
- <kbd>espaço</kbd> play/pause · <kbd>←</kbd>/<kbd>→</kbd> ±5 s (<kbd>Shift</kbd> ±10 s) · <kbd>j</kbd>/<kbd>l</kbd> ±10 s · clique numa palavra/linha pula o áudio.

## Notas
- Tradução automática (MarianMT). Boa para acompanhar; revise trechos sutis se for citar.
- Episódios indisponíveis na playlist (3) foram ignorados.
