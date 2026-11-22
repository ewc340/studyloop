import Link from "next/link";
import { Suspense } from "react";
import { backLinkClass } from "../../../ui";
import { CompanyForm } from "../../company-form";
import { loadCompanyPage } from "../load";

async function EditCompany({ params }: { params: PageProps<"/companies/[id]/edit">["params"] }) {
  const { id } = await params;
  const { company } = await loadCompanyPage(id);
  return (
    <>
      <Link href={`/companies/${company.id}`} className={backLinkClass}>
        ← <span data-private>{company.name}</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Edit Company</h1>
      <CompanyForm company={company} />
    </>
  );
}

export default function EditCompanyPage(props: PageProps<"/companies/[id]/edit">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <EditCompany params={props.params} />
      </Suspense>
    </main>
  );
}
