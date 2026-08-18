import { connectToDatabase } from '@/lib/db';
import { GlobalSetting } from '@/models/GlobalSetting';

let cachedGlobalFree: { isGlobalFree: boolean; freeUntil: Date | null } | null = null;
let lastGlobalFreeCheck = 0;
const CACHE_TTL_MS = 10000; // 10-second memory cache

export async function isPlatformGlobalFree(): Promise<{ isGlobalFree: boolean; freeUntil: Date | null }> {
  const now = Date.now();
  if (cachedGlobalFree && now - lastGlobalFreeCheck < CACHE_TTL_MS) {
    return cachedGlobalFree;
  }

  try {
    await connectToDatabase();
    const config = await GlobalSetting.findOne({ key: 'global_config' }).lean();
    if (config && config.freeUntil) {
      if (new Date(config.freeUntil) > new Date()) {
        cachedGlobalFree = { isGlobalFree: true, freeUntil: config.freeUntil };
        lastGlobalFreeCheck = now;
        return cachedGlobalFree;
      } else {
        // Asynchronous automatic DB cleanup when expired
        GlobalSetting.updateOne({ key: 'global_config' }, { freeUntil: null }).exec().catch(() => {});
      }
    }
  } catch (err) {
    console.error('Error checking global free status:', err);
  }

  cachedGlobalFree = { isGlobalFree: false, freeUntil: null };
  lastGlobalFreeCheck = now;
  return cachedGlobalFree;
}

export async function setGlobalFreeDays(days: number, updatedBy: string) {
  await connectToDatabase();
  let freeUntil: Date | null = null;
  if (days > 0) {
    freeUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const config = await GlobalSetting.findOneAndUpdate(
    { key: 'global_config' },
    { freeUntil, updatedBy },
    { upsert: true, returnDocument: 'after' }
  );

  // Invalidate cache immediately on update
  cachedGlobalFree = {
    isGlobalFree: !!(config.freeUntil && new Date(config.freeUntil) > new Date()),
    freeUntil: config?.freeUntil || null,
  };
  lastGlobalFreeCheck = Date.now();

  return cachedGlobalFree;
}
