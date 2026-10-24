import { prisma } from "@/lib/prisma";

export interface SyncLeaseHandle {
  leaseId: string;
  holder: string;
  release: () => Promise<void>;
  heartbeat: () => Promise<void>;
}

export class SyncLockError extends Error {
  constructor(message: string, public readonly currentHolder?: string, public readonly expiresAt?: Date) {
    super(message);
    this.name = "SyncLockError";
  }
}

/**
 * Adquire uma concessão (lease) exclusiva no banco de dados para evitar sincronizações concorrentes.
 * Usa heartbeat para manter o lease ativo e o remove ao término.
 */
export async function acquireSyncLease(
  leaseId = "GLOBAL_SYNC",
  ttlMs = 120_000,
  customHolder?: string
): Promise<SyncLeaseHandle> {
  const holder = customHolder ?? `proc-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    await prisma.syncLease.create({
      data: {
        id: leaseId,
        holder,
        acquiredAt: now,
        expiresAt,
      },
    });
  } catch {
    const updated = await prisma.syncLease.updateMany({
      where: {
        id: leaseId,
        expiresAt: { lt: now },
      },
      data: {
        holder,
        acquiredAt: now,
        expiresAt,
      },
    });

    if (updated.count === 0) {
      const active = await prisma.syncLease.findUnique({ where: { id: leaseId } });
      throw new SyncLockError(
        `Sincronização já em execução ou com lock ativo por ${active?.holder || "desconhecido"} até ${active?.expiresAt?.toISOString() || ""}`,
        active?.holder,
        active?.expiresAt
      );
    }
  }

  let heartbeatInterval: NodeJS.Timeout | null = setInterval(async () => {
    try {
      const refreshedExpiresAt = new Date(Date.now() + ttlMs);
      const res = await prisma.syncLease.updateMany({
        where: { id: leaseId, holder },
        data: { expiresAt: refreshedExpiresAt },
      });
      if (res.count === 0 && heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    } catch (err) {
      console.warn(`[SyncLease] Falha ao renovar heartbeat da lease ${leaseId}:`, err);
    }
  }, Math.max(10_000, Math.floor(ttlMs / 3)));

  if (heartbeatInterval.unref) {
    heartbeatInterval.unref();
  }

  const release = async () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    try {
      await prisma.syncLease.deleteMany({
        where: { id: leaseId, holder },
      });
    } catch (err) {
      console.warn(`[SyncLease] Erro ao liberar lease ${leaseId}:`, err);
    }
  };

  const heartbeat = async () => {
    const refreshedExpiresAt = new Date(Date.now() + ttlMs);
    const refreshed = await prisma.syncLease.updateMany({
      where: { id: leaseId, holder, expiresAt: { gt: new Date() } },
      data: { expiresAt: refreshedExpiresAt },
    });
    if (refreshed.count !== 1) throw new SyncLockError(`Lease ${leaseId} perdida ou expirada`, holder);
  };

  return {
    leaseId,
    holder,
    release,
    heartbeat,
  };
}
