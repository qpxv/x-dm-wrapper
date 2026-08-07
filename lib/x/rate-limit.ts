import { prisma } from "@/lib/prisma";

const DEFAULT_DAILY_CAP = 500;
const DEFAULT_BUMP_AMOUNT = 100;

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function getOrCreateTodayLog(): Promise<{ count: number; capOverride: number | null }> {
  const date = todayUtc();
  return prisma.apiCallLog.upsert({
    where: { date },
    create: { date, count: 0 },
    update: {},
  });
}

export async function tryConsumeApiCall(): Promise<boolean> {
  const log = await getOrCreateTodayLog();
  const cap = log.capOverride ?? Number(process.env.X_API_DAILY_CAP ?? DEFAULT_DAILY_CAP);

  if (log.count >= cap) {
    return false;
  }

  await prisma.apiCallLog.update({
    where: { date: todayUtc() },
    data: { count: { increment: 1 } },
  });

  return true;
}

export async function bumpDailyCap(amount: number = DEFAULT_BUMP_AMOUNT): Promise<void> {
  const log = await getOrCreateTodayLog();
  const effectiveCap = log.capOverride ?? Number(process.env.X_API_DAILY_CAP ?? DEFAULT_DAILY_CAP);

  await prisma.apiCallLog.update({
    where: { date: todayUtc() },
    data: { capOverride: effectiveCap + amount },
  });
}
