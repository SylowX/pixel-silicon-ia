import { AgentDataProvider } from "./AgentDataContext";

export default function PixelAgentsLayout({ children }: { children: React.ReactNode }) {
  return <AgentDataProvider>{children}</AgentDataProvider>;
}
