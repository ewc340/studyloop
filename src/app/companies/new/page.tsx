import Link from "next/link";
import { backLinkClass } from "../../ui";
import { CompanyForm } from "../company-form";

export default function NewCompanyPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Link href="/companies" className={backLinkClass}>
        ← Companies
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">New Company</h1>
      {/* Kept out of any Suspense boundary so a rejected submit shows its error even before hydration. */}
      <CompanyForm />
    </main>
  );
}
