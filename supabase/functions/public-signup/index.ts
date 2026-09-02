// Edge Function: public-signup
// Called from the public sign-up page. Anyone can call this (no staff
// login required) — that's the point, it's self-service. Creates a real
// login account immediately, no staff review needed.
//
// Deploy with: npx supabase functions deploy public-signup --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function randomMemberNumber() {
  const n = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `MBR-${n}`;
}

Deno.serve(async (req) => {
  // The browser sends a preflight OPTIONS request before the real POST,
  // to check it's allowed to call this from a different domain. It has
  // no body and expects a quick 200 with these headers — nothing else.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, phone, password } = await req.json();

    if (!name || !email || !phone || !password) {
      return new Response(JSON.stringify({ error: "Name, email, phone, and password are all required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no email verification step — they can log in right away
    });
    if (createErr) {
      // Most common case: this email already has an account
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try a few times in the unlikely case of a member_number collision.
    let insertErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase.from("members").insert({
        id: created.user.id,
        member_number: randomMemberNumber(),
        name,
        email,
        phone,
        notify_by_email: true,
      });
      insertErr = error;
      if (!error) break;
      if (!String(error.message).includes("member_number")) break; // some other error, stop retrying
    }

    if (insertErr) {
      await supabase.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send a welcome email — best-effort. If this fails, the account
    // still exists and sign-up should still be reported as successful.
    try {
      const { data: contentRows } = await supabase
        .from("site_content")
        .select("key, value")
        .in("key", ["welcome_email_subject", "welcome_email_body", "club_name"]);
      const contentMap: Record<string, string> = {};
      (contentRows || []).forEach((r) => { contentMap[r.key] = r.value; });

      const clubName = contentMap.club_name || "the club";
      const firstName = (name || "").split(" ")[0];
      const subject = (contentMap.welcome_email_subject || "Welcome to the list").replace(/\{\{name\}\}/g, firstName);
      const body = (contentMap.welcome_email_body || `Hi {{name}},\n\nYour account is ready.\n\n— ${clubName}`).replace(/\{\{name\}\}/g, firstName);

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${clubName} <onboarding@resend.dev>`, // swap for your verified domain once set up
          to: email,
          subject,
          text: body,
        }),
      });

      if (resendResp.ok) {
        await supabase.from("notifications").insert({
          member_id: created.user.id,
          to_email: email,
          subject,
          body,
        });
      } else {
        console.error("Welcome email failed:", await resendResp.text());
      }
    } catch (emailErr) {
      console.error("Welcome email error:", emailErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
