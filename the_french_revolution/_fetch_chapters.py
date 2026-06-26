#!/usr/bin/env python3
"""Extrai os capitulos (timestamps de navegacao) de cada video do YouTube -> chapters.json.
Os capitulos sao indice navegacional; nao guardamos a transcricao aqui.
Usa o deno (se instalado) como runtime JS p/ extracao confiavel; faz merge + retry."""
import json, subprocess, csv, os, re, pathlib

base = pathlib.Path(__file__).parent
env = dict(os.environ)
env["PATH"] = os.path.expanduser("~/.deno/bin") + ":" + env.get("PATH", "")

TS = re.compile(r"^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s*[-–—]\s*(.+?)\s*$")
def parse_desc(desc):
    chs = []
    for line in (desc or "").splitlines():
        m = TS.match(line)
        if not m:
            continue
        p = [int(x) for x in m.group(1).split(":")]
        t = p[-1] + p[-2] * 60 + (p[-3] * 3600 if len(p) == 3 else 0)
        chs.append({"t": t, "title": m.group(2).strip()})
    return chs if len(chs) >= 3 else None

cj = base / "chapters.json"
out = json.loads(cj.read_text(encoding="utf-8")) if cj.exists() else {}

with open(base / "episodes.tsv", encoding="utf-8") as f:
    rows = [r for r in csv.reader(f, delimiter="\t") if len(r) >= 4]

def run_print(vid, field):
    p = subprocess.run(
        ["yt-dlp", "--no-update", "--skip-download", "--print", field,
         f"https://www.youtube.com/watch?v={vid}"],
        capture_output=True, text=True, timeout=120, env=env)
    return p.stdout

def fetch(vid, tries=3):
    for _ in range(tries):                      # 1) chapters estruturados
        try:
            data = json.loads((run_print(vid, "%(chapters)j").strip() or "null"))
            if data:
                return [{"t": int(round(c["start_time"])), "title": c["title"]} for c in data]
        except Exception:
            pass
    for _ in range(tries):                      # 2) fallback: parsear a descricao
        try:
            chs = parse_desc(run_print(vid, "%(description)s"))
            if chs:
                return chs
        except Exception:
            pass
    return None

for idx, vid, slug, title in rows:
    ep = f"ep{idx}_{slug}"
    if out.get(ep):           # ja temos capitulos -> mantem
        print(f"{ep}: {len(out[ep])} (mantido)", flush=True); continue
    chs = fetch(vid)
    out[ep] = chs or []
    print(f"{ep}: {len(out[ep])} capitulos", flush=True)

json.dump(out, cj.open("w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OK -> chapters.json")
