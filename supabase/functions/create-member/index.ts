// Edge Function: create-member
// Called by the admin panel to add a new member. Creating another
// person's login account requires Supabase's service role key, which
// can only safely be used server-side — never in browser code.
//
// Deploy with: npx supabase functions deploy create-member

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
    const { data: staffRow } = await supabase.from("staff").select("id").eq("id", userData.user.id).maybeSingle();
    if (!staffRow) {
      return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403 });
    }

    const { name, email, memberNumber, password } = await req.json();
    if (!name || !email || !memberNumber || !password) {
      return new Response(JSON.stringify({ error: "name, email, memberNumber, and password are all required" }), { status: 400 });
    }

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400 });
    }

    const { error: insertErr } = await supabase.from("members").insert({
      id: created.user.id,
      member_number: memberNumber,
      name,
      email,
      notify_by_email: true,
    });
    if (insertErr) {
      // Roll back the auth user if the members row failed (e.g. duplicate member number)
      await supabase.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true, id: created.user.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
