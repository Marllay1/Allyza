-- Voice messages upload audio to the private bucket, which so far only accepted images:
-- every voice note was rejected at upload. Allow the audio formats browsers record in.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/webm', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/ogg', 'audio/x-m4a'
]
where id = 'couple-media';
