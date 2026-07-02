import type { KanaChar } from "../api/client";
import { Card } from "./ui";

function scoreColor(score: number): string {
  if (score >= 80) return "var(--jade)";
  if (score >= 40) return "var(--gold)";
  return "var(--red)";
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-[19px] font-bold" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10.5px] text-fg-faint">{label}</div>
    </div>
  );
}

export function KanaSummary({ label, chars }: { label: string; chars: KanaChar[] }) {
  if (chars.length === 0) return null;

  const avg = Math.round(chars.reduce((sum, c) => sum + c.score, 0) / chars.length);
  const mastered = chars.filter((c) => c.score >= 80).length;
  const learning = chars.filter((c) => c.score >= 40 && c.score < 80).length;
  const fresh = chars.filter((c) => c.score < 40).length;

  return (
    <Card className="flex items-center justify-between gap-4">
      <div>
        <div className="font-display text-[28px] font-bold" style={{ color: scoreColor(avg) }}>
          {avg}%
        </div>
        <div className="mt-0.5 text-[11.5px] text-fg-faint">
          Overall {label} mastery · {chars.length} characters
        </div>
      </div>
      <div className="flex gap-5">
        <Stat label="Mastered" value={mastered} color="var(--jade)" />
        <Stat label="Learning" value={learning} color="var(--gold)" />
        <Stat label="New" value={fresh} color="var(--red)" />
      </div>
    </Card>
  );
}
