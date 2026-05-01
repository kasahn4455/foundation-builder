-- Create public storage bucket for token metadata (logos + JSON manifests)
INSERT INTO storage.buckets (id, name, public)
VALUES ('token-metadata', 'token-metadata', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access (manifests + logos must be fetchable by wallets/explorers)
DROP POLICY IF EXISTS "Token metadata is publicly readable" ON storage.objects;
CREATE POLICY "Token metadata is publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'token-metadata');

-- Only service role writes (server-side uploads via supabaseAdmin)
DROP POLICY IF EXISTS "Service role manages token metadata" ON storage.objects;
CREATE POLICY "Service role manages token metadata"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'token-metadata')
WITH CHECK (bucket_id = 'token-metadata');