import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { GNewsDebugPanel } from "@/components/debug/GNewsDebugPanel";

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <MobileNav />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <GNewsDebugPanel />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
