import { TopicChip } from "./TopicChip";
import { getCategoryLabel } from "@/lib/grammar/taxonomy";

interface TopicWithStats {
  topicId: string;
  labelZh: string;
  attempted: number;
  accuracy: number;
}

interface Props {
  examType: "KET" | "PET";
  category: string;
  topics: TopicWithStats[];
}

export function CategoryCard({ examType, category, topics }: Props) {
  const label = getCategoryLabel(category);
  const totalAttempted = topics.reduce((s, t) => s + t.attempted, 0);
  const weightedAcc = totalAttempted === 0
    ? 0
    : topics.reduce((s, t) => s + t.accuracy * t.attempted, 0) / totalAttempted;
  const summaryText = totalAttempted === 0
    ? `${topics.length} 主题 · 未练习`
    : `${topics.length} 主题 · 平均正确率 ${Math.round(weightedAcc * 100)}%`;

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-neutral-900">{label.zh}</span>
          <span className="text-xs text-neutral-500">{label.en}</span>
        </div>
        <span className="text-xs text-neutral-500">{summaryText}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <TopicChip
            key={t.topicId}
            examType={examType}
            topicId={t.topicId}
            labelZh={t.labelZh}
            attempted={t.attempted}
            accuracy={t.accuracy}
          />
        ))}
      </div>
    </div>
  );
}
