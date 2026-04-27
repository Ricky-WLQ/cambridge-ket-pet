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
  index?: number;
}

const PASTEL_ROTATION = ["tile-lavender", "tile-sky", "tile-butter", "tile-peach", "tile-mint", "tile-cream"] as const;

export function CategoryCard({ examType, category, topics, index = 0 }: Props) {
  const label = getCategoryLabel(category);
  const totalAttempted = topics.reduce((s, t) => s + t.attempted, 0);
  const weightedAcc = totalAttempted === 0
    ? 0
    : topics.reduce((s, t) => s + t.accuracy * t.attempted, 0) / totalAttempted;
  const summaryText = totalAttempted === 0
    ? `${topics.length} 主题 · 未练习`
    : `${topics.length} 主题 · 平均正确率 ${Math.round(weightedAcc * 100)}%`;

  const tile = PASTEL_ROTATION[index % PASTEL_ROTATION.length];

  return (
    <div className={`rounded-2xl border-2 border-ink/10 ${tile} p-4 stitched-card`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-extrabold text-ink">{label.zh}</span>
          <span className="text-xs font-bold text-ink/55">{label.en}</span>
        </div>
        <span className="text-xs font-bold text-ink/55">{summaryText}</span>
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
