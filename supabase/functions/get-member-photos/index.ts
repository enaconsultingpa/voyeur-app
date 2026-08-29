// Edge Function: get-member-photos
// Called by a logged-in member to fetch their own tagged, non-expired
// photos with temporary signed download URLs. Runs server-side with
// the service role key so it can generate signed URLs regardless of
// storage RLS, but it only ever returns photos tagged to the caller.
//
// Deploy with: npx supabase functions deploy get-member-photos

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    const memberId = userData.user.id;

    const { data: tags, error: tagsErr } = await supabase
      .from("photo_tags")
      .select("photo_id")
      .eq("member_id", memberId);
    if (tagsErr) throw tagsErr;

    const photoIds = (tags || []).map((t) => t.photo_id);
    if (photoIds.length === 0) {
      return new Response(JSON.stringify({ photos: [] }), { headers: { "Content-Type": "application/json" } });
    }

    const { data: photos, error: photosErr } = await supabase
      .from("photos")
      .select("*")
      .in("id", photoIds)
      .gt("expires_at", new Date().toISOString());
    if (photosErr) throw photosErr;

    const withUrls = await Promise.all(
      (photos || []).map(async (p) => {
        const { data: signed } = await supabase.storage
          .from("member-photos")
          .createSignedUrl(p.storage_path, 60 * 60); // 1 hour
        return { ...p, signedUrl: signed?.signedUrl };
      })
    );

    return new Response(JSON.stringify({ photos: withUrls }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
