#!/usr/bin/env bash
# Baixa o audio de todos os episodios listados em episodes.tsv (pula os ja baixados).
set -u
BASE="/home/pedro/repo/books/the_french_revolution"
ok=0; skip=0; fail=0
while IFS=$'\t' read -r idx vid slug title; do
  [ -z "${idx:-}" ] && continue
  dir="$BASE/ep${idx}_${slug}"
  mkdir -p "$dir"
  if [ -f "$dir/audio.mp3" ]; then
    echo "[skip] ep${idx} ${slug}"; skip=$((skip+1)); continue
  fi
  echo "[dl  ] ep${idx} ${slug} (${vid})..."
  if yt-dlp --no-update -f bestaudio/best -x --audio-format mp3 --audio-quality 0 \
       -o "$dir/audio.%(ext)s" "https://www.youtube.com/watch?v=$vid" \
       >"$dir/_dl.log" 2>&1; then
    echo "[ ok ] ep${idx}  ($(du -h "$dir/audio.mp3" | cut -f1))"; ok=$((ok+1))
  else
    echo "[FAIL] ep${idx} — ver $dir/_dl.log"; fail=$((fail+1))
  fi
done < "$BASE/episodes.tsv"
echo "===== DOWNLOADS: ok=$ok skip=$skip fail=$fail ====="
