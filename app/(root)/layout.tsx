import dynamic from "next/dynamic"

const BottomNav = dynamic(
  () => import("@/components/layout/BottomNav").then((mod) => ({ default: mod.BottomNav })),
  {
    ssr: false,
  }
)

export default function RootGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}