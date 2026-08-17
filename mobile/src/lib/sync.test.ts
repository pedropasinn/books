import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./sync";

describe("normalizeUrl", () => {
  it("assume https quando não vem esquema", () => {
    expect(normalizeUrl("meusite.vercel.app")).toBe("https://meusite.vercel.app");
  });

  it("preserva http explícito (rede local)", () => {
    expect(normalizeUrl("http://192.168.0.10:3000")).toBe("http://192.168.0.10:3000");
  });

  it("tira a barra final para não gerar caminho com barra dupla", () => {
    expect(normalizeUrl("https://x.com///")).toBe("https://x.com");
  });

  it("ignora espaços colados na digitação", () => {
    expect(normalizeUrl("  x.com  ")).toBe("https://x.com");
  });

  it("vazio continua vazio (não vira 'https://')", () => {
    expect(normalizeUrl("   ")).toBe("");
  });
});
