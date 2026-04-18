import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Search,
  ScanLine,
  Droplet,
  ShoppingBag,
  LayoutDashboard,
  Stethoscope,
  Pill,
  Shield,
  LogOut,
  Menu,
  X,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navByRole: Record<string, { to: string; label: string; icon: any }[]> = {
  patient: [
    { to: "/app", label: "Search", icon: Search },
    { to: "/app/scan", label: "Scan Rx", icon: ScanLine },
    { to: "/app/cart", label: "Cart", icon: ShoppingCart },
    { to: "/app/orders", label: "Orders", icon: ShoppingBag },
    { to: "/app/blood", label: "Blood", icon: Droplet },
    { to: "/app/doctors", label: "Doctors", icon: Stethoscope },
  ],
  doctor: [
    { to: "/doctor", label: "Dashboard", icon: LayoutDashboard },
    { to: "/doctor/heatmap", label: "Patient Heatmap", icon: Heart },
  ],
  pharmacy: [
    { to: "/pharmacy", label: "Orders", icon: ShoppingBag },
    { to: "/pharmacy/inventory", label: "Inventory", icon: Pill },
    { to: "/pharmacy/analytics", label: "Top Searches", icon: LayoutDashboard },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", icon: Shield },
  ],
};

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { user, role, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const items = navByRole[role ?? "patient"] ?? [];

  const handleSignOut = async () => {
    await signOut();
    nav("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-2 px-3 md:px-6">
          <Link to="/app" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Heart className="h-5 w-5 text-primary-foreground" fill="currentColor" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold tracking-tight">MedLocal</span>
              <span className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
                Care, connected
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/app" || it.to === "/doctor" || it.to === "/pharmacy" || it.to === "/admin"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-base",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground md:inline">
              {role && <span className="rounded-full bg-muted px-2 py-1 capitalize">{role}</span>}
            </span>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {open && (
          <div className="border-t bg-card lg:hidden">
            <nav className="container flex flex-col gap-1 px-3 py-3">
              {items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                      isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                    )
                  }
                >
                  <it.icon className="h-4 w-4" />
                  {it.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main key={loc.pathname} className="container px-3 py-4 md:px-6 md:py-8">
        {children}
      </main>
    </div>
  );
};
