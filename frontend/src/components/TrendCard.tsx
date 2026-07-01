import { useHistory } from "../api/client";
import { Card } from "./ui";
import { AreaSparkline } from "./charts";

/** Cumulative studied-terms trend over the last 30 days (inline SVG area). */
export function TrendCard({ enabled }: { enabled: boolean }) {
  const { data } = useHistory("total", 30, enabled);
  const values = (data?.points ?? [])
    .map((p) => p.value)
    .filter((v): v is number => v != null);

  return (
    <Card delay={0.16}>
      <div className="mb-2.5 text-[13px] font-bold">Progress over time · 30d</div>
      <AreaSparkline values={values} color="var(--amber)" />
    </Card>
  );
}
