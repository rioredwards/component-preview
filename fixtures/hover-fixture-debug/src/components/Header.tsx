import { Brand } from "./Brand";
import { Button } from "./Button";

export function Header() {
  return (
    <header className="topBar">
      <Brand />
      <Button variant="ghost">Open Workspace</Button>
    </header>
  );
}
