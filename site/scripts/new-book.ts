import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const CONTENT_DIR = resolve(process.cwd(), process.env.CONTENT_DIR ?? "../content");

const slug = process.argv[2];
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("Uso: pnpm new-book <slug-em-kebab-case>");
  console.error("Ex.: pnpm new-book sapiens");
  process.exit(1);
}

const bookDir = join(CONTENT_DIR, slug);
if (existsSync(bookDir)) {
  console.error(`Já existe: ${bookDir}`);
  process.exit(1);
}

mkdirSync(join(bookDir, "scripts"), { recursive: true });
mkdirSync(join(bookDir, "audio"));
mkdirSync(join(bookDir, "alignment"));

const yml = `slug: ${slug}
title: <título do livro>
authors: <autor 1>, <autor 2>
language: pt-BR
summary: |
  <descrição curta — 2 a 4 linhas>
cover: cover.jpg
epub: book.epub
`;
writeFileSync(join(bookDir, "book.yml"), yml);

const exampleScript = `Episódio um. <título do episódio>.

<texto do episódio aqui. Escreva como narração para podcast. Sem
bullets, sem títulos. Use frases curtas. Spell out números difíceis
("dois mil e vinte oito" em vez de "2028"). Marque pausas com
parágrafo.>

<próximo parágrafo.>
`;
writeFileSync(join(bookDir, "scripts", "01_titulo_do_episodio.txt"), exampleScript);

console.log(`✓ Criado ${bookDir}`);
console.log(`  Próximos passos:`);
console.log(`  1. Editar  ${join(bookDir, "book.yml")}`);
console.log(`  2. Colocar cover.jpg e book.epub em ${bookDir}/`);
console.log(`  3. Escrever scripts em ${join(bookDir, "scripts")}/`);
console.log(`  4. pnpm ingest`);
