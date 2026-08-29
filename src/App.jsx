import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  Lock, Upload, Download, Plus, Trash2, LogOut, Shield, Clock,
  Image as ImageIcon, Mail, CheckCircle2, Search, Calendar,
  Settings, ArrowLeft, DownloadCloud, BellOff, Bell,
} from "lucide-react";

const btnGhost = { background: "transparent", border: "1px solid var(--border-strong)", color: "var(--paper)", borderRadius: "6px", padding: "7px 12px", fontSize: "13px", cursor: "pointer" };
const btnGold = { background: "var(--lilac)", border: "none", color: "#1c1730", borderRadius: "6px", padding: "10px 18px", fontSize: "14px", fontWeight: 600, cursor: "pointer" };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "var(--panel-2)", border: "1px solid var(--border-strong)", color: "var(--paper)", borderRadius: "6px", padding: "11px 12px", fontSize: "14px", outline: "none" };
const cardStyle = { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px", marginBottom: "10px" };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function daysLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
function isUpcoming(dateStr) {
  return new Date(dateStr + "T23:59:59").getTime() >= Date.now();
}

async function callFunction(name, body, accessToken) {
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (error) throw error;
  return data;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [isStaff, setIsStaff] = useState(false);
  const [memberProfile, setMemberProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("login"); // login | forgot | resetPassword | profile | adminLogin | admin

  // Detect Supabase's password-recovery redirect (comes back with #access_token=...&type=recovery)
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) {
      setMode("resetPassword");
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Once we have a session, figure out whether this person is staff or a member (or both)
  useEffect(() => {
    if (!session) {
      setIsStaff(false);
      setMemberProfile(null);
      return;
    }
    (async () => {
      const { data: staffRow } = await supabase.from("staff").select("id").eq("id", session.user.id).maybeSingle();
      setIsStaff(!!staffRow);

      const { data: memberRow } = await supabase.from("members").select("*").eq("id", session.user.id).maybeSingle();
      if (memberRow) {
        setMemberProfile(memberRow);
        if (mode === "login" || mode === "adminLogin") setMode("profile");
      } else if (staffRow) {
        if (mode === "login" || mode === "adminLogin") setMode("admin");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function logout() {
    await supabase.auth.signOut();
    setMode("login");
  }

  if (!ready) return <div style={{ padding: "2rem", textAlign: "center", color: "var(--fog)" }}>Loading…</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", color: "var(--paper)", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 28px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/assets/voyeur-wordmark.png" alt="Voyeur" style={{ height: "22px" }} />
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {session && memberProfile && mode === "profile" && (
            <span style={{ fontSize: "13px", color: "var(--fog)" }}>{memberProfile.name} · {memberProfile.email}</span>
          )}
          {session && <button onClick={logout} style={btnGhost}><LogOut size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Log out</button>}
          {!session && mode === "login" && <button onClick={() => setMode("adminLogin")} style={btnGhost}><Shield size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Staff</button>}
        </div>
      </div>

      {mode === "login" && <MemberLogin onForgot={() => setMode("forgot")} />}
      {mode === "forgot" && <ForgotPassword onBack={() => setMode("login")} />}
      {mode === "resetPassword" && <ResetPassword onDone={() => { window.location.hash = ""; setMode("login"); }} />}
      {mode === "adminLogin" && <StaffLogin onBack={() => setMode("login")} />}

      {mode === "profile" && session && memberProfile && (
        <Profile session={session} member={memberProfile} onMemberUpdated={setMemberProfile} />
      )}

      {mode === "admin" && session && isStaff && <AdminPanel session={session} />}

      {mode === "admin" && session && !isStaff && (
        <div style={{ maxWidth: "420px", margin: "80px auto", textAlign: "center", color: "var(--fog)" }}>
          This account isn't set up as staff yet. Add its user id to the <code>staff</code> table in Supabase.
        </div>
      )}
    </div>
  );
}

// ---------------- MEMBER LOGIN ----------------

function MemberLogin({ onForgot }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(err.message);
  }

  return (
    <div style={{ maxWidth: "380px", margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
      <Lock size={28} color="var(--lilac)" style={{ marginBottom: "16px" }} />
      <h1 style={{ fontSize: "26px", margin: "0 0 8px" }}>Members login</h1>
      <p style={{ color: "var(--fog)", fontSize: "14px", marginBottom: "28px" }}>Log in to view and download your photos.</p>
      <form onSubmit={handleLogin}>
        <input style={{ ...inputStyle, marginBottom: "10px" }} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p style={{ color: "var(--error)", fontSize: "13px", marginTop: "8px", textAlign: "left" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ ...btnGold, width: "100%", marginTop: "16px", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <button onClick={onForgot} style={{ background: "none", border: "none", color: "var(--sky)", fontSize: "12px", marginTop: "16px", cursor: "pointer", textDecoration: "underline" }}>
        Forgot your password?
      </button>
    </div>
  );
}

function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function requestReset(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div style={{ maxWidth: "380px", margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <Mail size={26} color="var(--sky)" style={{ marginBottom: "16px" }} />
        <h1 style={{ fontSize: "22px", margin: "0 0 12px" }}>Check your email</h1>
        <p style={{ color: "var(--fog)", fontSize: "14px", marginBottom: "24px" }}>If that email matches a member account, a reset link is on its way.</p>
        <button onClick={onBack} style={{ ...btnGold, width: "100%" }}>Back to login</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "380px", margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--fog)", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: "24px" }}>
        <ArrowLeft size={14} /> Back to login
      </button>
      <h1 style={{ fontSize: "22px", margin: "0 0 8px" }}>Reset your password</h1>
      <p style={{ color: "var(--fog)", fontSize: "13px", marginBottom: "24px" }}>Enter your account email and we'll send a reset link.</p>
      <form onSubmit={requestReset}>
        <input type="email" style={inputStyle} placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <p style={{ color: "var(--error)", fontSize: "13px", marginTop: "8px", textAlign: "left" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ ...btnGold, width: "100%", marginTop: "16px", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}

function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (!password.trim()) { setError("Enter a new password."); return; }
    const { error: err } = await supabase.auth.updateUser({ password: password.trim() });
    if (err) { setError(err.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ maxWidth: "380px", margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <CheckCircle2 size={28} color="var(--success)" style={{ marginBottom: "16px" }} />
        <h1 style={{ fontSize: "22px", margin: "0 0 12px" }}>Password updated</h1>
        <button onClick={onDone} style={{ ...btnGold, width: "100%" }}>Back to login</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "380px", margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
      <h1 style={{ fontSize: "22px", margin: "0 0 8px" }}>Set a new password</h1>
      <p style={{ color: "var(--fog)", fontSize: "13px", marginBottom: "24px" }}>You followed a reset link — choose a new password below.</p>
      <form onSubmit={save}>
        <input type="password" style={inputStyle} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p style={{ color: "var(--error)", fontSize: "13px", marginTop: "8px", textAlign: "left" }}>{error}</p>}
        <button type="submit" style={{ ...btnGold, width: "100%", marginTop: "16px" }}>Set new password</button>
      </form>
    </div>
  );
}

function StaffLogin({ onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(err.message);
  }

  return (
    <div style={{ maxWidth: "360px", margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
      <Shield size={26} color="var(--lilac)" style={{ marginBottom: "16px" }} />
      <h1 style={{ fontSize: "22px", margin: "0 0 8px" }}>Staff access</h1>
      <p style={{ color: "var(--fog)", fontSize: "13px", marginBottom: "24px" }}>Use your staff account email and password.</p>
      <form onSubmit={handleLogin}>
        <input type="email" style={{ ...inputStyle, marginBottom: "10px" }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" style={inputStyle} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p style={{ color: "var(--error)", fontSize: "13px", marginTop: "8px" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ ...btnGold, width: "100%", marginTop: "16px" }}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>
      <button onClick={onBack} style={{ ...btnGhost, marginTop: "16px" }}>Back to members login</button>
    </div>
  );
}

// ---------------- MEMBER PROFILE ----------------

function Profile({ session, member, onMemberUpdated }) {
  const [showSettings, setShowSettings] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [events, setEvents] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  const loadPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const data = await callFunction("get-member-photos", {}, session.access_token);
      setPhotos(data.photos || []);
    } catch (e) {
      console.error("Failed to load photos", e);
    }
    setLoadingPhotos(false);
  }, [session]);

  useEffect(() => {
    loadPhotos();
    supabase
      .from("events")
      .select("*")
      .then(({ data }) => setEvents(data || []));
  }, [loadPhotos]);

  const upcomingEvents = events.filter((ev) => isUpcoming(ev.event_date)).sort((a, b) => a.event_date.localeCompare(b.event_date));

  async function downloadAll() {
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const link = document.createElement("a");
      link.href = p.signedUrl;
      link.download = p.caption ? `${p.caption.replace(/\s+/g, "-")}.jpg` : `voyeur-photo-${i + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "22px", marginBottom: "4px" }}>Welcome back, {member.name.split(" ")[0]}</h2>
          <p style={{ color: "var(--fog)", fontSize: "13px" }}>{member.email}</p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} style={btnGhost}>
          <Settings size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{showSettings ? "Close" : "Account"}
        </button>
      </div>

      {showSettings && <AccountSettings member={member} onMemberUpdated={onMemberUpdated} />}

      <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", marginTop: showSettings ? "20px" : 0 }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Your member ID</div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--lilac)" }}>{member.member_number}</div>
        </div>
        <div style={{ fontSize: "12px", color: "var(--fog)", maxWidth: "220px", textAlign: "right" }}>Show this at the door for guest list and photo tagging.</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--lilac)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
        <Calendar size={16} /> Upcoming events
      </div>
      {upcomingEvents.length === 0 && <p style={{ color: "var(--fog)", fontSize: "13px", fontStyle: "italic", marginBottom: "28px" }}>Nothing on the calendar yet — check back soon.</p>}
      {upcomingEvents.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          {upcomingEvents.map((ev) => (
            <div key={ev.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{ev.title}</div>
                <div style={{ fontSize: "12px", color: "var(--lilac)", whiteSpace: "nowrap" }}>{formatDate(ev.event_date)}</div>
              </div>
              <div style={{ color: "var(--fog)", fontSize: "13px", marginTop: "4px" }}>{ev.detail}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--lilac)", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <ImageIcon size={16} /> Your photos
        </div>
        {photos.length > 0 && (
          <button onClick={downloadAll} style={{ ...btnGold, padding: "7px 14px", fontSize: "12px" }}>
            <DownloadCloud size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Download all ({photos.length})
          </button>
        )}
      </div>
      {loadingPhotos && <p style={{ color: "var(--fog)", fontSize: "13px" }}>Loading your photos…</p>}
      {!loadingPhotos && photos.length === 0 && <p style={{ color: "var(--fog)", fontSize: "13px", fontStyle: "italic" }}>No photos are ready for you yet. Check back after your next visit.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
        {photos.map((p) => (
          <div key={p.id} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <img src={p.signedUrl} alt={p.caption || "Club photo"} style={{ width: "100%", height: "120px", objectFit: "cover", display: "block" }} />
            <div style={{ padding: "10px" }}>
              <div style={{ fontSize: "12px", color: "var(--paper)", marginBottom: "6px" }}>{p.caption || "Untitled"}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--error)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={11} /> {daysLeft(p.expires_at)}d left
                </span>
                <a href={p.signedUrl} download style={{ ...btnGold, padding: "5px 10px", fontSize: "11px", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  <Download size={12} /> Save
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountSettings({ member, onMemberUpdated }) {
  const [email, setEmail] = useState(member.email);
  const [newPw, setNewPw] = useState("");
  const [notifyByEmail, setNotifyByEmail] = useState(member.notify_by_email !== false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaved(false);
    setError("");
    setSaving(true);

    if (newPw.trim()) {
      const { error: pwErr } = await supabase.auth.updateUser({ password: newPw.trim() });
      if (pwErr) { setError(pwErr.message); setSaving(false); return; }
    }
    if (email.trim().toLowerCase() !== member.email) {
      const { error: emailErr } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
      if (emailErr) { setError(emailErr.message); setSaving(false); return; }
    }
    const { data, error: dbErr } = await supabase
      .from("members")
      .update({ notify_by_email: notifyByEmail, email: email.trim().toLowerCase() })
      .eq("id", member.id)
      .select()
      .single();
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onMemberUpdated(data);
    setNewPw("");
    setSaved(true);
  }

  return (
    <div style={{ ...cardStyle, padding: "18px" }}>
      <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "14px" }}>Account settings</div>
      <form onSubmit={save}>
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Email</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>New password</div>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Leave blank to keep current" style={inputStyle} />
        </div>
        <button
          type="button"
          onClick={() => setNotifyByEmail(!notifyByEmail)}
          style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 8, marginBottom: "14px", background: notifyByEmail ? "rgba(185,169,224,0.12)" : "transparent" }}
        >
          {notifyByEmail ? <Bell size={14} /> : <BellOff size={14} />}
          Email me when new photos are ready
          <span style={{ marginLeft: "auto", fontSize: "11px", color: notifyByEmail ? "var(--lilac)" : "var(--fog)" }}>{notifyByEmail ? "On" : "Off"}</span>
        </button>
        {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
        {saved && !error && <p style={{ color: "var(--success)", fontSize: "13px", marginBottom: "10px" }}>Saved.</p>}
        <button type="submit" disabled={saving} style={btnGold}>{saving ? "Saving…" : "Save changes"}</button>
      </form>
    </div>
  );
}

// ---------------- ADMIN ----------------

function AdminPanel({ session }) {
  const [tab, setTab] = useState("photos");
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("members").select("*").order("name");
    setMembers(data || []);
  }, []);
  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from("events").select("*").order("event_date");
    setEvents(data || []);
  }, []);
  const loadNotifications = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("*").order("sent_at", { ascending: false }).limit(100);
    setNotifications(data || []);
  }, []);

  useEffect(() => {
    loadMembers();
    loadEvents();
    loadNotifications();
  }, [loadMembers, loadEvents, loadNotifications]);

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        <button onClick={() => setTab("photos")} style={{ ...btnGhost, background: tab === "photos" ? "var(--panel-2)" : "transparent" }}>Photos</button>
        <button onClick={() => setTab("members")} style={{ ...btnGhost, background: tab === "members" ? "var(--panel-2)" : "transparent" }}>Members</button>
        <button onClick={() => setTab("events")} style={{ ...btnGhost, background: tab === "events" ? "var(--panel-2)" : "transparent" }}>Events</button>
        <button onClick={() => setTab("notifications")} style={{ ...btnGhost, background: tab === "notifications" ? "var(--panel-2)" : "transparent" }}>
          <Mail size={12} style={{ marginRight: 6, verticalAlign: -2 }} />Notifications ({notifications.length})
        </button>
      </div>

      {tab === "photos" && <AdminPhotos session={session} members={members} onSent={loadNotifications} />}
      {tab === "members" && <AdminMembers session={session} members={members} onChanged={loadMembers} />}
      {tab === "events" && <AdminEvents events={events} onChanged={loadEvents} />}
      {tab === "notifications" && <AdminNotifications notifications={notifications} />}
    </div>
  );
}

function AdminPhotos({ session, members, onSent }) {
  const [files, setFiles] = useState([]); // File objects
  const [caption, setCaption] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [expiryDays, setExpiryDays] = useState(7);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [recentUploads, setRecentUploads] = useState([]);

  function handleFiles(e) {
    setFiles(Array.from(e.target.files || []));
  }
  function toggleMember(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function upload() {
    if (files.length === 0) { setError("Choose at least one photo first."); return; }
    if (selectedIds.length === 0) { setError("Select at least one member to tag."); return; }
    setError("");
    setUploading(true);

    try {
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      const uploadedPhotoIds = [];

      for (const file of files) {
        const path = `${crypto.randomUUID()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("member-photos").upload(path, file);
        if (uploadErr) throw uploadErr;

        const { data: photoRow, error: insertErr } = await supabase
          .from("photos")
          .insert({ storage_path: path, caption, expires_at: expiresAt })
          .select()
          .single();
        if (insertErr) throw insertErr;

        const tagRows = selectedIds.map((memberId) => ({ photo_id: photoRow.id, member_id: memberId }));
        const { error: tagErr } = await supabase.from("photo_tags").insert(tagRows);
        if (tagErr) throw tagErr;

        uploadedPhotoIds.push(photoRow.id);
      }

      // Trigger the actual email send (server-side, uses Resend)
      await callFunction("send-photo-email", { memberIds: selectedIds, photoCount: files.length, expiresAt }, session.access_token);

      setRecentUploads([...uploadedPhotoIds, ...recentUploads]);
      onSent();
      setFiles([]); setCaption(""); setSelectedIds([]); setExpiryDays(7); setTagSearch("");
    } catch (e) {
      setError(e.message || "Something went wrong.");
    }
    setUploading(false);
  }

  const filteredMembers = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.member_number.toLowerCase().includes(q));
  }, [members, tagSearch]);

  return (
    <div>
      <div style={{ ...cardStyle, marginBottom: "24px" }}>
        <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px", display: "flex", alignItems: "center", gap: 6 }}><Upload size={14} /> Upload & tag photos</div>
        <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ marginBottom: "12px", fontSize: "13px", color: "var(--paper)" }} />
        {files.length > 0 && <p style={{ fontSize: "11px", color: "var(--fog)", marginBottom: "12px" }}>{files.length} photo(s) selected — all will be tagged to the same member(s) below.</p>}
        <input placeholder="Caption (optional, applies to all)" value={caption} onChange={(e) => setCaption(e.target.value)} style={{ ...inputStyle, marginBottom: "12px" }} />
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "6px" }}>Tag member(s)</div>
          <div style={{ position: "relative", marginBottom: "8px" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fog)" }} />
            <input placeholder="Search by name or ID" value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: "30px" }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", maxHeight: "140px", overflowY: "auto" }}>
            {filteredMembers.map((m) => (
              <button key={m.id} onClick={() => toggleMember(m.id)} style={{ ...btnGhost, background: selectedIds.includes(m.id) ? "var(--lilac)" : "transparent", color: selectedIds.includes(m.id) ? "#1c1730" : "var(--paper)", fontSize: "12px" }}>{m.member_number} · {m.name}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <span style={{ fontSize: "12px", color: "var(--fog)" }}>Available for</span>
          <input type="number" min="1" value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value) || 1)} style={{ ...inputStyle, width: "70px" }} />
          <span style={{ fontSize: "12px", color: "var(--fog)" }}>days</span>
        </div>
        {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
        <button onClick={upload} disabled={uploading} style={{ ...btnGold, opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Uploading & sending…" : <><Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Add {files.length > 1 ? `${files.length} photos` : "photo"} & notify</>}
        </button>
        <p style={{ fontSize: "11px", color: "var(--fog)", marginTop: "10px" }}>
          <Mail size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
          Each tagged member with email notifications on gets a real email via Resend.
        </p>
      </div>
    </div>
  );
}

function AdminMembers({ session, members, onChanged }) {
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newMemberNumber, setNewMemberNumber] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  async function addMember() {
    if (!newName.trim() || !newEmail.trim() || !newMemberNumber.trim() || !newPassword.trim()) {
      setError("Fill in all fields.");
      return;
    }
    setError("");
    setCreating(true);
    try {
      await callFunction(
        "create-member",
        { name: newName.trim(), email: newEmail.trim().toLowerCase(), memberNumber: newMemberNumber.trim().toUpperCase(), password: newPassword.trim() },
        session.access_token
      );
      setNewName(""); setNewEmail(""); setNewMemberNumber(""); setNewPassword("");
      onChanged();
    } catch (e) {
      setError(e.message || "Failed to create member.");
    }
    setCreating(false);
  }

  async function removeMember(id) {
    await supabase.from("members").delete().eq("id", id);
    onChanged();
  }

  async function toggleNotify(m) {
    await supabase.from("members").update({ notify_by_email: !(m.notify_by_email !== false) }).eq("id", m.id);
    onChanged();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.member_number.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [members, search]);

  return (
    <div>
      <div style={{ ...cardStyle, display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "16px" }}>
        <div style={{ flex: "1 1 130px" }}>
          <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Member ID</div>
          <input value={newMemberNumber} onChange={(e) => setNewMemberNumber(e.target.value)} placeholder="VIP-1004" style={inputStyle} />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Name</div>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" style={inputStyle} />
        </div>
        <div style={{ flex: "1 1 170px" }}>
          <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Email</div>
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" style={inputStyle} />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Temp. password</div>
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password" style={inputStyle} />
        </div>
        <button onClick={addMember} disabled={creating} style={btnGold}><Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{creating ? "Adding…" : "Add"}</button>
      </div>
      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}

      <div style={{ position: "relative", marginBottom: "14px" }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fog)" }} />
        <input placeholder="Search members by name, ID, or email" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: "34px" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map((m) => (
          <div key={m.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "13px" }}>{m.name}</div>
              <div style={{ fontSize: "12px", color: "var(--fog)" }}>{m.member_number} · {m.email}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button onClick={() => toggleNotify(m)} style={{ ...btnGhost, fontSize: "11px", display: "flex", alignItems: "center", gap: 4, color: m.notify_by_email !== false ? "var(--success)" : "var(--fog)" }}>
                {m.notify_by_email !== false ? <Bell size={12} /> : <BellOff size={12} />}
                {m.notify_by_email !== false ? "Notifies" : "Muted"}
              </button>
              <button onClick={() => removeMember(m.id)} style={{ ...btnGhost, fontSize: "11px" }}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p style={{ fontSize: "13px", color: "var(--fog)", fontStyle: "italic" }}>No members match that search.</p>}
      </div>
    </div>
  );
}

function AdminEvents({ events, onChanged }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");

  async function addEvent() {
    if (!title.trim() || !date) { setError("Enter a title and date."); return; }
    setError("");
    await supabase.from("events").insert({ title: title.trim(), event_date: date, detail: detail.trim() });
    setTitle(""); setDate(""); setDetail("");
    onChanged();
  }
  async function removeEvent(id) {
    await supabase.from("events").delete().eq("id", id);
    onChanged();
  }

  return (
    <div>
      <div style={{ ...cardStyle, marginBottom: "20px" }}>
        <input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
        <input placeholder="Detail (optional)" value={detail} onChange={(e) => setDetail(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
        {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
        <button onClick={addEvent} style={btnGold}><Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Add event</button>
      </div>
      {events.map((ev) => (
        <div key={ev.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px" }}>{ev.title}</div>
            <div style={{ fontSize: "12px", color: "var(--fog)" }}>{formatDate(ev.event_date)}{!isUpcoming(ev.event_date) ? " · past" : ""}</div>
            <div style={{ fontSize: "12px", color: "var(--paper)" }}>{ev.detail}</div>
          </div>
          <button onClick={() => removeEvent(ev.id)} style={{ ...btnGhost, fontSize: "11px" }}><Trash2 size={12} /></button>
        </div>
      ))}
    </div>
  );
}

function AdminNotifications({ notifications }) {
  return (
    <div>
      <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "16px" }}>Email notification log</div>
      {notifications.length === 0 && (
        <p style={{ color: "var(--fog)", fontSize: "13px", fontStyle: "italic" }}>No notifications sent yet.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {notifications.map((n) => (
          <details key={n.id} style={cardStyle}>
            <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={13} color="var(--success)" /><span style={{ color: "var(--fog)", fontWeight: 400 }}>{n.to_email}</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--fog)", marginTop: 4 }}>{n.subject}</div>
              </div>
              <span style={{ fontSize: "11px", color: "var(--fog)", whiteSpace: "nowrap", marginLeft: 12 }}>
                {new Date(n.sent_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </summary>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "12px", color: "var(--paper)", marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>{n.body}</pre>
          </details>
        ))}
      </div>
    </div>
  );
}
