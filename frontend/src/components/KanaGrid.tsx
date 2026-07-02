import { ArrowDown, ArrowUp } from "lucide-react";
import type { KanaChar } from "../api/client";
import { KANA_GROUPS } from "../kana/data";
import { Card } from "./ui";

type Section = "hiragana" | "katakana" | "kanji";

function scoreColor(score: number): string {
  if (score >= 80) return "var(--jade)";
  if (score >= 40) return "var(--gold)";
  return "var(--red)";
}

function Tile({
  char,
  score,
  delta,
  selected,
  onClick,
}: {
  char: string;
  score: number;
  delta: number | null;
  selected: boolean;
  onClick: () => void;
}) {
  if (!char) return <div className="h-12 w-12 sm:h-14 sm:w-14" />;
  const ring = score >= 80 ? `0 0 0 1px ${scoreColor(score)}` : "";
  const selectedRing = selected ? "0 0 0 2px var(--gold)" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${char} · ${score}% mastery`}
      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] text-[15px] font-semibold transition-transform sm:h-14 sm:w-14 hover:scale-[1.04]"
      style={{
        background: `color-mix(in oklch, ${scoreColor(score)} ${Math.max(score, 8)}%, var(--inset))`,
        color: score >= 40 ? "var(--on-accent)" : "var(--fg)",
        boxShadow: [selectedRing, ring].filter(Boolean).join(", ") || undefined,
      }}
    >
      {char}
      {delta != null && delta !== 0 && (
        <span
          className={
            "absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full " +
            (delta > 0 ? "bg-jade text-on-accent" : "bg-red text-on-accent")
          }
        >
          {delta > 0 ? <ArrowUp size={8} /> : <ArrowDown size={8} />}
        </span>
      )}
    </button>
  );
}

export function KanaGrid({
  section,
  chars,
  selected,
  onSelect,
}: {
  section: Section;
  chars: KanaChar[];
  selected: string | null;
  onSelect: (c: KanaChar) => void;
}) {
  if (chars.length === 0) {
    return (
      <Card>
        <p className="text-sm text-fg-faint">
          No mastery data yet for this section — it fills in after the next daily snapshot.
        </p>
      </Card>
    );
  }

  if (section === "kanji") {
    // No fixed layout for kanji (the learned set varies per user) — a dense
    // grid straight from the API, weakest first, doubling as a study-priority view.
    const sorted = [...chars].sort((a, b) => a.score - b.score);
    return (
      <Card>
        <div className="mb-3 text-[13px] font-bold">Kanji ({chars.length})</div>
        <div className="flex flex-wrap gap-2">
          {sorted.map((c) => (
            <Tile
              key={c.char}
              char={c.char}
              score={c.score}
              delta={c.delta}
              selected={c.char === selected}
              onClick={() => onSelect(c)}
            />
          ))}
        </div>
      </Card>
    );
  }

  const byChar = new Map(chars.map((c) => [c.char, c]));

  return (
    <div className="flex flex-col gap-4">
      {KANA_GROUPS.map((g) => (
        <Card key={g.title}>
          <div className="mb-3 text-[13px] font-bold">{g.title}</div>
          <div className="flex flex-col gap-1.5">
            {g.rows.map((row, i) => (
              <div
                key={i}
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${row.length}, max-content)` }}
              >
                {row.map((cell, j) => {
                  const char = section === "hiragana" ? cell.hiragana : cell.katakana;
                  const m = char ? byChar.get(char) : undefined;
                  return (
                    <Tile
                      key={j}
                      char={char}
                      score={m?.score ?? 0}
                      delta={m?.delta ?? null}
                      selected={!!char && char === selected}
                      onClick={() => m && onSelect(m)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
