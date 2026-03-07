import { MetricCard } from "./MetricCard";

export function MetricsGrid() {
  const metrics = [
    { label: "Capture latency", value: "18ms" },
    { label: "Visual match score", value: "98.7%" },
    { label: "Projects protected", value: "142" },
  ];

  return (
    <section className="metricsGrid">
      {metrics.map((m) => (
        <MetricCard key={m.label} label={m.label} value={m.value} />
      ))}
    </section>
  );
}
