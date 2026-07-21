function getNamedApiKey(envName: string, keyName = "default") {
  const raw = Deno.env.get(envName);
  if (!raw) throw new Error(`${envName} is not configured`);

  let keys: Record<string, unknown>;
  try {
    keys = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`${envName} must be a JSON object`);
  }

  const key = keys[keyName];
  if (typeof key !== "string" || !key.trim()) {
    throw new Error(`${envName} does not contain a ${keyName} key`);
  }
  return key;
}

export function getSupabasePublishableKey() {
  return getNamedApiKey("SUPABASE_PUBLISHABLE_KEYS");
}

export function getSupabaseSecretKey() {
  return getNamedApiKey("SUPABASE_SECRET_KEYS");
}
