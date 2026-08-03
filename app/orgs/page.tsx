import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import CreateOrgForm from "@/components/org/CreateOrgForm";
import { ROLE_LABELS } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface MembershipRow {
  role: Role;
  organizations: {
    id: string;
    name: string;
    allowed_domains: string[] | null;
  };
}

export default async function OrgsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("organization_members")
      .select("role, organizations(id, name, allowed_domains)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true }),
  ]);

  const rows = (memberships ?? []) as unknown as MembershipRow[];

  return (
    <>
      <AppHeader userId={user.id} userName={profile?.name ?? ""} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">내 조직</h1>
        </div>

        {rows.length === 0 ? (
          <div className="mb-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            <p className="text-lg font-medium">아직 소속된 조직이 없습니다.</p>
            <p className="mt-1 text-sm">
              새 조직을 만들거나, 조직장에게 초대 링크를 요청하세요.
            </p>
          </div>
        ) : (
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((m) => (
              <Link
                key={m.organizations.id}
                href={`/orgs/${m.organizations.id}`}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold group-hover:text-sky-700">
                    {m.organizations.name}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {ROLE_LABELS[m.role]}
                  </span>
                </div>
                {m.organizations.allowed_domains &&
                  m.organizations.allowed_domains.length > 0 && (
                    <p className="mt-2 text-xs text-slate-400">
                      @{m.organizations.allowed_domains.join(", @")} 전용
                    </p>
                  )}
              </Link>
            ))}
          </div>
        )}

        <CreateOrgForm />
      </main>
    </>
  );
}
