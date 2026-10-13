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

let cachedAutoDemoConfig: { autoDemoEnabled: boolean; autoDemoDurationMinutes: number } | null = null;
let lastAutoDemoCheck = 0;

export async function getAutoDemoConfig(): Promise<{ autoDemoEnabled: boolean; autoDemoDurationMinutes: number }> {
  const now = Date.now();
  if (cachedAutoDemoConfig && now - lastAutoDemoCheck < CACHE_TTL_MS) {
    return cachedAutoDemoConfig;
  }

  try {
    await connectToDatabase();
    const config = await GlobalSetting.findOne({ key: 'global_config' }).lean();
    if (config) {
      cachedAutoDemoConfig = {
        autoDemoEnabled: !!config.autoDemoEnabled,
        autoDemoDurationMinutes: typeof config.autoDemoDurationMinutes === 'number' && config.autoDemoDurationMinutes > 0 ? config.autoDemoDurationMinutes : 15,
      };
      lastAutoDemoCheck = now;
      return cachedAutoDemoConfig;
    }
  } catch (err) {
    console.error('Error checking auto demo config:', err);
  }

  cachedAutoDemoConfig = { autoDemoEnabled: false, autoDemoDurationMinutes: 15 };
  lastAutoDemoCheck = now;
  return cachedAutoDemoConfig;
}

export async function setAutoDemoConfig(enabled: boolean, durationMinutes: number, updatedBy: string) {
  await connectToDatabase();
  const cleanDuration = Math.max(1, Math.min(525600, durationMinutes || 15));

  const config = await GlobalSetting.findOneAndUpdate(
    { key: 'global_config' },
    { autoDemoEnabled: enabled, autoDemoDurationMinutes: cleanDuration, updatedBy },
    { upsert: true, returnDocument: 'after' }
  );

  cachedAutoDemoConfig = {
    autoDemoEnabled: !!config.autoDemoEnabled,
    autoDemoDurationMinutes: config.autoDemoDurationMinutes || cleanDuration,
  };
  lastAutoDemoCheck = Date.now();

  return cachedAutoDemoConfig;
}
