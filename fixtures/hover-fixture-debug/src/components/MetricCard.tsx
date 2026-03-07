export type MetricCardProps = {
  label: string;
  value: string;
};

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <article className="metricCard">
      <p className="metricLabel">{label}</p>
      <p className="metricValue">{value}</p>
    </article>
  );
}
