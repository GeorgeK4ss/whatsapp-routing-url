import Redis from "ioredis";

const url = process.env.REDIS_URL;
if (!url) {
  console.warn("[warn] REDIS_URL not set. Using in-memory stub cache.");
}

let client = null;
let memory = new Map();

export function getRedis() {
  if (!url) {
    console.warn("[redis] REDIS_URL not set. Using in-memory stub cache.");
    // simple in-memory fallback (not for production)
    return {
      async get(key) { 
        const val = memory.get(key) || null;
        console.log(`[redis] GET ${key} = ${val}`);
        return val;
      },
      async set(key, val, mode, ttl) {
        console.log(`[redis] SET ${key} = ${val}`);
        memory.set(key, val);
        if (mode === "EX" && ttl) {
          setTimeout(() => memory.delete(key), ttl * 1000);
        }
      }
    };
  }
  if (!client) {
    console.log(`[redis] Connecting to: ${url}`);
    client = new Redis(url, {
      tls: url.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: 2
    });
    client.on("error", (e) => console.error("[redis] error", e.message));
    client.on("connect", () => console.log("[redis] Connected successfully"));
  }
  return client;
}
