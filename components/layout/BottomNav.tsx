"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, Calendar, User, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVenueSummary } from "@/lib/hooks";

const baseNavItems = [
  { label: "Explore", href: "/", icon: Home },
  { label: "Reservations", href: "/reservations", icon: Calendar },
  { label: "Profile", href: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: venueSummary } = useVenueSummary(!!session?.user?.id);

  const manageItem =
    venueSummary && venueSummary.count > 0
      ? {
          label: "Manage",
          href:
            venueSummary.count === 1 && venueSummary.singleVenueId
              ? `/venue/dashboard/${venueSummary.singleVenueId}`
              : "/venue/dashboard",
          icon: Laptop,
        }
      : null;

  const navItems = manageItem ? [...baseNavItems, manageItem] : baseNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/20 pb-safe">
      <div className="mx-auto flex max-w-screen-md items-center justify-around px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isManage = item.label === "Manage";
          const isActive = isManage
            ? pathname?.startsWith("/venue/dashboard") ||
              pathname?.startsWith("/venue/onboard")
            : pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
          const label =
            item.href === "/profile"
              ? session
                ? "Profile"
                : "Login"
              : item.label;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex flex-col items-center gap-1.5 rounded-2xl px-5 py-2 transition-all duration-300 active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground/70 hover:text-foreground hover:bg-black/5"
              )}
            >
              <div className={cn(
                "relative z-10 flex h-6 w-6 items-center justify-center transition-transform duration-300 group-hover:-translate-y-0.5",
                isActive && "text-primary"
              )}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                "relative z-10 text-[10px] font-semibold uppercase tracking-wider transition-opacity duration-300",
                isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
              )}>
                {label}
              </span>
              {isActive && (
                <div className="absolute inset-0 z-0 scale-95 rounded-2xl bg-primary/10 animate-in fade-in zoom-in duration-300" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
