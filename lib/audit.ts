import { prisma } from "@/lib/prisma"

export type AuditEntityType = "USER" | "VENUE" | "RESERVATION"

export type AuditMetadata = {
  [key: string]: string | number | boolean | null | undefined | AuditMetadata | (string | number)[]
}

/**
 * Write an audit log entry. Use within the same transaction as the main write
 * by passing the tx from prisma.$transaction if you need atomicity.
 */
export async function writeAuditLog(
  params: {
    actorUserId: string | null
    action: string
    entityType: AuditEntityType
    entityId: string | null
    metadata?: AuditMetadata
  },
  tx?: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<void> {
  const client = tx ?? prisma
  await client.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ?? undefined,
    },
  })
}
