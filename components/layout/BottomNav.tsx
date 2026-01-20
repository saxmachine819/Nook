"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    label: "Explore",
    href: "/",
    icon: Home,
  },
  {
    label: "Reservations",
    href: "/reservations",
    icon: Calendar,
  },
  {
    label: "Profile",
    href: "/profile",
    icon: User,
  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-screen-md items-center justify-around px-4 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))

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
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}