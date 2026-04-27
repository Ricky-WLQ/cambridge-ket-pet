interface Props {
  letter: "A" | "B" | "C" | "D";
  text: string;
  state: "default" | "selected" | "correct" | "wrong";
  disabled: boolean;
  onClick: () => void;
}

export function MCQOption({ letter, text, state, disabled, onClick }: Props) {
  const baseClass = "w-full text-left rounded-xl border-2 px-3.5 py-2.5 transition flex items-center gap-3";
  const stateClass = {
    default: "border-ink/10 hover:border-ink",
    selected: "bg-butter-tint border-ink",
    correct: "bg-mint-tint border-emerald-600 text-emerald-900",
    wrong: "bg-peach-tint border-red-600 text-red-900",
  }[state];
  const letterClass = {
    default: "bg-ink/5",
    selected: "bg-ink text-white",
    correct: "bg-emerald-600 text-white",
    wrong: "bg-red-600 text-white",
  }[state];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${baseClass} ${stateClass} ${disabled ? "cursor-not-allowed opacity-90" : "cursor-pointer"}`}
    >
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md font-extrabold text-xs ${letterClass}`}>
        {letter}
      </span>
      <span className={`flex-1 text-base ${state === "selected" ? "font-extrabold" : "font-bold"}`}>{text}</span>
    </button>
  );
}
