import { FeatureItem } from "./FeatureItem";

export function FeatureList({ features }: { features: string[] }) {
  return (
    <ul>
      {features.map((feature) => (
        <FeatureItem key={feature} text={feature} />
      ))}
    </ul>
  );
}
