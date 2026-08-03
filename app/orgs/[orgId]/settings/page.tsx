import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import OrgSettings from "@/components/org/OrgSettings";
import type { Invite, Organization, OrgMember } from "@/lib/types";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
  ]);

  if (!org) notFound();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("*, profiles(id, email, name)")
      .eq("org_id", orgId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("invites")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  const memberRows = (members ?? []) as unknown as OrgMember[];
  const myRole = memberRows.find((m) => m.user_id === user.id)?.role;

  if (myRole !== "owner" && myRole !== "admin") {
    redirect(`/orgs/${orgId}`);
  }

  return (
    <>
      <AppHeader userId={user.id} userName={profile?.name ?? ""} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <div className="mb-2 text-sm text-slate-400">
          <Link href="/orgs" className="hover:text-sky-600 hover:underline">
            내 조직
          </Link>{" "}
          /{" "}
          <Link
            href={`/orgs/${orgId}`}
            className="hover:text-sky-600 hover:underline"
          >
            {org.name}
          </Link>{" "}
          /
        </div>
        <h1 className="mb-8 text-2xl font-bold">조직 설정</h1>

        <OrgSettings
          org={org as Organization}
          members={memberRows}
          invites={(invites ?? []) as Invite[]}
          myUserId={user.id}
          myRole={myRole}
        />
      </main>
    </>
  );
}
