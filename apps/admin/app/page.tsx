import { createNextServerClient } from "@vez/supabase/next";

// Verificação de conexão precisa bater no banco a cada request.
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createNextServerClient();
  const { data, error } = await supabase.from("cities").select("name, state_code").order("name");

  return (
    <main className="mx-auto max-w-xl p-8 font-mono text-sm">
      <h1 className="mb-4 text-base font-semibold">Vez — Administração</h1>
      <p className="mb-2 text-neutral-500">Administração da plataforma · porta 3002</p>
      {error ? (
        <p className="text-red-600">Falha ao conectar ao Supabase: {error.message}</p>
      ) : (
        <p className="text-green-700">
          Conectado ao Supabase — {data.length} cidade(s) ativa(s):{" "}
          {data.map((city) => `${city.name}/${city.state_code}`).join(", ")}
        </p>
      )}
    </main>
  );
}
