#!/usr/bin/env python3
"""Gera transcribe_colab.ipynb — processa TODA a serie no Colab GPU.
Fluxo: monta Google Drive -> descompacta os audios -> faster-whisper large-v3 (GPU)
-> traducao EN->PT (MarianMT GPU) -> segments.json + .srt por episodio, salvos
INCREMENTALMENTE no Drive (resiste a queda de sessao; pula os ja feitos)."""
import json, pathlib, csv

HERE = pathlib.Path(__file__).parent
# le titulos do manifesto p/ embutir no meta de cada episodio
TITLES = {}
with open(HERE / "episodes.tsv", encoding="utf-8") as f:
    for row in csv.reader(f, delimiter="\t"):
        if len(row) >= 4:
            TITLES[f"ep{row[0]}_{row[2]}"] = row[3]

def md(*lines):
    return {"cell_type": "markdown", "metadata": {}, "source": [l + "\n" for l in lines]}

def code(*lines):
    return {"cell_type": "code", "metadata": {}, "execution_count": None,
            "outputs": [], "source": [l + "\n" for l in lines]}

cells = [
    md("# The Rest Is History — A Revolucao Francesa (EN + PT)",
       "Transcreve **todos os 13 episodios** com **Whisper large-v3** (timestamps por palavra)",
       "e traduz **EN->PT**. Saida: `segments.json` + `.srt` por episodio.",
       "",
       "## Antes de rodar",
       "1. Suba **`french_revolution_audios.zip`** para a raiz do seu Google Drive (MyDrive).",
       "2. `Ambiente de execucao -> Alterar tipo -> GPU (T4)`.",
       "3. `Ambiente de execucao -> Executar tudo` e autorize a montagem do Drive.",
       "",
       "Leva ~1-2 h numa T4. Cada episodio e salvo no Drive assim que termina - se a",
       "sessao cair, e so rodar de novo que ele pula os ja prontos. No fim baixa um zip."),

    md("## 1. Dependencias"),
    code("!pip -q install -U faster-whisper transformers sentencepiece sacremoses srt",
         "import torch",
         "assert torch.cuda.is_available(), 'Ative a GPU: Ambiente de execucao -> Alterar tipo -> GPU'",
         "print('GPU:', torch.cuda.get_device_name(0))"),

    md("## 2. Montar o Google Drive"),
    code("from google.colab import drive",
         "drive.mount('/content/drive')",
         "import pathlib",
         "DRIVE = pathlib.Path('/content/drive/MyDrive')",
         "OUT   = DRIVE / 'fr_outputs'      # resultados (persistem no Drive)",
         "OUT.mkdir(exist_ok=True)",
         "print('saida:', OUT)"),

    md("## 3. Descompactar os audios"),
    code("import zipfile, pathlib",
         "ZIP = DRIVE / 'french_revolution_audios.zip'",
         "assert ZIP.exists(), f'Suba o zip para {ZIP} antes de rodar.'",
         "AUD = pathlib.Path('/content/audios'); AUD.mkdir(exist_ok=True)",
         "with zipfile.ZipFile(ZIP) as z: z.extractall(AUD)",
         "eps = sorted(p.parent.name for p in AUD.glob('ep*/audio.mp3'))",
         "print(len(eps), 'episodios:'); [print(' ', e) for e in eps]"),

    md("## 4. Carregar os modelos (Whisper large-v3 + tradutor EN->PT)"),
    code("from faster_whisper import WhisperModel",
         "from transformers import MarianMTModel, MarianTokenizer",
         "",
         "asr = WhisperModel('large-v3', device='cuda', compute_type='float16')",
         "",
         "MT = 'Helsinki-NLP/opus-mt-tc-big-en-pt'",
         "tok = MarianTokenizer.from_pretrained(MT)",
         "mt  = MarianMTModel.from_pretrained(MT).to('cuda').eval()",
         "print('modelos prontos')"),

    md("## 5. Funcoes: transcrever, traduzir, gravar"),
    code("import json, datetime, srt, torch",
         "",
         "TITLES = " + json.dumps(TITLES, ensure_ascii=False),
         "",
         "def transcribe(path):",
         "    segs, info = asr.transcribe(str(path), language='en',",
         "                                word_timestamps=True, vad_filter=True,",
         "                                beam_size=5)",
         "    out = []",
         "    for s in segs:",
         "        words = [{'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3)}",
         "                 for w in (s.words or []) if w.word.strip()]",
         "        out.append({'start': round(s.start, 3), 'end': round(s.end, 3),",
         "                    'en': s.text.strip(), 'words': words})",
         "    return out",
         "",
         "def translate(texts, bs=32):",
         "    res = []",
         "    for i in range(0, len(texts), bs):",
         "        batch = [(t or ' ') for t in texts[i:i+bs]]",
         "        enc = tok(batch, return_tensors='pt', padding=True,",
         "                  truncation=True, max_length=512).to('cuda')",
         "        with torch.no_grad():",
         "            gen = mt.generate(**enc, num_beams=4, max_length=512)",
         "        res += tok.batch_decode(gen, skip_special_tokens=True)",
         "    return res",
         "",
         "def td(x): return datetime.timedelta(seconds=float(x))",
         "",
         "def write_outputs(ep, segs):",
         "    pt = translate([s['en'] for s in segs])",
         "    data, su_en, su_pt = [], [], []",
         "    for i, (s, p) in enumerate(zip(segs, pt)):",
         "        s['i'] = i; s['pt'] = p.strip()",
         "        data.append(s)",
         "        su_en.append(srt.Subtitle(i+1, td(s['start']), td(s['end']), s['en']))",
         "        su_pt.append(srt.Subtitle(i+1, td(s['start']), td(s['end']), p.strip()))",
         "    d = OUT / ep; d.mkdir(exist_ok=True)",
         "    meta = {'episode': ep, 'title': TITLES.get(ep, ep),",
         "            'show': 'The Rest Is History', 'model': 'large-v3', 'n_segments': len(data)}",
         "    with open(d/'segments.json','w',encoding='utf-8') as f:",
         "        json.dump({'meta': meta, 'segments': data}, f, ensure_ascii=False, indent=1)",
         "    with open(d/'transcript.en.srt','w',encoding='utf-8') as f: f.write(srt.compose(su_en))",
         "    with open(d/'transcript.pt.srt','w',encoding='utf-8') as f: f.write(srt.compose(su_pt))"),

    md("## 6. Processar todos (incremental - pula os ja feitos)"),
    code("import time",
         "for ep in eps:",
         "    if (OUT / ep / 'segments.json').exists():",
         "        print(f'[skip] {ep}'); continue",
         "    t0 = time.time()",
         "    print(f'[asr ] {ep} ...', flush=True)",
         "    segs = transcribe(AUD / ep / 'audio.mp3')",
         "    write_outputs(ep, segs)",
         "    print(f'[ ok ] {ep}: {len(segs)} segmentos em {(time.time()-t0)/60:.1f} min')",
         "print('CONCLUIDO - resultados em', OUT)"),

    md("## 7. Baixar os resultados (tambem ja estao no seu Drive em `fr_outputs/`)"),
    code("import shutil",
         "shutil.make_archive('/content/fr_outputs', 'zip', str(OUT))",
         "from google.colab import files",
         "files.download('/content/fr_outputs.zip')"),
]

nb = {
    "cells": cells,
    "metadata": {
        "accelerator": "GPU",
        "colab": {"provenance": [], "gpuType": "T4", "toc_visible": True},
        "kernelspec": {"display_name": "Python 3", "name": "python3"},
        "language_info": {"name": "python"},
    },
    "nbformat": 4,
    "nbformat_minor": 0,
}

out = HERE / "transcribe_colab.ipynb"
out.write_text(json.dumps(nb, ensure_ascii=False, indent=1), encoding="utf-8")
print("escrito:", out, "-", len(cells), "celulas,", len(TITLES), "titulos")
