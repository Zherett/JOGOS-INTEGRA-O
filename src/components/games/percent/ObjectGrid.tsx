interface Props {
  emoji: string;
  count: number;
}

/** Grid of concrete objects used for "percentage of a quantity" questions. */
export function ObjectGrid({ emoji, count }: Props) {
  const cols = count <= 10 ? 5 : count <= 20 ? 5 : count <= 30 ? 10 : 10;
  const sizeClass = count > 20 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl";

  return (
    <div
      className="grid justify-center gap-1.5 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label={`${count} objetos`}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`grid aspect-square place-items-center rounded-xl bg-secondary/60 ${sizeClass}`}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
