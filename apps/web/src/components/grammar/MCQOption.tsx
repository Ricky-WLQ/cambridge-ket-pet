interface Props {
  letter: "A" | "B" | "C" | "D";
  text: string;
  state: "default" | "selected" | "correct" | "wrong";
  disabled: boolean;
  onClick: () => void;
}

export function MCQOption({ letter, text, state, disabled, onClick }: Props) {
  const baseClass = "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition";
  const stateClass = {
    default: "border-neutral-300 bg-white hover:border-neutral-900 hover:shadow-sm",
    selected: "border-blue-600 bg-blue-50 text-blue-900",
    correct: "border-green-600 bg-green-50 text-green-900",
    wrong: "border-red-600 bg-red-50 text-red-900",
  }[state];
  const letterClass = {
    default: "border-neutral-300 bg-neutral-50 text-neutral-700",
    selected: "border-blue-600 bg-blue-100 text-blue-900",
    correct: "border-green-600 bg-green-100 text-green-900",
    wrong: "border-red-600 bg-red-100 text-red-900",
  }[state];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${baseClass} ${stateClass} ${disabled ? "cursor-not-allowed opacity-90" : "cursor-pointer"}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold ${letterClass}`}>
        {letter}
      </span>
      <span className="flex-1">{text}</span>
    </button>
  );
}
