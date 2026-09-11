import { Admin } from "@/components/admin";
import { AdminAccessError, loadAdminData } from "@/components/admin-data";
import { AdminLogin } from "@/components/auth";
import { createNextServerClient } from "@vez/supabase/next";

// "Esperando há 2d 4h" é contado a partir de agora: a página não pode ser gerada no build.
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createNextServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <AdminLogin key="signed-out" />;

  let initial;
  try {
    initial = await loadAdminData(supabase);
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminLogin deniedEmail={user.email} key={user.id} />;
    }
    console.error("Falha ao carregar o painel administrativo", error);
    throw error;
  }

  return <Admin initial={initial} remote />;
}
