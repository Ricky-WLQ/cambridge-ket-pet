import type { WordDto, VocabProgressDto } from "@/lib/vocab/types";
import { TierBadge } from "./TierBadge";
import { MasteryDots } from "./MasteryDots";

interface Props {
  word: WordDto;
  progress: VocabProgressDto | null;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "未学习";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = 60_000;
  if (diff < m) return "刚刚";
  if (diff < 60 * m) return `${Math.round(diff / m)} 分钟前`;
  if (diff < 24 * 60 * m) return `${Math.round(diff / (60 * m))} 小时前`;
  if (diff < 7 * 24 * 60 * m) return `${Math.round(diff / (24 * 60 * m))} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

export function WordRow({ word, progress }: Props) {
  return (
    <tr className="border-b border-neutral-100 hover:bg-neutral-50">
      <td className="px-3 py-2.5 font-semibold text-neutral-900">{word.word}</td>
      <td className="px-3 py-2.5 text-neutral-600">{word.pos}</td>
      <td className="px-3 py-2.5 text-neutral-700">{word.glossZh}</td>
      <td className="px-3 py-2.5"><TierBadge tier={word.tier} /></td>
      <td className="px-3 py-2.5"><MasteryDots mastery={progress?.mastery ?? 0} /></td>
      <td className={`px-3 py-2.5 text-xs ${progress ? "text-neutral-600" : "text-neutral-400"}`}>
        {formatRelative(progress?.lastReviewed ?? null)}
      </td>
    </tr>
  );
}
