import { prisma } from "../lib/prisma"

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed notification in production.")
    process.exit(1)
  }

  const toEmail =
    process.argv[2] ?? process.env.SEED_EMAIL ?? "test@example.com"
  const dedupeKey = `seed-dispatch-test-${Date.now()}`

  const created = await prisma.notificationEvent.create({
    data: {
      type: "welcome",
      status: "PENDING",
      dedupeKey,
      toEmail: String(toEmail).trim(),
      payload: { userName: "Test" },
    },
  })

  console.log("Created PENDING NotificationEvent:", created.id)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
