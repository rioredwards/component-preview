import type { Plan } from "./PlanCard";

export function StatusBanner({ active }: { active: Plan }) {
  return (
    <aside className="statusBanner">
      Active plan: <strong>{active.name}</strong> · {active.price}/mo · {active.features[0]}
    </aside>
  );
}
