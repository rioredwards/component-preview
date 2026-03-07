import type { Plan } from "./PlanCard";
import { PlanCard } from "./PlanCard";

export type PricingGridProps = {
  plans: Plan[];
  activePlan: string;
  onSelect: (name: string) => void;
};

export function PricingGrid({ plans, activePlan, onSelect }: PricingGridProps) {
  return (
    <section className="pricingGrid">
      {plans.map((plan) => (
        <PlanCard
          key={plan.name}
          plan={plan}
          isActive={plan.name === activePlan}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}
