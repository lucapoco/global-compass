import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { GNewsDebugPanel } from "@/components/debug/GNewsDebugPanel";
import { ViewModeProvider, useViewMode } from "@/context/ViewModeContext";

function DebugSlot() {
  const { isAdvanced } = useViewMode();
  if (!isAdvanced) return null;
  return <GNewsDebugPanel />;
}

export function AppLayout() {
  return (
    <ViewModeProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <MobileNav />
          <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <DebugSlot />
            <Outlet />
          </main>
        </div>
      </div>
    </ViewModeProvider>
  );
}
