-- Bucket para screenshots de "Reportar Erro" (upload só via Edge Function / service role).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'error-reports',
  'error-reports',
  true,
  5242880,
  ARRAY['image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública (URL permanente no ticket RESPONSUM). Escrita apenas service_role (bypassa RLS).
DROP POLICY IF EXISTS "error_reports_public_read" ON storage.objects;
CREATE POLICY "error_reports_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'error-reports');
