const PHOTO_TTL_SECONDS = 60 * 60;
const CACHE_TTL_MS = 45 * 60 * 1000;

export function getPhotoPath(value = "") {
  if (typeof value !== "string") return "";
  value = value.trim();
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    const marker = "/profile-photos/";
    const index = url.pathname.indexOf(marker);
    return index < 0
      ? value
      : decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return "";
  }
}

export function createPhotoUrlResolver(client, now = Date.now) {
  const cache = new Map();
  const pending = new Map();
  return async (value, { force = false } = {}) => {
    const path = getPhotoPath(value);
    if (!path || !client || /^(https?:|data:|blob:)/i.test(path)) return path;
    if (!force && cache.get(path)?.expiresAt > now()) return cache.get(path).url;
    if (pending.has(path)) return pending.get(path);
    const request = (async () => {
      try {
        const { data, error } = await client.storage
          .from("profile-photos")
          .createSignedUrl(path, PHOTO_TTL_SECONDS);
        if (error || !data?.signedUrl) return "";
        cache.set(path, { url: data.signedUrl, expiresAt: now() + CACHE_TTL_MS });
        return data.signedUrl;
      } catch {
        return "";
      }
    })();
    pending.set(path, request);
    try {
      return await request;
    } finally {
      pending.delete(path);
    }
  };
}

export async function validateProfilePhoto(file) {
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
    throw new Error("Gunakan gambar maksimal 5 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = () => reject(new Error(
        "Gambar tidak dapat dibaca browser. Gunakan foto JPG, PNG, atau WebP yang bisa dibuka.",
      ));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
