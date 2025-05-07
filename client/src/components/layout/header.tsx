import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { getUserInitials } from "@/lib/utils/format";

export function Header() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  if (!user) return null;
  
  return (
    <header className="bg-white border-b border-neutral-200 py-2 px-4 flex items-center justify-between">
      <div className="flex items-center">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden mr-2 text-neutral-700">
              <span className="material-icons">menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar />
          </SheetContent>
        </Sheet>
        
        <div className="md:hidden text-lg font-medium text-primary">AI Feedback Tool</div>
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="p-2 rounded-full hover:bg-neutral-100">
          <span className="material-icons">notifications</span>
        </button>
        <button className="p-2 rounded-full hover:bg-neutral-100">
          <span className="material-icons">help_outline</span>
        </button>
        <div className="md:hidden flex items-center">
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
            <span>{getUserInitials(user.name)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
