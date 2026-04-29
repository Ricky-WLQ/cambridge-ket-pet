import { SiteHeader } from "@/components/SiteHeader";
import { ClientSpeakingNewPage } from "@/components/speaking/ClientSpeakingNewPage";

export default function Page() {
  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <ClientSpeakingNewPage level="KET" />
      </main>
    </div>
  );
}
