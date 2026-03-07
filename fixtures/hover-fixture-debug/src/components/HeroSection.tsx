import { HeroActions } from "./HeroActions";

export function HeroSection() {
  return (
    <section className="heroPanel">
      <p className="eyebrow">Pixel-accurate snapshotting</p>
      <h1 className="heroTitle">Validate UI before every commit</h1>
      <p className="heroCopy">
        Compare browser rendering against extension hovers with one source of truth. Preview exactly
        what ships.
      </p>
      <HeroActions />
    </section>
  );
}
