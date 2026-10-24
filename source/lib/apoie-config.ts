
export function pixKeyFromEnv(value: string | undefined): string | null {
  const key = value?.trim() ?? "";
  if (!key || key.length > 120 || !/^[A-Za-z0-9@+._-]+$/.test(key)) return null;
  return key;
}
