
CREATE POLICY "own upload read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'verification-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own upload insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'verification-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own upload delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'verification-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "admins read uploads" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'verification-uploads' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "avatars public read" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'avatars');
CREATE POLICY "own avatar write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own avatar update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own avatar delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
