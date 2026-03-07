import { PlanPrice } from "./PlanPrice";

export type PlanHeaderProps = {
  name: string;
  price: string;
};

export function PlanHeader({ name, price }: PlanHeaderProps) {
  return (
    <div className="planHeader">
      <h2>{name}</h2>
      <PlanPrice price={price} />
    </div>
  );
}
