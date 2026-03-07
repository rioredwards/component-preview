import React from "react";
import { FeatureList } from "./FeatureList";
import { PlanButton } from "./PlanButton";
import { PlanHeader } from "./PlanHeader";

export type Plan = {
  name: string;
  price: string;
  blurb: string;
  accent: string;
  features: string[];
};

export type PlanCardProps = {
  plan: Plan;
  isActive: boolean;
  onSelect: (name: string) => void;
};

export function PlanCard({ plan, isActive, onSelect }: PlanCardProps) {
  return (
    <article
      className={`planCard ${isActive ? "isActive" : ""}`}
      style={{ "--accent": plan.accent } as React.CSSProperties}
      onClick={() => onSelect(plan.name)}>
      <PlanHeader name={plan.name} price={plan.price} />
      <p className="planBlurb">{plan.blurb}</p>
      <FeatureList features={plan.features} />
      <PlanButton planName={plan.name} />
    </article>
  );
}
