import { Outlet, Link, useLocation } from "react-router-dom";
import { 
  FileText, LayoutDashboard, Settings, LogOut, 
  Bell, Search, Plus, Layers, Users, 
  ShieldCheck, HelpCircle, ChevronRight
} from "lucide-react";
import { motion } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Layout() {
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Overview", path: "/" },
    { icon: FileText, label: "Documents", path: "/documents" },
    { icon: Layers, label: "Templates", path: "/templates" },
    { icon: Users, label: "Team", path: "/team" },
  ];

  const secondaryItems = [
    { icon: Settings, label: "Settings", path: "/settings" },
    { icon: HelpCircle, label: "Support", path: "/support" },
  ];

  return (
    <div className="flex h-screen bg-[#FDFDFD]">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-100 flex flex-col z-20">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-200">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="font-serif font-bold text-xl tracking-tight text-slate-900 block leading-none">SignFlow</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">Enterprise</span>
          </div>
        </div>

        <div className="flex-1 px-6 py-4 space-y-8 overflow-y-auto">
          <div>
            <h3 className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Main Menu</h3>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "group flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                      isActive 
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-900")} />
                      {item.label}
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 opacity-50" />}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div>
            <h3 className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">System</h3>
            <nav className="space-y-1">
              {secondaryItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                      isActive 
                        ? "bg-slate-100 text-slate-900" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5", isActive ? "text-slate-900" : "text-slate-400")} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-6 border-t border-slate-50">
          <div className="bg-slate-50 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-900 font-bold text-sm">
                TA
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-slate-900 truncate">Toufik Arhalai</p>
                <p className="text-[10px] text-slate-500 truncate">Pro Plan</p>
              </div>
            </div>
            <button className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 shrink-0 z-10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100 w-80 group focus-within:ring-2 focus-within:ring-slate-900/5 transition-all">
              <Search className="w-4 h-4 text-slate-400 group-focus-within:text-slate-900" />
              <input 
                type="text" 
                placeholder="Search documents, signers..." 
                className="bg-transparent border-none text-sm focus:ring-0 w-full placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-slate-900 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-100 mx-2" />
            <Link to="/documents/new" className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Create New
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-[#FDFDFD]">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
