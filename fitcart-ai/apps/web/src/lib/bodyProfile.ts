import { supabase, isSupabaseConfigured } from './supabase';

export interface BodyProfileRow {
  id: number;
  user_id: string;
  photo_path: string;
  height_cm: number | null;
  weight_kg: number | null;
  consent_photos: boolean;
  consent_sharing: boolean;
  created_at: string;
  expires_at: string;
}

// Uploads the captured photo to the private `user-photos` bucket (RLS-scoped
// to the uploader — see supabase/schema.sql) and creates the body_profiles
// row that backs it. Requires an existing Supabase session — including an
// anonymous one, see src/state/AuthState.tsx — since both storage RLS and
// the row's user_id need a real auth.uid().
export async function uploadBodyProfile(file: File, consentSharing: boolean): Promise<BodyProfileRow | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('user-photos').upload(path, file, {
    contentType: file.type || 'image/jpeg',
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('body_profiles')
    .insert({
      user_id: user.id,
      photo_path: path,
      consent_photos: true, // implied by submitting Setup — see Setup.tsx
      consent_sharing: consentSharing,
    })
    .select()
    .single();
  if (error) throw error;

  return data as BodyProfileRow;
}
