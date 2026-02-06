"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Home, Calendar, User, Laptop } from "lucide-react"
import { cn } from "@/lib/utils"

const baseNavItems = [
  { label: "Explore", href: "/", icon: Home },
  { label: "Reservations", href: "/reservations", icon: Calendar },
  { label: "Profile", href: "/profile", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const venueSummary = session?.user?.venueSummary

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
      : null

  const navItems = manageItem ? [...baseNavItems, manageItem] : baseNavItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-screen-md items-center justify-around px-4 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isManage = item.label === "Manage"
          const isActive = isManage
            ? pathname?.startsWith("/venue/dashboard") || pathname?.startsWith("/venue/onboard")
            : pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
          const label = item.href === "/profile" ? (session ? "Profile" : "Login") : item.label

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-[rgba(15,81,50,0.2)] [&_path]:fill-[rgba(15,81,50,0.2)]")} />
              <span className="text-xs">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}