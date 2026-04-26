export function MasteryDots({ mastery }: { mastery: number }) {
  const filled = Math.max(0, Math.min(5, mastery));
  return (
    <span className="inline-flex gap-0.5" aria-label={`mastery ${filled} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < filled ? "bg-green-600" : "bg-neutral-200"}`}
        />
      ))}
    </span>
  );
}
