import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/auth";
import AppHeader from "@/components/AppHeader";
import ViewTabs from "@/components/ViewTabs";
import FileList from "@/components/org/FileList";
import { fetchAttachments } from "@/lib/view-data";

export default async function OrgFilesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  const [{ data: org }, items] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle(),
    fetchAttachments(supabase, { orgId }),
  ]);
  if (!org) notFound();

  return (
    <>
      <AppHeader userId={user.id} userName={user.name} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">첨부 파일</h1>
          <ViewTabs base={`/orgs/${orgId}`} type="org" active="files" />
        </div>

        <FileList items={items} />
      </main>
    </>
  );
}
