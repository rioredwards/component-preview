import { Button } from "./Button";

export function PlanButton({ planName }: { planName: string }) {
  return <Button className="planButton">Choose {planName}</Button>;
}
