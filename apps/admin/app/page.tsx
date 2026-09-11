import { Admin } from "@/components/admin";
import {
  AdminAccessError,
  AdminMfaRequiredError,
  loadAdminData,
} from "@/components/admin-data";
import { AdminLogin, AdminMfaGate } from "@/components/auth";
import { createNextServerClient } from "@vez/supabase/next";

// "Esperando há 2d 4h" é contado a partir de agora: a página não pode ser gerada no build.
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createNextServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <AdminLogin key="signed-out" />;

  const [policyResult, assuranceResult] = await Promise.all([
    supabase.rpc("admin_mfa_policy"),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (policyResult.error) {
    if (policyResult.error.code === "42501") {
      return <AdminLogin deniedEmail={user.email} key={user.id} />;
    }
    console.error("Falha ao carregar a política de MFA", policyResult.error);
    throw new Error(policyResult.error.message);
  }
  if (assuranceResult.error) throw assuranceResult.error;

  const mfaRequired = policyResult.data ?? true;
  const assurance = assuranceResult.data;
  if (mfaRequired && assurance.currentLevel !== "aal2") {
    return (
      <AdminMfaGate
        email={user.email ?? "conta administrativa"}
        key={`mfa-${user.id}`}
        needsEnrollment={assurance.nextLevel !== "aal2"}
      />
    );
  }

  let initial;
  try {
    initial = await loadAdminData(supabase);
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminLogin deniedEmail={user.email} key={user.id} />;
    }
    if (error instanceof AdminMfaRequiredError) {
      return (
        <AdminMfaGate
          email={user.email ?? "conta administrativa"}
          key={`mfa-retry-${user.id}`}
          needsEnrollment={assurance.nextLevel !== "aal2"}
        />
      );
    }
    console.error("Falha ao carregar o painel administrativo", error);
    throw error;
  }

  return <Admin initial={initial} remote />;
}
