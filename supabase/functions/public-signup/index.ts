// Edge Function: public-signup
// Called from the public sign-up page. Anyone can call this (no staff
// login required) — that's the point, it's self-service. Creates a real
// login account immediately, no staff review needed.
//
// Deploy with: npx supabase functions deploy public-signup --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function randomMemberNumber() {
  const n = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `MBR-${n}`;
}

Deno.serve(async (req) => {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return new Response(JSON.stringify({ error: "Name, email, and password are all required." }), { status: 400 });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters." }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no email verification step — they can log in right away
    });
    if (createErr) {
      // Most common case: this email already has an account
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400 });
    }

    // Try a few times in the unlikely case of a member_number collision.
    let insertErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase.from("members").insert({
        id: created.user.id,
        member_number: randomMemberNumber(),
        name,
        email,
        notify_by_email: true,
      });
      insertErr = error;
      if (!error) break;
      if (!String(error.message).includes("member_number")) break; // some other error, stop retrying
    }

    if (insertErr) {
      await supabase.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
