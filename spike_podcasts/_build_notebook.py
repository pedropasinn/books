"""
Builds Podcast_AfterTheSpike_OmniVoice.ipynb a partir dos 14 scripts em scripts/.

Run once locally: python _build_notebook.py
Output: Podcast_AfterTheSpike_OmniVoice.ipynb (sobe pro Colab).

Mesmo padrão do podcasts/Cont/PS/Entrevista — OmniVoice, cache MD5 da voz,
rsync local↔Drive entre sessões, MP3 libmp3lame 96k.
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).parent
SCRIPTS_DIR = ROOT / "scripts"
NB_PATH = ROOT / "Podcast_AfterTheSpike_OmniVoice.ipynb"

SCRIPT_FILES = sorted(SCRIPTS_DIR.glob("*.txt"))
PODCAST_TITLES = {
    "01_prologo":                "Prólogo — o livro que pede pra você pensar de novo",
    "02_o_pico":                 "Cap. 1 — O pico",
    "03_linha_divisoria":        "Cap. 2 — A linha divisória entre crescimento e decadência",
    "04_pessoas_e_planeta":      "Cap. 3 — O que as pessoas fazem ao planeta",
    "05_corpos_dos_outros":      "Cap. 4 — A população começa no corpo dos outros",
    "06_mundo_imperfeito":       "Cap. 5 — Adicionar novas vidas a um mundo imperfeito",
    "07_progresso_vem_de_pessoas":"Cap. 6 — Progresso vem de pessoas",
    "08_desviando_asteroide":    "Cap. 7 — Desviando do asteroide",
    "09_mais_bom_e_melhor":      "Cap. 8 — Mais bom é melhor",
    "10_nao_se_resolve_sozinho": "Cap. 9 — Despovoamento não se resolve sozinho",
    "11_controle_estatal":       "Cap. 10 — Controle estatal não pode forçar estabilização",
    "12_dinheiro_e_resposta":    "Cap. 11 — Dinheiro é a resposta?",
    "13_almeje_mais_alto":       "Cap. 12 — Almeje mais alto",
    "14_apendice_repugnante":    "Apêndice — A conclusão repugnante",
}


def md(src: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": src.splitlines(keepends=True)}


def code(src: str) -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": src.splitlines(keepends=True),
    }


# ---------- Carrega scripts e embute como dict Python ----------
podcasts_py = "PODCASTS = [\n"
for f in SCRIPT_FILES:
    key = f.stem
    title = PODCAST_TITLES.get(key, key)
    text = f.read_text(encoding="utf-8").strip()
    text_escaped = text.replace('"""', '\\"""')
    podcasts_py += f'    {{\n        "id": "{key}",\n        "title": "{title}",\n'
    podcasts_py += f'        "text": """{text_escaped}""",\n    }},\n'
podcasts_py += "]\n\nprint(f'✓ {len(PODCASTS)} podcasts carregados')\nfor p in PODCASTS:\n    print(f'  - {p[\"id\"]}: {p[\"title\"]} ({len(p[\"text\"])} chars)')\n"


cells = []

# Header
cells.append(md("""# Podcast — *After the Spike* (Dean Spears & Michael Geruso, 2025)

14 áudios MP3 em pt-BR, voz clonada via **OmniVoice**, cobrindo o livro inteiro: prólogo + 12 capítulos + apêndice. Substitui a leitura do livro.

Cada episódio tem ~1100-1600 palavras (≈ 7-10 min de áudio). Total ~2h30 — equivalente a destilar um livro de ~80 mil palavras.

Mesmo padrão de pipeline do `Podcast_Prepara_OmniVoice.ipynb` (case Contabilizei): mesma `voz.mp3`, fingerprint MD5 da voz no cache, rsync entre Colab e Drive.

**Pré-requisitos (uma vez):**
1. Runtime → Change runtime type → **T4 GPU**.
2. `voz.mp3` (~30s, mono, 16-24kHz) em `MyDrive/omnivoice/voz.mp3`.
3. Pasta `MyDrive/AfterTheSpike_Podcasts/` é criada automaticamente.

**O que esse notebook faz:**
- Instala OmniVoice + ffmpeg (sem TeXLive/Manim — pipeline leve)
- Carrega os 14 scripts já embutidos abaixo (nada pra subir)
- Para cada podcast: chunking por parágrafo, 1 wav por chunk, concatena com pausa de 0.4s
- Exporta MP3 (libmp3lame 96 kbps) por podcast
- Empacota num `after_the_spike_podcasts.zip` + download direto

**Tempo estimado:** ~25-40 min em T4 (14 episódios). Cache por hash do trecho + fingerprint MD5 da voz, então re-executar é barato.
"""))

# 1. GPU check
cells.append(md("## 1. Verificar GPU"))
cells.append(code("!nvidia-smi"))

# 2. Install deps
cells.append(md("## 2. Instalar dependências\n\nPrimeira execução: ~3-5 min (OmniVoice + pesos baixam na célula 6)."))
cells.append(code("""# 0) Limpa estado do apt (Colab às vezes tem dpkg interrompido + repo r2u quebrado)
!sudo dpkg --configure -a 2>&1 | tail -3
!sudo rm -f /etc/apt/sources.list.d/r2u.list /etc/apt/sources.list.d/cran*.list 2>/dev/null

# 1) Só ffmpeg + libsndfile
!apt-get -qq update 2>&1 | tail -3
!apt-get -qq install -y --fix-missing ffmpeg libsndfile1 2>&1 | tail -3

# 2) Toolchain Python atualizado
%pip install -q --upgrade pip setuptools wheel

# 3) OmniVoice (voice cloning)
import importlib.util
if importlib.util.find_spec('omnivoice') is None:
    print('→ instalando OmniVoice (~2-4 min)...')
    %pip install -q git+https://github.com/k2-fsa/OmniVoice.git
else:
    print('✓ OmniVoice já presente')

# 4) Reconcilia numpy (faixa OBRIGATÓRIA >=2.1,<2.2 — mesmo do notebook de produção)
%pip install -q --upgrade --force-reinstall --no-deps 'numpy>=2.1,<2.2'
%pip install -q soundfile pydub

# 5) Sanity check
import subprocess, sys
chk = subprocess.run(
    [sys.executable, '-c', 'import numpy; import soundfile; import torch; import torchaudio'],
    capture_output=True, text=True,
)
if chk.returncode != 0:
    print('❌ stack inconsistente:')
    print(chk.stderr[-800:])
    print('\\n⚠ Faça Runtime → Restart session e rode esta célula de novo.')
else:
    print('\\n✓ numpy / soundfile / torch / torchaudio OK')

import numpy
print(f'   numpy carregado: {numpy.__version__}  (esperado: 2.1.x)')
print(f'   se for 2.0.x ou 2.2.x → Runtime → Restart session e rode esta célula DE NOVO.')
"""))

# 3. Drive
cells.append(md("## 3. Montar Google Drive (pra pegar a voz de referência)"))
cells.append(code("""!fusermount -u /content/drive 2>/dev/null || true
!umount -l /content/drive 2>/dev/null || true
!rm -rf /content/drive

from google.colab import drive
drive.mount('/content/drive')
"""))

# 4. Paths
cells.append(md("""## 4. Configurar caminhos

- `REF_AUDIO`: voz de referência (`voz.mp3`) — mesmo path dos outros notebooks OmniVoice.
- `REF_AUDIO_TAG`: fingerprint MD5 da voz, entra no nome de cada WAV cacheado.
- `OUTPUT_DIR`: pasta no Drive onde MP3s, cache de WAVs e zip final ficam.
- `LOCAL_OUT`: cópia local rápida.
"""))
cells.append(code("""import os, hashlib

REF_AUDIO       = "/content/drive/MyDrive/omnivoice/voz.mp3"
OUTPUT_DIR      = "/content/drive/MyDrive/AfterTheSpike_Podcasts"
DRIVE_WAV_CACHE = os.path.join(OUTPUT_DIR, "wavs_cache")
LOCAL_OUT       = "/content/podcasts_out"
LOCAL_WAV_CACHE = "/content/cache_wavs"
GAP_SEC         = 0.4
MP3_BITRATE     = "96k"

if not os.path.exists(REF_AUDIO):
    raise FileNotFoundError(
        f"❌ voz de referência não encontrada: {REF_AUDIO}\\n"
        f"   Suba voz.mp3 (~30s, mono, 16-24kHz) pra esse caminho no Drive."
    )

with open(REF_AUDIO, "rb") as _f:
    REF_AUDIO_TAG = hashlib.md5(_f.read()).hexdigest()[:8]

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(DRIVE_WAV_CACHE, exist_ok=True)
os.makedirs(LOCAL_OUT, exist_ok=True)
os.makedirs(LOCAL_WAV_CACHE, exist_ok=True)

print(f"✓ REF_AUDIO:       {REF_AUDIO}")
print(f"✓ REF_AUDIO_TAG:   {REF_AUDIO_TAG}")
print(f"✓ OUTPUT_DIR:      {OUTPUT_DIR}")
print(f"✓ DRIVE_WAV_CACHE: {DRIVE_WAV_CACHE}")
print(f"✓ LOCAL_OUT:       {LOCAL_OUT}")
"""))

# 5. Scripts embutidos
cells.append(md("## 5. Scripts dos 14 episódios (embutidos — nada pra subir)"))
cells.append(code(podcasts_py))

# 6. Carrega modelo
cells.append(md("## 6. Carregar OmniVoice (primeira vez baixa ~4GB de pesos)"))
cells.append(code("""from omnivoice import OmniVoice
import torch

model = OmniVoice.from_pretrained(
    "k2-fsa/OmniVoice",
    device_map="cuda:0",
    dtype=torch.float16,
)
print("✓ Modelo carregado")
"""))

# 7. Helper functions
cells.append(md("""## 7. Funções utilitárias

- `chunk_text` — quebra o texto em parágrafos (fallback em frases se passar de 700 chars).
- `synth_chunk` — gera wav 24kHz pra um trecho. Cache em 2 níveis (local + Drive) com fingerprint MD5 da voz no nome.
- `concat_wavs` — concatena tensores com `GAP_SEC` de silêncio entre eles.
- `wav_to_mp3` — exporta com ffmpeg (libmp3lame).
"""))
cells.append(code("""import re, hashlib, time, subprocess, shutil
import numpy as np
import torch
import torchaudio

SAMPLE_RATE_DEFAULT = 24000


def chunk_text(text: str, max_chars: int = 700) -> list[str]:
    \"\"\"Quebra por \\n\\n; se um parágrafo passar de max_chars, quebra em sentenças.\"\"\"
    paras = [p.strip() for p in text.split("\\n\\n") if p.strip()]
    out = []
    for p in paras:
        if len(p) <= max_chars:
            out.append(p)
            continue
        sents = re.split(r'(?<=[.!?])\\s+', p)
        buf = ""
        for s in sents:
            if len(buf) + len(s) + 1 > max_chars and buf:
                out.append(buf.strip())
                buf = s
            else:
                buf = (buf + " " + s).strip()
        if buf:
            out.append(buf.strip())
    return out


def text_hash(s: str, n: int = 12) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:n]


def _to_wav_tensor(out, default_sr=SAMPLE_RATE_DEFAULT):
    sr = default_sr
    if isinstance(out, (tuple, list)):
        if len(out) >= 2 and isinstance(out[1], (int, float)):
            audio, sr = out[0], int(out[1])
        else:
            audio = out[0]
    elif isinstance(out, dict):
        audio = out.get("audio", out.get("waveform", out.get("wav")))
        sr = int(out.get("sample_rate", out.get("sr", default_sr)))
    else:
        audio = out
    if isinstance(audio, np.ndarray):
        audio = torch.from_numpy(audio.astype("float32", copy=False))
    elif hasattr(audio, "cpu"):
        audio = audio.detach().cpu().float()
    if audio.ndim == 1:
        audio = audio.unsqueeze(0)
    return audio, sr


def synth_chunk(text: str, ref_audio: str = REF_AUDIO) -> tuple[torch.Tensor, int, str]:
    \"\"\"Gera wav pra um chunk com cache em 2 níveis (local + Drive).
    Nome do cache inclui REF_AUDIO_TAG. Retorna (waveform, sr, hit_kind).
    \"\"\"
    h = text_hash(text)
    name = f"chunk_{REF_AUDIO_TAG}_{h}.wav"
    local_path = os.path.join(LOCAL_WAV_CACHE, name)
    drive_path = os.path.join(DRIVE_WAV_CACHE, name)

    if os.path.exists(local_path):
        wf, sr = torchaudio.load(local_path)
        return wf, sr, "local"
    if os.path.exists(drive_path):
        shutil.copy(drive_path, local_path)
        wf, sr = torchaudio.load(local_path)
        return wf, sr, "drive"

    out = model.generate(text=text, ref_audio=ref_audio)
    wf, sr = _to_wav_tensor(out)
    torchaudio.save(local_path, wf, sr)
    return wf, sr, "miss"


def concat_wavs(wavs: list[tuple[torch.Tensor, int]], gap_sec: float = GAP_SEC) -> tuple[torch.Tensor, int]:
    sr = wavs[0][1]
    gap = torch.zeros((1, int(sr * gap_sec)), dtype=wavs[0][0].dtype)
    parts = []
    for i, (wf, s) in enumerate(wavs):
        assert s == sr, f"sample rate mismatch: {s} vs {sr}"
        parts.append(wf)
        if i != len(wavs) - 1:
            parts.append(gap)
    return torch.cat(parts, dim=1), sr


def wav_to_mp3(wav_path: str, mp3_path: str, bitrate: str = MP3_BITRATE):
    cmd = ["ffmpeg", "-y", "-i", wav_path, "-vn", "-codec:a", "libmp3lame", "-b:a", bitrate, mp3_path]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


print("✓ helpers prontos")
"""))

# 8. Generate
cells.append(md("""## 8. Gerar os 14 episódios

Cada episódio vira **um único MP3**. WAVs intermediários ficam cacheados em local **e** Drive (sobrevivem a reinício de sessão Colab).
"""))
cells.append(code("""import time

manifest = []
total_t0 = time.time()

for podcast in PODCASTS:
    pid = podcast["id"]
    title = podcast["title"]
    text = podcast["text"]
    chunks = chunk_text(text)
    print(f"\\n=== {pid} — {title} ({len(chunks)} chunks) ===")

    podcast_t0 = time.time()
    wavs = []
    hits = {"local": 0, "drive": 0, "miss": 0}
    for i, c in enumerate(chunks, 1):
        wf, sr, hit = synth_chunk(c)
        dur = wf.shape[-1] / sr
        hits[hit] += 1
        flag = {"local": "[cache local]", "drive": "[cache drive]", "miss": "[gerou]"}[hit]
        preview = c[:70].replace(chr(10), " ")
        print(f"  [{i:02d}/{len(chunks):02d}] {dur:5.1f}s  {flag:14s}  {preview}{'...' if len(c)>70 else ''}")
        wavs.append((wf, sr))

    full_wav, sr = concat_wavs(wavs)
    total_dur = full_wav.shape[-1] / sr

    wav_path = os.path.join(LOCAL_OUT, f"{pid}.wav")
    mp3_path = os.path.join(LOCAL_OUT, f"{pid}.mp3")
    torchaudio.save(wav_path, full_wav, sr)
    wav_to_mp3(wav_path, mp3_path)

    shutil.copy(mp3_path, os.path.join(OUTPUT_DIR, f"{pid}.mp3"))

    elapsed = time.time() - podcast_t0
    size_mb = os.path.getsize(mp3_path) / (1024 * 1024)
    print(f"  ✓ {pid}.mp3 — {total_dur/60:.2f} min, {size_mb:.1f} MB, em {elapsed:.0f}s  "
          f"(hits: local={hits['local']} drive={hits['drive']} miss={hits['miss']})")
    manifest.append({
        "id": pid, "title": title,
        "duration_min": round(total_dur/60, 2),
        "size_mb": round(size_mb, 2),
        "chunks": len(chunks),
    })

# rsync local → Drive
t0 = time.time()
_ = os.popen(f"rsync -a --info=stats0 {LOCAL_WAV_CACHE}/ {DRIVE_WAV_CACHE}/").read()
print(f"\\n✓ rsync cache local → Drive em {time.time()-t0:.1f}s")

total_min = sum(m["duration_min"] for m in manifest)
print(f"\\n=== {len(manifest)} episódios — {total_min:.1f} min totais — wallclock {(time.time()-total_t0)/60:.1f} min ===")
import json
with open(os.path.join(LOCAL_OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
shutil.copy(os.path.join(LOCAL_OUT, "manifest.json"), os.path.join(OUTPUT_DIR, "manifest.json"))
"""))

# 9. Zip and download
cells.append(md("## 9. Empacotar zip e baixar pro seu computador"))
cells.append(code("""import zipfile

zip_path = os.path.join(LOCAL_OUT, "after_the_spike_podcasts.zip")
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for f in sorted(os.listdir(LOCAL_OUT)):
        if f.endswith(".mp3") or f == "manifest.json":
            zf.write(os.path.join(LOCAL_OUT, f), f)

shutil.copy(zip_path, os.path.join(OUTPUT_DIR, "after_the_spike_podcasts.zip"))
print(f"✓ zip: {zip_path} ({os.path.getsize(zip_path)/(1024*1024):.1f} MB)")
print(f"  cópia no Drive: {OUTPUT_DIR}/after_the_spike_podcasts.zip")

from google.colab import files
files.download(zip_path)
"""))

# 10. Preview
cells.append(md("## 10. (Opcional) Preview rápido do primeiro episódio"))
cells.append(code("""from IPython.display import Audio, display
display(Audio(os.path.join(LOCAL_OUT, "01_prologo.mp3")))
"""))

# Compose notebook
nb = {
    "nbformat": 4,
    "nbformat_minor": 5,
    "metadata": {
        "kernelspec": {"name": "python3", "display_name": "Python 3"},
        "language_info": {"name": "python"},
        "colab": {"provenance": [], "toc_visible": True},
        "accelerator": "GPU",
    },
    "cells": cells,
}

NB_PATH.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"✓ notebook gerado: {NB_PATH} ({NB_PATH.stat().st_size/1024:.1f} KB)")
