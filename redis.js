import Redis from "ioredis";

const url = process.env.REDIS_URL;
if (!url) {
  console.warn("[warn] REDIS_URL not set. Using in-memory stub cache.");
}

let client = null;
let memory = new Map();

export function getRedis() {
  if (!url) {
    // simple in-memory fallback (not for production)
    return {
      async get(key) { return memory.get(key) || null; },
      async set(key, val, mode, ttl) {
        memory.set(key, val);
        if (mode === "EX" && ttl) {
          setTimeout(() => memory.delete(key), ttl * 1000);
        }
      }
    };
  }
  if (!client) {
    client = new Redis(url, {
      tls: url.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: 2
    });
    client.on("error", (e) => console.error("[redis] error", e.message));
  }
  return client;
}
