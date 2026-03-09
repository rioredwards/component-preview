import React from "react";
import { ComponentsSection } from "./ComponentsSection";
import { Footer } from "./Footer";
import { FormsSection } from "./FormsSection";
import { HeroSection } from "./HeroSection";
import { PricingSection } from "./PricingSection";

export default function App() {
  return (
    <main id="main">
      <div className="container">
        <HeroSection />
        <ComponentsSection />
        <div className="hr" />
        <FormsSection />
        <div className="hr" />
        <PricingSection />
        <Footer />
      </div>
    </main>
  );
}
