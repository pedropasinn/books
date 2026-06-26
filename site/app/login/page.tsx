export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const err = sp?.e === "1";
  const next = typeof sp?.next === "string" ? sp.next : "/";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <form
        method="post"
        action="/api/login"
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-7"
      >
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Acesso restrito</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Biblioteca pessoal. Digite a senha para continuar.
          </p>
        </div>
        <input type="hidden" name="next" value={next} />
        <input
          type="password"
          name="password"
          autoFocus
          required
          placeholder="Senha"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        {err && <p className="text-sm text-destructive">Senha incorreta.</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
