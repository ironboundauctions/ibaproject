import { supabase } from '../lib/supabase';

export async function createAvatarsBucket() {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const avatarsBucket = buckets?.find(b => b.id === 'avatars');

    if (avatarsBucket) {
      console.log('Avatars bucket already exists');
      return true;
    }

    const { data, error } = await supabase.storage.createBucket('avatars', {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    });

    if (error) {
      console.error('Error creating avatars bucket:', error);
      return false;
    }

    console.log('Avatars bucket created successfully');
    return true;
  } catch (error) {
    console.error('Error in createAvatarsBucket:', error);
    return false;
  }
}
