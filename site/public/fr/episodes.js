// Metadados compartilhados (index.html + karaoke.html).
window.EPISODES = [
  { n: 1,  slug: "ep01_marie_antoinette",       yt: "sm5yrVIGJfg", en: "Part 1 · Marie Antoinette",                pt: "Por que Maria Antonieta virou a mulher mais odiada da França", dur: 3601 },
  { n: 2,  slug: "ep02_diamond_necklace",        yt: "B6d9DIzW9xs", en: "Part 2 · The Diamond Necklace Scandal",    pt: "O escândalo do colar de diamantes",                 dur: 3147 },
  { n: 3,  slug: "ep03_violence_begins",         yt: "jhZjzA1w5dk", en: "Part 3 · The Violence Begins",             pt: "A violência começa",                                dur: 3546 },
  { n: 4,  slug: "ep04_showdown_versailles",     yt: "gxrk1Tlbgd4", en: "Part 4 · Showdown in Versailles",          pt: "Confronto em Versalhes",                            dur: 4145 },
  { n: 5,  slug: "ep05_storming_bastille",       yt: "70hIVrErUJg", en: "Part 5 · The Storming of the Bastille",    pt: "A queda da Bastilha",                               dur: 3574 },
  { n: 6,  slug: "ep06_rights_of_man",           yt: "Ey4xBrSKMAw", en: "Part 6 · The Rights of Man",               pt: "Os Direitos do Homem",                              dur: 3426 },
  { n: 7,  slug: "ep07_women_evict_louis",       yt: "xDbI4Pi6dXs", en: "Part 7 · The Women That Evicted Louis XVI",pt: "As mulheres que expulsaram Luís XVI de Versalhes",  dur: 3620 },
  { n: 8,  slug: "ep08_royal_family_escapes",    yt: "Dbvk5N9Pe84", en: "Final · The Royal Family Escapes",         pt: "A família real foge",                               dur: 4051 },
  { n: 9,  slug: "ep09_la_marseillaise",         yt: "K2nV_3qYrCE", en: "La Marseillaise",                          pt: "A Marselhesa e como virou o hino da França",        dur: 2509 },
  { n: 10, slug: "ep10_september_massacres",     yt: "mj05coJBe3A", en: "The September Massacres",                  pt: "O Primeiro Terror — os Massacres de Setembro",      dur: 3423 },
  { n: 11, slug: "ep11_monarchy_last_breath",    yt: "K2SOwmi4bA4", en: "The Monarchy's Last Breath",               pt: "O último suspiro da monarquia",                     dur: 3401 },
  { n: 12, slug: "ep12_trial_execution_louis",   yt: "2kdES5UIq3w", en: "The Trial & Execution of Louis XVI",       pt: "O julgamento e a execução de Luís XVI",             dur: 3582 },
  { n: 13, slug: "ep13_unexpected_revolutionary",yt: "fnTAFXOPPm4", en: "The Most Unexpected Revolutionary",        pt: "O revolucionário mais inesperado",                  dur: 3530 },
];

// helpers compartilhados
window.fmtTime = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
};
window.fmtDur = (s) => `${Math.round((s || 0) / 60)} min`;
// gradiente "poster" determinístico por episódio (paleta fria petróleo→índigo)
window.posterBg = (i) => {
  const h = 188 + i * 9;
  return `linear-gradient(150deg, hsl(${h} 34% 17%), hsl(${h + 26} 40% 9%))`;
};
window.progressKey = (slug) => `trih_fr_pos_${slug}`;
