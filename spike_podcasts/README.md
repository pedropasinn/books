# Podcast — *After the Spike* (Dean Spears & Michael Geruso, 2025)

Série de 14 episódios em pt-BR que destila o livro inteiro (prólogo + 12 capítulos + apêndice). Substitui a leitura.

Pipeline igual ao de `Cont/PS/Entrevista/podcasts` — voz clonada via **OmniVoice**, mesma `voz.mp3` em `MyDrive/omnivoice/`.

## Como rodar

1. `python _build_notebook.py` (gera `Podcast_AfterTheSpike_OmniVoice.ipynb`).
2. Abre o `.ipynb` no Colab → Runtime → T4 GPU → Run all.
3. Confirma que `voz.mp3` está em `MyDrive/omnivoice/voz.mp3`.
4. No fim (~25-40 min em T4), o Colab baixa `after_the_spike_podcasts.zip`. Backup também em `MyDrive/AfterTheSpike_Podcasts/`.

## Episódios

| Arquivo | Tema | Palavras | Duração estimada |
|---|---|---|---|
| `01_prologo.mp3`                 | Prólogo — tese geral do livro                       | 1188 | ~7-8 min |
| `02_o_pico.mp3`                  | Cap. 1 — O pico                                     | 1159 | ~7-8 min |
| `03_linha_divisoria.mp3`         | Cap. 2 — A linha divisória 2.0                      | 1409 | ~8-9 min |
| `04_pessoas_e_planeta.mp3`       | Cap. 3 — Pessoas e planeta                          | 1449 | ~8-9 min |
| `05_corpos_dos_outros.mp3`       | Cap. 4 — Corpos das outras pessoas                  | 1545 | ~9-10 min |
| `06_mundo_imperfeito.mp3`        | Cap. 5 — Adicionar vidas a um mundo imperfeito      | 1471 | ~8-9 min |
| `07_progresso_vem_de_pessoas.mp3`| Cap. 6 — Progresso vem de pessoas                   | 1445 | ~8-9 min |
| `08_desviando_asteroide.mp3`     | Cap. 7 — Desviando do asteroide                     | 1593 | ~9-10 min |
| `09_mais_bom_e_melhor.mp3`       | Cap. 8 — Mais bom é melhor (ética populacional)     | 1591 | ~9-10 min |
| `10_nao_se_resolve_sozinho.mp3`  | Cap. 9 — Despovoamento não se resolve sozinho       | 1589 | ~9-10 min |
| `11_controle_estatal.mp3`        | Cap. 10 — Controle estatal não funciona             | 1354 | ~8-9 min |
| `12_dinheiro_e_resposta.mp3`     | Cap. 11 — Dinheiro é a resposta?                    | 1466 | ~8-9 min |
| `13_almeje_mais_alto.mp3`        | Cap. 12 — Almeje mais alto                          | 1581 | ~9-10 min |
| `14_apendice_repugnante.mp3`     | Apêndice — A conclusão repugnante (Parfit)          | 1557 | ~9-10 min |

Total: **~2h-2h30 de podcast** cobrindo um livro de ~80 mil palavras.

## Continuidade

A série foi escrita pra ser ouvida em ordem. Cada episódio:
- Recapitula em uma ou duas frases o episódio anterior.
- Anuncia o próximo no fim, com gancho.
- Reutiliza personagens recorrentes (Preeti, Seema, Reema, April, Mike, Dean, Diane) pra dar continuidade narrativa.

## Editar um script

```bash
# edita o .txt
vim scripts/04_pessoas_e_planeta.txt
# regenera o notebook
python _build_notebook.py
# sobe o .ipynb atualizado pro Colab
```

WAVs cacheados invalidam automaticamente se o texto muda (hash SHA256 dos primeiros 12 caracteres) ou se `voz.mp3` muda (fingerprint MD5).

## Arquivos

- `scripts/0[1-9]_*.txt`, `scripts/1[0-4]_*.txt` — scripts narráveis (texto-fonte). Editáveis.
- `_build_notebook.py` — gera o `.ipynb`. Rode novamente se editar algum `.txt`.
- `Podcast_AfterTheSpike_OmniVoice.ipynb` — gerado pelo script acima. Sobe pro Colab.

## Padrões herdados do `OmniVoice_Batch_Colab.ipynb`

- Mesma `voz.mp3` em `MyDrive/omnivoice/voz.mp3`.
- Fingerprint MD5 da voz no nome do cache (`REF_AUDIO_TAG`). Trocar `voz.mp3` invalida o cache automaticamente.
- Cache em 2 níveis (local + Drive). WAVs sobrevivem entre sessões via rsync no fim.
- Reconciliação numpy + sanity check pós-install.

## Otimizações específicas pra podcast

- Sem TeXLive / Pango / Cairo / Manim. Só ffmpeg + libsndfile.
- Sem build de vídeo. Pipeline reduzido a TTS puro.
- Sem R2 / webhooks / manifesto JSON externo. Tudo numa sessão só.
- Scripts embutidos no `.ipynb`.
- Chunking automático por parágrafo (`\n\n`, fallback em sentenças se passar de 700 chars).
- Output MP3 (libmp3lame 96 kbps).
- `files.download` automático no fim.
