import { ClientSpeakingRunner } from "@/components/speaking/ClientSpeakingRunner";

export default async function Page({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <ClientSpeakingRunner attemptId={attemptId} level="PET" />;
}
