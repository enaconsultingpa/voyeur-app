// Edge Function: send-photo-email
// Called by the admin panel after staff tags photo(s) to member(s).
// Runs server-side, so it's safe to use the Resend API key here.
//
// Deploy with: npx supabase functions deploy send-photo-email
// Set the secret with: npx supabase secrets set RESEND_API_KEY=your_key_here

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    // Verify the caller is actually logged in and is staff
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: corsHeaders });
    }
    const { data: staffRow } = await supabase.from("staff").select("id").eq("id", userData.user.id).maybeSingle();
    if (!staffRow) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: corsHeaders });
    }

    const { memberIds, photoCount, expiresAt } = await req.json();
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return new Response(JSON.stringify({ error: "memberIds required" }), { status: 400, headers: corsHeaders });
    }

    const { data: members, error: membersErr } = await supabase
      .from("members")
      .select("*")
      .in("id", memberIds)
      .eq("notify_by_email", true);
    if (membersErr) throw membersErr;

    const results = [];
    for (const member of members) {
      const subject = "Your Voyeur photos are ready to download";
      const firstName = member.name.split(" ")[0];
      const body = `Hi ${firstName},\n\n${photoCount} new photo${photoCount > 1 ? "s" : ""} from your night at Voyeur ${photoCount > 1 ? "are" : "is"} ready on your members page.\n\nYou have until ${formatDate(expiresAt)} (about 1 week) to download ${photoCount > 1 ? "them" : "it"} before they expire.\n\nLog in at your members page to view and download.\n\n— Voyeur`;

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Voyeur <onboarding@resend.dev>", // swap for your verified domain once set up
          to: member.email,
          subject,
          text: body,
        }),
      });

      if (!resendResp.ok) {
        const errText = await resendResp.text();
        console.error("Resend error for", member.email, errText);
        continue;
      }

      await supabase.from("notifications").insert({
        member_id: member.id,
        to_email: member.email,
        subject,
        body,
      });
      results.push(member.email);
    }

    return new Response(JSON.stringify({ sent: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
