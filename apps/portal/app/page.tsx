import { PortalAuth } from "@/components/auth";
import { ApplicationForm, ApplicationStatus } from "@/components/onboarding";
import { Portal } from "@/components/portal";
import { loadPortalData } from "@/components/portal-data";
import { PortalProvider } from "@/components/store";
import { createNextServerClient } from "@vez/supabase/next";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ establishment?: string | string[]; mode?: string | string[] }>;
}) {
  const query = await searchParams;
  const supabase = await createNextServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <PortalAuth key="signed-out" />;
  if (query.mode === "recovery") return <PortalAuth initialMode="update-password" />;

  const requested = typeof query.establishment === "string" ? query.establishment : undefined;
  const data = await loadPortalData(supabase, { id: user.id, email: user.email }, requested);

  if (!data) {
    return (
      <PortalProvider initial={null}>
        <ApplicationForm
          contactEmail={user.email ?? ""}
          responsibleName={String(user.user_metadata.full_name ?? "")}
        />
      </PortalProvider>
    );
  }

  if (data.establishment.status !== "active") {
    return (
      <PortalProvider initial={data}>
        <ApplicationStatus data={data} />
      </PortalProvider>
    );
  }

  return (
    <PortalProvider initial={data}>
      <Portal />
    </PortalProvider>
  );
}
