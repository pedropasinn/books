#!/usr/bin/env python3
"""Distribui os resultados do Colab (fr_outputs.zip) nas pastas epNN_slug/ locais.
Uso: python3 distribute_outputs.py [fr_outputs.zip]"""
import sys, zipfile, pathlib, shutil

base = pathlib.Path(__file__).parent
zpath = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else base / "fr_outputs.zip"
assert zpath.exists(), f"não achei {zpath} — baixe o zip do Colab primeiro"

tmp = base / "_fr_outputs_tmp"
if tmp.exists():
    shutil.rmtree(tmp)
with zipfile.ZipFile(zpath) as z:
    z.extractall(tmp)

n = 0
for ep in sorted(tmp.glob("ep*")):
    dest = base / ep.name
    if not dest.is_dir():
        print("  (pulado, sem pasta local:", ep.name, ")"); continue
    for f in ep.glob("*"):
        shutil.copy2(f, dest / f.name)
        print("->", dest.name + "/" + f.name)
        n += 1
shutil.rmtree(tmp)
print(f"\n{n} arquivos distribuídos. Abra o karaoke.html (via http.server) e escolha o episódio.")
