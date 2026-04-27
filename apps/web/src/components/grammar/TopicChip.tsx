import Link from "next/link";

interface Props {
  examType: "KET" | "PET";
  topicId: string;
  labelZh: string;
  attempted: number;
  accuracy: number;
}

export function TopicChip({ examType, topicId, labelZh, attempted, accuracy }: Props) {
  let dotClass: string;
  let pctClass: string;
  let pctText: string;
  if (attempted === 0) {
    dotClass = "bg-neutral-300";
    pctClass = "text-ink/40";
    pctText = "未练习";
  } else if (accuracy >= 0.8) {
    dotClass = "bg-emerald-600";
    pctClass = "text-emerald-700";
    pctText = `${Math.round(accuracy * 100)}%`;
  } else if (accuracy >= 0.5) {
    dotClass = "bg-amber-600";
    pctClass = "text-amber-700";
    pctText = `${Math.round(accuracy * 100)}%`;
  } else {
    dotClass = "bg-red-600";
    pctClass = "text-red-700";
    pctText = `${Math.round(accuracy * 100)}%`;
  }

  return (
    <Link
      href={`/${examType.toLowerCase()}/grammar/quiz?topicId=${encodeURIComponent(topicId)}`}
      className="inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-white px-3 py-1 text-xs font-bold hover:border-ink hover:bg-ink/5 transition"
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span className="text-ink/80">{labelZh}</span>
      <span className={`font-mono ${pctClass}`}>{pctText}</span>
    </Link>
  );
}
