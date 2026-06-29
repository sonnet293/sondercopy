// js/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://mhaqjahqjwfviwcvbhyf.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oYXFqYWhxandmdml3Y3ZiaHlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTE3MjAsImV4cCI6MjA5NTk2NzcyMH0.NRUXnuIciFlQFH4Gk0asyL6OMcqssXqUYoMikvy1iwU"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const BUCKET_NAME = "post-images";

export async function uploadImage(blob, fileName) {
  const ext = (fileName.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext || "png"}`;
  const filePath = `posts/${safeName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, blob, {
      contentType: blob.type,
      upsert: false,
    });

  if (error) throw new Error(`업로드 실패: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}