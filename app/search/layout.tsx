import dynamic from "next/dynamic"

const BottomNav = dynamic(
  () =>
    import("@/components/layout/BottomNav")
      .then((mod) => ({ default: mod?.BottomNav ?? (() => null) }))
      .catch(() => ({ default: () => null })),
  { ssr: false }
)

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main
        className="flex-1"
        style={{ paddingBottom: "var(--bottom-nav-height)" }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
