/**
 * Supabase connection details.
 *
 * These fall back to the public demo project so a fresh clone runs with zero
 * configuration. That is safe by design: the publishable (anon) key is meant
 * to ship in client bundles — it grants no privileges on its own. Every table
 * is guarded by Row Level Security, so an unauthenticated caller reads nothing
 * and a signed-in caller only ever sees rows they own.
 *
 * Point at your own project by setting NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmoiijoziixphikayei.supabase.co'

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_i7W1doGVEloWqV_L_TMgfg_n4msTK-T'
