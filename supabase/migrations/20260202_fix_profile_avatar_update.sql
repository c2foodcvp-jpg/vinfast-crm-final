-- Create policy to allow users to update their own profile
-- This is critical for Avatar updates and other profile changes
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    
    CREATE POLICY "Users can update own profile"
    ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
    
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- Verify and Fix Storage Policy as well (just in case)
DO $$ 
BEGIN
    -- Ensure "avatars" bucket exists
    insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', true)
    on conflict (id) do nothing;

    -- Allow authenticated users to upload to avatars bucket
    DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
    CREATE POLICY "Authenticated users can upload avatars"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'avatars' );

    -- Allow users to update their own avatars (overwrite/delete)
    DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
    CREATE POLICY "Users can update own avatars"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );
    
    -- Allow public to view
    DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
    CREATE POLICY "Public can view avatars"
    ON storage.objects FOR SELECT
    TO public
    USING ( bucket_id = 'avatars' );
    
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
