export const COVER_BUCKET = "article-covers";
export const MAX_COVER_BYTES = 3 * 1024 * 1024;
export const COVER_ACCEPT = ".jpg,.jpeg,.png,.webp";
export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const coverPathPattern = /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;
