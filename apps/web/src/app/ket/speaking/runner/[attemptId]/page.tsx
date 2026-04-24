import { SpeakingRunner } from "@/components/speaking/SpeakingRunner";

export default async function Page({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <SpeakingRunner attemptId={attemptId} level="KET" />;
}
