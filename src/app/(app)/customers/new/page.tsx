import { PageHeader } from "@/components/PageHeader";
import { NewCustomerWizard } from "@/components/NewCustomerWizard";

export default function NewCustomerPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <PageHeader eyebrow="Clients Pro" title="Nouveau client pro" />

      {searchParams?.error && <p className="mb-4 text-sm text-danger">Erreur : {searchParams.error}</p>}

      <NewCustomerWizard />
    </div>
  );
}
