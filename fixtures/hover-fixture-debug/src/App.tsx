import { useMemo, useState } from "react";
import "./App.css";

import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { MetricsGrid } from "./components/MetricsGrid";
import { PricingGrid } from "./components/PricingGrid";
import { StatusBanner } from "./components/StatusBanner";

// keep plan type here for any other logic (re-exported from component)
import type { Plan } from "./components/PlanCard";

const plans: Plan[] = [
  {
    name: "Starter",
    price: "$19",
    blurb: "For small teams validating ideas fast.",
    accent: "#6fb9ff",
    features: ["Live hover previews", "3 shared workspaces", "Image attach"],
  },
  {
    name: "Pro",
    price: "$59",
    blurb: "For product squads shipping daily.",
    accent: "#7cf2c7",
    features: ["Dev server matching", "Unlimited workspaces", "Comment history"],
  },
  {
    name: "Scale",
    price: "$149",
    blurb: "For design systems at enterprise scale.",
    accent: "#ffd86f",
    features: ["SAML and RBAC", "Audit logs", "Priority support"],
  },
];

function App() {
  const [activePlan, setActivePlan] = useState("Pro");

  const active = useMemo(
    () => plans.find((plan) => plan.name === activePlan) ?? plans[1],
    [activePlan],
  );

  return (
    <div className="page">
      <Header />

      <main className="shell">
        <HeroSection />
        <MetricsGrid />
        <PricingGrid plans={plans} activePlan={activePlan} onSelect={setActivePlan} />
        <StatusBanner active={active} />
      </main>
    </div>
  );
}

export default App;
