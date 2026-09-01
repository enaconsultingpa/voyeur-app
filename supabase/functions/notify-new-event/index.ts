// Edge Function: notify-new-event
// Called by the admin panel after staff adds a new event.
// Emails every member with notify_by_email = true.
//
// Deploy with: npx supabase functions deploy notify-new-event
// Uses the same RESEND_API_KEY secret already set for send-photo-email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function formatDate(dateStr: string) {
  // dateStr is a plain date like "2026-09-15" — parse as local, not UTC,
  // so the day shown matches what staff typed.
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
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

    const { title, eventDate, detail } = await req.json();
    if (!title || !eventDate) {
      return new Response(JSON.stringify({ error: "title and eventDate are required" }), { status: 400, headers: corsHeaders });
    }

    const { data: members, error: membersErr } = await supabase
      .from("members")
      .select("*")
      .eq("notify_by_email", true);
    if (membersErr) throw membersErr;

    const { data: clubNameRow } = await supabase.from("site_content").select("value").eq("key", "club_name").maybeSingle();
    const clubName = clubNameRow?.value || "the club";

    const { data: portalRow } = await supabase.from("site_content").select("value").eq("key", "portal_url").maybeSingle();
    const portalUrl = portalRow?.value || "";

    const results = [];
    for (const member of members || []) {
      const subject = `New event at ${clubName}: ${title}`;
      const firstName = (member.name || "").split(" ")[0];
      const body = `Hi ${firstName},\n\nA new event just went up: ${title}, on ${formatDate(eventDate)}.${detail ? `\n\n${detail}` : ""}\n\n${portalUrl ? `See it and get on the list: ${portalUrl}` : ""}\n\n— ${clubName}`;

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${clubName} <onboarding@resend.dev>`, // swap for your verified domain once set up
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
