import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  Lock, Upload, Download, Plus, Trash2, LogOut, Shield, Clock,
  Image as ImageIcon, Mail, CheckCircle2, Search, Calendar,
  Settings, ArrowLeft, DownloadCloud, BellOff, Bell, Tag,
  AlertTriangle, Check, X, RefreshCw, ImageOff, BarChart3, Award,
  PackageSearch,
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

// A ledger row credits the balance (earn, manual add) or debits it (redeem,
// manual subtract) — unless it's been reversed, in which case it no longer
// counts either way.
function pointsLedgerBalance(ledger) {
  return (ledger || []).reduce((sum, row) => {
    if (row.reversed) return sum;
    const isCredit = row.kind === "earn" || row.kind === "adjust_add";
    return sum + (isCredit ? row.points : -row.points);
  }, 0);
}
const LEDGER_KIND_LABELS = {
  earn: "Earned",
  redeem: "Redeemed",
  adjust_add: "Adjusted +",
  adjust_subtract: "Adjusted -",
};
function isDebitKind(kind) {
  return kind === "redeem" || kind === "adjust_subtract";
}

// Downloads an image reliably on desktop, Android, and iOS Safari.
// A plain <a href download> often gets ignored on mobile when the URL is
// cross-origin (Supabase Storage signed URLs), so we fetch the bytes as a
// blob first. On iOS, a forced blob download lands in the Files app rather
// than Photos, so we prefer the Web Share API there when it supports files
// — that opens the native share sheet with a "Save Image" option that goes
// straight to the camera roll.
async function savePhotoToDevice(url, filename) {
  const response = await fetch(url);
  const blob = await response.blob();

  if (navigator.canShare && navigator.share) {
    const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
        // Fall through to the blob-download method below.
      }
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
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
  const [staffRole, setStaffRole] = useState(null); // 'bartender' | 'manager' | 'admin' | null
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
      setStaffRole(null);
      setMemberProfile(null);
      return;
    }
    (async () => {
      const { data: staffRow } = await supabase.from("staff").select("id, role").eq("id", session.user.id).maybeSingle();
      setIsStaff(!!staffRow);
      setStaffRole(staffRow?.role || null);

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

      {mode === "admin" && session && isStaff && <AdminPanel session={session} staffRole={staffRole} />}

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
  const [showClaim, setShowClaim] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [clubFilter, setClubFilter] = useState("all");
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
    supabase
      .from("clubs")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setClubs(data || []));
  }, [loadPhotos]);

  const clubName = useCallback(
    (id) => clubs.find((c) => c.id === id)?.name || "",
    [clubs]
  );

  const distinctPhotoClubIds = useMemo(
    () => [...new Set(photos.map((p) => p.club_id).filter(Boolean))],
    [photos]
  );
  const showClubFilter = clubs.length > 1 && distinctPhotoClubIds.length > 1;
  const visiblePhotos = showClubFilter && clubFilter !== "all"
    ? photos.filter((p) => p.club_id === clubFilter)
    : photos;

  const upcomingEvents = events.filter((ev) => isUpcoming(ev.event_date)).sort((a, b) => a.event_date.localeCompare(b.event_date));

  async function downloadAll() {
    for (let i = 0; i < visiblePhotos.length; i++) {
      const p = visiblePhotos[i];
      const filename = p.caption ? `${p.caption.replace(/\s+/g, "-")}.jpg` : `voyeur-photo-${i + 1}.jpg`;
      try {
        await savePhotoToDevice(p.signedUrl, filename);
      } catch (err) {
        console.error("Failed to save photo", err);
      }
      await new Promise((r) => setTimeout(r, 400));
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

      <div style={{ display: "flex", gap: "10px", marginBottom: showSettings || showClaim || showRewards ? "0" : "16px" }}>
        <button onClick={() => setShowClaim(!showClaim)} style={{ ...btnGold, flex: 1, marginBottom: showClaim ? "20px" : "16px" }}>
          <Tag size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{showClaim ? "Close claim form" : "Claim a photo"}
        </button>
        <button onClick={() => setShowRewards(!showRewards)} style={{ ...btnGhost, flex: 1, marginBottom: showRewards ? "20px" : "16px" }}>
          <Award size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{showRewards ? "Close rewards" : "Rewards"}
        </button>
      </div>

      {showClaim && <ClaimPhotoForm member={member} clubs={clubs} />}

      {showRewards && <RewardsView member={member} clubs={clubs} />}

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
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{ev.title}{clubs.length > 1 && ev.club_id && (
                  <span style={{ marginLeft: 8, fontSize: "10px", fontWeight: 600, color: "var(--lilac)", border: "1px solid var(--border-strong)", borderRadius: "4px", padding: "2px 6px", verticalAlign: 2 }}>{clubName(ev.club_id)}</span>
                )}</div>
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
        {visiblePhotos.length > 0 && (
          <button onClick={downloadAll} style={{ ...btnGold, padding: "7px 14px", fontSize: "12px" }}>
            <DownloadCloud size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Download all ({visiblePhotos.length})
          </button>
        )}
      </div>
      {showClubFilter && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
          <button onClick={() => setClubFilter("all")} style={{ ...btnGhost, fontSize: "12px", background: clubFilter === "all" ? "var(--panel-2)" : "transparent" }}>All</button>
          {distinctPhotoClubIds.map((id) => (
            <button key={id} onClick={() => setClubFilter(id)} style={{ ...btnGhost, fontSize: "12px", background: clubFilter === id ? "var(--panel-2)" : "transparent" }}>{clubName(id)}</button>
          ))}
        </div>
      )}
      {loadingPhotos && <p style={{ color: "var(--fog)", fontSize: "13px" }}>Loading your photos…</p>}
      {!loadingPhotos && visiblePhotos.length === 0 && <p style={{ color: "var(--fog)", fontSize: "13px", fontStyle: "italic" }}>No photos are ready for you yet. Check back after your next visit.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
        {visiblePhotos.map((p) => (
          <div key={p.id} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <img src={p.signedUrl} alt={p.caption || "Club photo"} style={{ width: "100%", height: "120px", objectFit: "cover", display: "block" }} />
            <div style={{ padding: "10px" }}>
              <div style={{ fontSize: "12px", color: "var(--paper)", marginBottom: "6px" }}>{p.caption || "Untitled"}{clubs.length > 1 && p.club_id && (
                <span style={{ marginLeft: 6, fontSize: "10px", fontWeight: 600, color: "var(--lilac)", border: "1px solid var(--border-strong)", borderRadius: "4px", padding: "2px 6px" }}>{clubName(p.club_id)}</span>
              )}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--error)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={11} /> {daysLeft(p.expires_at)}d left
                </span>
                <button
                  onClick={() => savePhotoToDevice(p.signedUrl, p.caption ? `${p.caption.replace(/\s+/g, "-")}.jpg` : `voyeur-photo-${p.id}.jpg`)}
                  style={{ ...btnGold, padding: "5px 10px", fontSize: "11px", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, border: "none" }}
                >
                  <Download size={12} /> Save
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClaimPhotoForm({ member, clubs }) {
  const [clubId, setClubId] = useState("");
  const [tag, setTag] = useState("");
  const [confirmTag, setConfirmTag] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myClaims, setMyClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(true);

  useEffect(() => {
    if (clubs && clubs.length > 0 && !clubId) setClubId(clubs[0].id);
  }, [clubs, clubId]);

  const loadMyClaims = useCallback(async () => {
    setLoadingClaims(true);
    const { data } = await supabase
      .from("photo_claims")
      .select("*")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setMyClaims(data || []);
    setLoadingClaims(false);
  }, [member.id]);

  useEffect(() => { loadMyClaims(); }, [loadMyClaims]);

  const clubName = useCallback(
    (id) => (clubs || []).find((c) => c.id === id)?.name || "",
    [clubs]
  );

  async function submitClaim() {
    setError(""); setSuccess("");
    if (!tag.trim() || !confirmTag.trim()) { setError("Enter the photo number, then type it again to confirm."); return; }
    if (tag.trim() !== confirmTag.trim()) { setError("Those two numbers don't match — try again."); return; }
    if (clubs && clubs.length > 1 && !clubId) { setError("Choose which club this photo is from."); return; }
    setSubmitting(true);
    try {
      const { data: existingFulfilled } = await supabase
        .from("photo_claims")
        .select("id")
        .eq("club_id", clubId || null)
        .eq("photo_tag", tag.trim())
        .eq("status", "fulfilled")
        .limit(1);
      const isLate = existingFulfilled && existingFulfilled.length > 0;

      const { error: insErr } = await supabase.from("photo_claims").insert({
        member_id: member.id,
        club_id: clubId || null,
        photo_tag: tag.trim(),
        status: isLate ? "needs_review" : "pending",
      });
      if (insErr) throw insErr;

      setSuccess(
        isLate
          ? "Claim submitted. That photo was already sent out, so this one needs a quick check on our end before it goes to you."
          : "Claim submitted! You'll get the photo once it's edited and uploaded."
      );
      setTag(""); setConfirmTag("");
      loadMyClaims();
    } catch (e) {
      setError(e.message || "Something went wrong.");
    }
    setSubmitting(false);
  }

  function statusLabel(status) {
    if (status === "fulfilled") return { text: "Delivered", color: "var(--lilac)" };
    if (status === "denied") return { text: "Denied", color: "var(--error)" };
    if (status === "needs_review") return { text: "Under review", color: "var(--fog)" };
    return { text: "Pending", color: "var(--fog)" };
  }

  return (
    <div style={{ ...cardStyle, marginBottom: "20px" }}>
      <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px", display: "flex", alignItems: "center", gap: 6 }}>
        <Tag size={14} /> Claim a photo
      </div>
      <p style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "14px" }}>
        Enter the number shown on the photo when it was taken, then confirm it below.
      </p>

      {clubs && clubs.length > 1 && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          {clubs.map((c) => (
            <button
              key={c.id}
              onClick={() => setClubId(c.id)}
              style={{ ...btnGhost, flex: 1, background: clubId === c.id ? "var(--lilac)" : "transparent", color: clubId === c.id ? "#1c1730" : "var(--paper)" }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <input placeholder="Photo number" value={tag} onChange={(e) => setTag(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
      <input placeholder="Confirm photo number" value={confirmTag} onChange={(e) => setConfirmTag(e.target.value)} style={{ ...inputStyle, marginBottom: "12px" }} />

      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
      {success && <p style={{ color: "var(--lilac)", fontSize: "13px", marginBottom: "10px" }}>{success}</p>}

      <button onClick={submitClaim} disabled={submitting} style={{ ...btnGold, opacity: submitting ? 0.6 : 1, width: "100%" }}>
        {submitting ? "Submitting…" : "Submit claim"}
      </button>

      {!loadingClaims && myClaims.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <div style={{ fontSize: "11px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Your recent claims</div>
          {myClaims.map((c) => {
            const s = statusLabel(c.status);
            return (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span>
                  #{c.photo_tag}{clubs.length > 1 && c.club_id ? ` · ${clubName(c.club_id)}` : ""}
                </span>
                <span style={{ color: s.color, fontWeight: 600 }}>{s.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RewardsView({ member, clubs }) {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      const { data, error: e } = await supabase
        .from("points_ledger")
        .select("*")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false });
      if (e) setError(e.message);
      setLedger(data || []);
      setLoading(false);
    })();
  }, [member.id]);

  function clubName(id) {
    return (clubs || []).find((c) => c.id === id)?.name || "";
  }

  const balance = useMemo(() => pointsLedgerBalance(ledger), [ledger]);

  return (
    <div style={{ ...cardStyle, marginBottom: "20px" }}>
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
        <div style={{ fontSize: "40px", fontWeight: 700, color: "var(--lilac)" }}>{loading ? "…" : balance}</div>
        <div style={{ fontSize: "12px", color: "var(--fog)", marginTop: "4px" }}>points balance</div>
      </div>
      <p style={{ fontSize: "12px", color: "var(--fog)", textAlign: "center", marginBottom: "20px" }}>
        Show this screen to staff at the bar to redeem your points.
      </p>

      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
      {!loading && ledger.length === 0 && <p style={{ color: "var(--fog)", fontSize: "13px", fontStyle: "italic" }}>No points activity yet.</p>}
      {ledger.map((row) => (
        <div key={row.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", padding: "8px 0", borderBottom: "1px solid var(--border)", opacity: row.reversed ? 0.5 : 1 }}>
          <span>
            {formatDate(row.created_at)}{clubs && clubs.length > 1 && row.club_id ? ` · ${clubName(row.club_id)}` : ""}
            {row.note ? ` · ${row.note}` : ""}
            {row.reversed ? " · Reversed" : ""}
          </span>
          <span style={{ fontWeight: 600, color: isDebitKind(row.kind) ? "var(--paper)" : "var(--lilac)", textDecoration: row.reversed ? "line-through" : "none" }}>
            {isDebitKind(row.kind) ? "-" : "+"}{row.points}
          </span>
        </div>
      ))}
    </div>
  );
}

function AccountSettings({ member, onMemberUpdated }) {
  const [email, setEmail] = useState(member.email);
  const [phone, setPhone] = useState(member.phone || "");
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
      .update({ notify_by_email: notifyByEmail, email: email.trim().toLowerCase(), phone: phone.trim() || null })
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
          <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Phone number</div>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" style={inputStyle} />
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

function CountBadge({ count }) {
  if (!count) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "16px", height: "16px", padding: "0 4px", marginLeft: "6px", borderRadius: "999px", background: "var(--error)", color: "#fff", fontSize: "10px", fontWeight: 700, verticalAlign: 2 }}>
      {count}
    </span>
  );
}

function AdminPanel({ session, staffRole }) {
  const canManage = staffRole === "manager" || staffRole === "admin"; // manager or admin
  const isAdmin = staffRole === "admin";
  const [tab, setTab] = useState(() => (staffRole === "bartender" ? "rewards" : "analytics"));
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [claims, setClaims] = useState([]);
  const [lostItems, setLostItems] = useState([]);
  const [notifSeenAt, setNotifSeenAt] = useState(() => localStorage.getItem("voyeur_notif_seen_at") || "1970-01-01T00:00:00.000Z");
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
  const loadClubs = useCallback(async () => {
    const { data } = await supabase.from("clubs").select("*").order("sort_order");
    setClubs(data || []);
  }, []);
  const loadClaims = useCallback(async () => {
    const { data } = await supabase.from("photo_claims").select("*").order("created_at", { ascending: false });
    setClaims(data || []);
  }, []);
  const loadLostItems = useCallback(async () => {
    const { data } = await supabase.from("lost_items").select("*").order("created_at", { ascending: false });
    setLostItems(data || []);
  }, []);
  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from("staff").select("*").order("created_at");
    setStaffList(data || []);
  }, []);

  useEffect(() => {
    // Members and clubs are needed by every role (the Rewards tab's member
    // search). Everything else here only backs tabs that are manager/admin
    // only, so bartenders skip those reads entirely.
    loadMembers();
    loadClubs();
    if (canManage) {
      loadEvents();
      loadNotifications();
      loadClaims();
      loadLostItems();
      loadStaff();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMembers, loadClubs, canManage, loadEvents, loadNotifications, loadClaims, loadLostItems, loadStaff]);

  function updateLostItem(updated) {
    setLostItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  }

  const needsReviewCount = claims.filter((c) => c.status === "needs_review").length;
  const unresolvedClaimsCount = claims.filter((c) => c.status === "needs_review" || c.status === "pending").length;
  const unseenNotifCount = notifications.filter((n) => n.sent_at > notifSeenAt).length;
  const pendingLostCount = lostItems.filter((it) => it.status === "pending").length;

  function openNotifications() {
    setTab("notifications");
    const now = new Date().toISOString();
    localStorage.setItem("voyeur_notif_seen_at", now);
    setNotifSeenAt(now);
  }

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {canManage && (
          <button onClick={() => setTab("analytics")} style={{ ...btnGhost, background: tab === "analytics" ? "var(--panel-2)" : "transparent" }}>
            <BarChart3 size={12} style={{ marginRight: 6, verticalAlign: -2 }} />Analytics
          </button>
        )}
        {canManage && (
          <button onClick={() => setTab("members")} style={{ ...btnGhost, background: tab === "members" ? "var(--panel-2)" : "transparent" }}>Members</button>
        )}
        {canManage && (
          <button onClick={() => setTab("events")} style={{ ...btnGhost, background: tab === "events" ? "var(--panel-2)" : "transparent" }}>Events</button>
        )}
        <button onClick={() => setTab("rewards")} style={{ ...btnGhost, background: tab === "rewards" ? "var(--panel-2)" : "transparent" }}>
          <Award size={12} style={{ marginRight: 6, verticalAlign: -2 }} />Rewards
        </button>
        {canManage && (
          <button onClick={() => setTab("photos")} style={{ ...btnGhost, background: tab === "photos" ? "var(--panel-2)" : "transparent" }}>Photos</button>
        )}
        {canManage && (
          <button onClick={() => setTab("claims")} style={{ ...btnGhost, background: tab === "claims" ? "var(--panel-2)" : "transparent" }}>
            <Tag size={12} style={{ marginRight: 6, verticalAlign: -2 }} />Claims<CountBadge count={unresolvedClaimsCount} />
          </button>
        )}
        {canManage && (
          <button onClick={() => setTab("lostfound")} style={{ ...btnGhost, background: tab === "lostfound" ? "var(--panel-2)" : "transparent" }}>
            <PackageSearch size={12} style={{ marginRight: 6, verticalAlign: -2 }} />Lost &amp; Found<CountBadge count={pendingLostCount} />
          </button>
        )}
        {canManage && (
          <button onClick={() => setTab("unmatched")} style={{ ...btnGhost, background: tab === "unmatched" ? "var(--panel-2)" : "transparent" }}>
            <ImageOff size={12} style={{ marginRight: 6, verticalAlign: -2 }} />Unmatched
          </button>
        )}
        {canManage && (
          <button onClick={() => setTab("gallery")} style={{ ...btnGhost, background: tab === "gallery" ? "var(--panel-2)" : "transparent" }}>Gallery</button>
        )}
        {isAdmin && (
          <button onClick={() => setTab("site")} style={{ ...btnGhost, background: tab === "site" ? "var(--panel-2)" : "transparent" }}>Site content</button>
        )}
        {isAdmin && (
          <button onClick={() => setTab("pages")} style={{ ...btnGhost, background: tab === "pages" ? "var(--panel-2)" : "transparent" }}>Pages</button>
        )}
        {canManage && (
          <button onClick={() => setTab("staff")} style={{ ...btnGhost, background: tab === "staff" ? "var(--panel-2)" : "transparent" }}>
            <Shield size={12} style={{ marginRight: 6, verticalAlign: -2 }} />Staff
          </button>
        )}
        {canManage && (
          <button onClick={openNotifications} style={{ ...btnGhost, background: tab === "notifications" ? "var(--panel-2)" : "transparent" }}>
            <Mail size={12} style={{ marginRight: 6, verticalAlign: -2 }} />Notifications<CountBadge count={unseenNotifCount} />
          </button>
        )}
      </div>

      {tab === "analytics" && canManage && <AnalyticsDashboard />}
      {tab === "photos" && canManage && <AdminPhotos session={session} members={members} clubs={clubs} onSent={loadNotifications} onClaimsChanged={loadClaims} />}
      {tab === "members" && canManage && <AdminMembers session={session} members={members} onChanged={loadMembers} />}
      {tab === "events" && canManage && <AdminEvents events={events} clubs={clubs} onChanged={loadEvents} session={session} />}
      {tab === "rewards" && <AdminRewards session={session} members={members} clubs={clubs} canManage={canManage} />}
      {tab === "staff" && canManage && <AdminStaff session={session} staffList={staffList} viewerRole={staffRole} viewerId={session.user.id} onChanged={loadStaff} />}
      {tab === "claims" && canManage && <AdminClaims claims={claims} members={members} clubs={clubs} onChanged={loadClaims} />}
      {tab === "lostfound" && canManage && <AdminLostFound items={lostItems} clubs={clubs} session={session} onItemChanged={updateLostItem} />}
      {tab === "unmatched" && canManage && <AdminUnmatchedPhotos session={session} members={members} clubs={clubs} />}
      {tab === "site" && isAdmin && <AdminSiteContent />}
      {tab === "gallery" && canManage && <AdminGallery />}
      {tab === "pages" && isAdmin && <AdminPages />}
      {tab === "notifications" && canManage && <AdminNotifications notifications={notifications} />}
    </div>
  );
}

function AdminPhotos({ session, members, clubs, onSent, onClaimsChanged }) {
  const [files, setFiles] = useState([]); // File objects
  const [caption, setCaption] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [expiryDays, setExpiryDays] = useState(7);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [recentUploads, setRecentUploads] = useState([]);
  const [clubId, setClubId] = useState("");
  const [tagLookup, setTagLookup] = useState("");
  const [matchedClaims, setMatchedClaims] = useState([]);
  const [confirmedClaimIds, setConfirmedClaimIds] = useState([]);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupError, setLookupError] = useState("");

  useEffect(() => {
    if (clubs && clubs.length > 0 && !clubId) setClubId(clubs[0].id);
  }, [clubs, clubId]);

  function memberName(id) {
    return members.find((m) => m.id === id)?.name || "Unknown member";
  }

  async function lookupTag() {
    setLookupError(""); setLookupDone(false); setMatchedClaims([]); setConfirmedClaimIds([]);
    if (!tagLookup.trim()) { setLookupError("Enter a photo number first."); return; }
    const { data, error: e } = await supabase
      .from("photo_claims")
      .select("*")
      .eq("club_id", clubId || null)
      .eq("photo_tag", tagLookup.trim())
      .eq("status", "pending");
    if (e) { setLookupError(e.message); return; }
    setMatchedClaims(data || []);
    setLookupDone(true);
    if ((data || []).length === 1) {
      const claim = data[0];
      setSelectedIds((prev) => (prev.includes(claim.member_id) ? prev : [...prev, claim.member_id]));
      setConfirmedClaimIds([claim.id]);
    }
  }

  function confirmAllMatches() {
    const ids = matchedClaims.map((c) => c.member_id);
    setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
    setConfirmedClaimIds(matchedClaims.map((c) => c.id));
  }

  function cancelMatches() {
    setMatchedClaims([]);
    setConfirmedClaimIds([]);
    setLookupDone(false);
    setTagLookup("");
  }

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
          .insert({ storage_path: path, caption, expires_at: expiresAt, club_id: clubId || null })
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

      // Mark any matched claims as fulfilled, tied to the first uploaded photo
      if (confirmedClaimIds.length > 0 && uploadedPhotoIds.length > 0) {
        await supabase
          .from("photo_claims")
          .update({ status: "fulfilled", matched_photo_id: uploadedPhotoIds[0] })
          .in("id", confirmedClaimIds);
        if (onClaimsChanged) onClaimsChanged();
      }

      setRecentUploads([...uploadedPhotoIds, ...recentUploads]);
      onSent();
      setFiles([]); setCaption(""); setSelectedIds([]); setExpiryDays(7); setTagSearch("");
      setTagLookup(""); setMatchedClaims([]); setConfirmedClaimIds([]); setLookupDone(false);
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
        {clubs && clubs.length > 1 && (
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "6px" }}>Which club is this from?</div>
            <select value={clubId} onChange={(e) => setClubId(e.target.value)} style={inputStyle}>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ marginBottom: "12px", fontSize: "13px", color: "var(--paper)" }} />
        {files.length > 0 && <p style={{ fontSize: "11px", color: "var(--fog)", marginBottom: "12px" }}>{files.length} photo(s) selected — all will be tagged to the same member(s) below.</p>}
        <input placeholder="Caption (optional, applies to all)" value={caption} onChange={(e) => setCaption(e.target.value)} style={{ ...inputStyle, marginBottom: "12px" }} />

        <div style={{ ...cardStyle, background: "var(--panel-2)", marginBottom: "14px" }}>
          <div style={{ fontSize: "12px", color: "var(--lilac)", marginBottom: "8px", display: "flex", alignItems: "center", gap: 6 }}><Tag size={13} /> Match by photo number (optional)</div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input placeholder="Photo number, e.g. 3137" value={tagLookup} onChange={(e) => setTagLookup(e.target.value)} style={inputStyle} />
            <button onClick={lookupTag} style={{ ...btnGhost, whiteSpace: "nowrap" }}>Look up</button>
          </div>
          {lookupError && <p style={{ color: "var(--error)", fontSize: "12px" }}>{lookupError}</p>}
          {lookupDone && matchedClaims.length === 0 && (
            <p style={{ fontSize: "12px", color: "var(--fog)", fontStyle: "italic" }}>No pending claims for this number yet — tag members manually below if needed.</p>
          )}
          {lookupDone && matchedClaims.length === 1 && confirmedClaimIds.length > 0 && (
            <p style={{ fontSize: "12px", color: "var(--lilac)" }}>
              <CheckCircle2 size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
              Matched to {memberName(matchedClaims[0].member_id)} — added below.
            </p>
          )}
          {lookupDone && matchedClaims.length > 1 && confirmedClaimIds.length === 0 && (
            <div>
              <p style={{ fontSize: "12px", color: "var(--paper)", marginBottom: "8px", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={13} style={{ color: "var(--error)" }} /> This number has {matchedClaims.length} claims:
              </p>
              <ul style={{ margin: "0 0 10px", paddingLeft: "18px", fontSize: "12px", color: "var(--paper)" }}>
                {matchedClaims.map((c) => <li key={c.id}>{memberName(c.member_id)}</li>)}
              </ul>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={confirmAllMatches} style={{ ...btnGold, padding: "6px 12px", fontSize: "12px" }}><Check size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Send to all</button>
                <button onClick={cancelMatches} style={{ ...btnGhost, padding: "6px 12px", fontSize: "12px" }}><X size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Cancel</button>
              </div>
            </div>
          )}
          {lookupDone && matchedClaims.length > 1 && confirmedClaimIds.length > 0 && (
            <p style={{ fontSize: "12px", color: "var(--lilac)" }}>
              <CheckCircle2 size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
              Sending to all {confirmedClaimIds.length} — added below.
            </p>
          )}
        </div>

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
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [editingPhoneId, setEditingPhoneId] = useState(null);
  const [phoneDraft, setPhoneDraft] = useState("");

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
        { name: newName.trim(), email: newEmail.trim().toLowerCase(), memberNumber: newMemberNumber.trim().toUpperCase(), password: newPassword.trim(), phone: newPhone.trim() },
        session.access_token
      );
      setNewName(""); setNewEmail(""); setNewMemberNumber(""); setNewPassword(""); setNewPhone("");
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

  function startEditPhone(m) {
    setEditingPhoneId(m.id);
    setPhoneDraft(m.phone || "");
  }

  async function savePhone(m) {
    await supabase.from("members").update({ phone: phoneDraft.trim() || null }).eq("id", m.id);
    setEditingPhoneId(null);
    onChanged();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.member_number.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [members, search]);

    return (
    <div>
      <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px" }}>
        {members.length} current member{members.length === 1 ? "" : "s"}
      </div>
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
        <div style={{ flex: "1 1 130px" }}>
          <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Phone</div>
          <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(555) 555-5555" style={inputStyle} />
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
              {editingPhoneId === m.id ? (
                <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                  <input
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder="(555) 555-5555"
                    style={{ ...inputStyle, padding: "5px 8px", fontSize: "12px", width: "150px" }}
                  />
                  <button onClick={() => savePhone(m)} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px" }}>Save</button>
                  <button onClick={() => setEditingPhoneId(null)} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px" }}>Cancel</button>
                </div>
              ) : (
                <div
                  onClick={() => startEditPhone(m)}
                  style={{ fontSize: "12px", color: m.phone ? "var(--paper)" : "var(--fog)", fontStyle: m.phone ? "normal" : "italic", marginTop: "4px", cursor: "pointer", textDecoration: "underline dotted" }}
                >
                  {m.phone || "Add phone number"}
                </div>
              )}
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

function AdminEvents({ events, clubs, onChanged, session }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [detail, setDetail] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState("");
  const [notifyStatus, setNotifyStatus] = useState("");
  const [clubId, setClubId] = useState("");

  useEffect(() => {
    if (clubs && clubs.length > 0 && !clubId) setClubId(clubs[0].id);
  }, [clubs, clubId]);

  const clubName = useCallback(
    (id) => (clubs || []).find((c) => c.id === id)?.name || "",
    [clubs]
  );

  async function addEvent() {
    if (!title.trim() || !date) { setError("Enter a title and date."); return; }
    setError(""); setNotifyStatus("");
    await supabase.from("events").insert({ title: title.trim(), event_date: date, detail: detail.trim(), club_id: clubId || null });

    if (notify) {
      setNotifyStatus("Emailing members…");
      try {
        const result = await callFunction(
          "notify-new-event",
          { title: title.trim(), eventDate: date, detail: detail.trim() },
          session.access_token
        );
        setNotifyStatus(`Emailed ${result.sent?.length || 0} member${result.sent?.length === 1 ? "" : "s"}.`);
      } catch (e) {
        setNotifyStatus("Event added, but emailing members failed: " + e.message);
      }
    }

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
        {clubs && clubs.length > 1 && (
          <div style={{ marginBottom: "10px" }}>
            <div style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "6px" }}>Which club is this event for?</div>
            <select value={clubId} onChange={(e) => setClubId(e.target.value)} style={inputStyle}>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
        <input placeholder="Detail (optional)" value={detail} onChange={(e) => setDetail(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--paper)", marginBottom: "10px", cursor: "pointer" }}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Email members who get notifications when this event is added
        </label>
        {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
        {notifyStatus && <p style={{ color: "var(--fog)", fontSize: "13px", marginBottom: "10px" }}>{notifyStatus}</p>}
        <button onClick={addEvent} style={btnGold}><Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Add event</button>
      </div>
      {events.map((ev) => (
        <div key={ev.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px" }}>{ev.title}{clubs && clubs.length > 1 && ev.club_id && (
              <span style={{ marginLeft: 8, fontSize: "10px", fontWeight: 600, color: "var(--lilac)", border: "1px solid var(--border-strong)", borderRadius: "4px", padding: "2px 6px", verticalAlign: 2 }}>{clubName(ev.club_id)}</span>
            )}</div>
            <div style={{ fontSize: "12px", color: "var(--fog)" }}>{formatDate(ev.event_date)}{!isUpcoming(ev.event_date) ? " · past" : ""}</div>
            <div style={{ fontSize: "12px", color: "var(--paper)" }}>{ev.detail}</div>
          </div>
          <button onClick={() => removeEvent(ev.id)} style={{ ...btnGhost, fontSize: "11px" }}><Trash2 size={12} /></button>
        </div>
      ))}
    </div>
  );
}

function AdminRewards({ session, members, clubs, canManage }) {
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [error, setError] = useState("");

  const [earnClubId, setEarnClubId] = useState("");
  const [dollarAmount, setDollarAmount] = useState("");
  const [earnBusy, setEarnBusy] = useState(false);

  const [redeemClubId, setRedeemClubId] = useState("");
  const [redeemPoints, setRedeemPoints] = useState("");
  const [redeemNote, setRedeemNote] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState("");

  const [adjustDirection, setAdjustDirection] = useState("add"); // 'add' | 'subtract'
  const [adjustPointsValue, setAdjustPointsValue] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustError, setAdjustError] = useState("");

  const [reversingId, setReversingId] = useState(null);

  useEffect(() => {
    if (clubs && clubs.length > 0 && !earnClubId) setEarnClubId(clubs[0].id);
    if (clubs && clubs.length > 0 && !redeemClubId) setRedeemClubId(clubs[0].id);
  }, [clubs, earnClubId, redeemClubId]);

  function clubName(id) {
    return (clubs || []).find((c) => c.id === id)?.name || "";
  }

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.member_number.toLowerCase().includes(q));
  }, [members, memberSearch]);

  const selectedMember = members.find((m) => m.id === selectedMemberId) || null;

  const balance = useMemo(() => pointsLedgerBalance(ledger), [ledger]);

  const loadLedger = useCallback(async (memberId) => {
    setLoadingLedger(true);
    setError("");
    try {
      const { data, error: e } = await supabase
        .from("points_ledger")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });
      if (e) throw e;
      setLedger(data || []);
    } catch (e) {
      setError(e.message || "Failed to load points history.");
    }
    setLoadingLedger(false);
  }, []);

  function selectMember(id) {
    setSelectedMemberId(id);
    setRedeemError("");
    loadLedger(id);
  }

  async function addPoints() {
    if (!selectedMemberId) return;
    const amount = Number(dollarAmount);
    if (!amount || amount <= 0) { setError("Enter a dollar amount greater than 0."); return; }
    setError("");
    setEarnBusy(true);
    try {
      const { error: e } = await supabase.from("points_ledger").insert({
        member_id: selectedMemberId,
        club_id: earnClubId || null,
        kind: "earn",
        points: Math.round(amount),
        dollar_amount: amount,
        created_by: session.user.id,
      });
      if (e) throw e;
      setDollarAmount("");
      await loadLedger(selectedMemberId);
    } catch (e) {
      setError(e.message || "Failed to add points.");
    }
    setEarnBusy(false);
  }

  async function redeem() {
    if (!selectedMemberId) return;
    const points = Number(redeemPoints);
    if (!points || points <= 0) { setRedeemError("Enter a points amount greater than 0."); return; }
    if (points > balance) { setRedeemError(`This member only has ${balance} points.`); return; }
    setRedeemError("");
    setRedeemBusy(true);
    try {
      const { error: e } = await supabase.from("points_ledger").insert({
        member_id: selectedMemberId,
        club_id: redeemClubId || null,
        kind: "redeem",
        points: Math.round(points),
        note: redeemNote.trim() || null,
        created_by: session.user.id,
      });
      if (e) throw e;
      setRedeemPoints("");
      setRedeemNote("");
      await loadLedger(selectedMemberId);
    } catch (e) {
      setRedeemError(e.message || "Failed to redeem points.");
    }
    setRedeemBusy(false);
  }

  // Manager/admin only: add or subtract points without a purchase behind them
  // (e.g. correcting a mistake, a manager comp). Recorded as its own ledger
  // kind so it's never confused with a real purchase or reward redemption.
  async function submitAdjustment() {
    if (!selectedMemberId) return;
    const points = Number(adjustPointsValue);
    if (!points || points <= 0) { setAdjustError("Enter a points amount greater than 0."); return; }
    if (adjustDirection === "subtract" && points > balance) { setAdjustError(`This member only has ${balance} points.`); return; }
    if (!adjustNote.trim()) { setAdjustError("Add a short reason for this adjustment."); return; }
    setAdjustError("");
    setAdjustBusy(true);
    try {
      const { error: e } = await supabase.from("points_ledger").insert({
        member_id: selectedMemberId,
        club_id: null,
        kind: adjustDirection === "add" ? "adjust_add" : "adjust_subtract",
        points: Math.round(points),
        note: adjustNote.trim(),
        created_by: session.user.id,
      });
      if (e) throw e;
      setAdjustPointsValue("");
      setAdjustNote("");
      await loadLedger(selectedMemberId);
    } catch (e) {
      setAdjustError(e.message || "Failed to adjust points.");
    }
    setAdjustBusy(false);
  }

  // Manager/admin only: reverse a past redemption or manual subtraction.
  // The row stays in the ledger (marked reversed) so the audit trail shows
  // both the original debit and the reversal — nothing is deleted.
  async function reverseRow(row) {
    setReversingId(row.id);
    try {
      const { error: e } = await supabase
        .from("points_ledger")
        .update({ reversed: true, reversed_at: new Date().toISOString(), reversed_by: session.user.id })
        .eq("id", row.id);
      if (e) throw e;
      await loadLedger(selectedMemberId);
    } catch (e) {
      setError(e.message || "Failed to reverse that entry.");
    }
    setReversingId(null);
  }

  return (
    <div>
      <div style={{ ...cardStyle, marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px", display: "flex", alignItems: "center", gap: 6 }}>
          <Award size={14} /> Find a member
        </div>
        <div style={{ position: "relative", marginBottom: "8px" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fog)" }} />
          <input placeholder="Search by name or ID" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: "30px" }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", maxHeight: "140px", overflowY: "auto" }}>
          {filteredMembers.map((m) => (
            <button key={m.id} onClick={() => selectMember(m.id)} style={{ ...btnGhost, background: selectedMemberId === m.id ? "var(--lilac)" : "transparent", color: selectedMemberId === m.id ? "#1c1730" : "var(--paper)", fontSize: "12px" }}>{m.member_number} · {m.name}</button>
          ))}
        </div>
      </div>

      {!selectedMemberId && (
        <p style={{ color: "var(--fog)", fontSize: "13px", fontStyle: "italic" }}>Select a member above to log a purchase or redeem points.</p>
      )}

      {selectedMemberId && (
        <>
          <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{selectedMember?.name}</div>
              <div style={{ fontSize: "12px", color: "var(--fog)" }}>{selectedMember?.member_number}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "26px", fontWeight: 700, color: "var(--lilac)" }}>{loadingLedger ? "…" : balance}</div>
              <div style={{ fontSize: "11px", color: "var(--fog)" }}>points balance</div>
            </div>
          </div>

          {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "14px" }}>{error}</p>}

          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "20px" }}>
            {canManage && (
              <div style={{ ...cardStyle, flex: "1 1 260px", marginBottom: 0 }}>
                <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px" }}>Log a purchase</div>
                {clubs && clubs.length > 1 && (
                  <div style={{ marginBottom: "10px" }}>
                    <div style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "6px" }}>Club</div>
                    <select value={earnClubId} onChange={(e) => setEarnClubId(e.target.value)} style={inputStyle}>
                      {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "6px" }}>Dollar amount spent</div>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={dollarAmount} onChange={(e) => setDollarAmount(e.target.value)} style={inputStyle} />
                </div>
                <button onClick={addPoints} disabled={earnBusy} style={{ ...btnGold, opacity: earnBusy ? 0.6 : 1 }}>
                  <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{earnBusy ? "Adding…" : "Add points"}
                </button>
              </div>
            )}

            <div style={{ ...cardStyle, flex: "1 1 260px", marginBottom: 0 }}>
              <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px" }}>Redeem points</div>
              {clubs && clubs.length > 1 && (
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "6px" }}>Club</div>
                  <select value={redeemClubId} onChange={(e) => setRedeemClubId(e.target.value)} style={inputStyle}>
                    {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "6px" }}>Points to redeem</div>
                <input type="number" min="0" placeholder="0" value={redeemPoints} onChange={(e) => setRedeemPoints(e.target.value)} style={inputStyle} />
              </div>
              <input placeholder="Note (optional, e.g. free drink)" value={redeemNote} onChange={(e) => setRedeemNote(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
              {redeemError && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{redeemError}</p>}
              <button onClick={redeem} disabled={redeemBusy} style={{ ...btnGhost, opacity: redeemBusy ? 0.6 : 1 }}>
                <Check size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{redeemBusy ? "Redeeming…" : "Redeem"}
              </button>
            </div>

            {canManage && (
              <div style={{ ...cardStyle, flex: "1 1 260px", marginBottom: 0 }}>
                <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px" }}>Manual adjustment</div>
                <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                  <button
                    onClick={() => setAdjustDirection("add")}
                    style={{ ...btnGhost, flex: 1, background: adjustDirection === "add" ? "var(--panel-2)" : "transparent" }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAdjustDirection("subtract")}
                    style={{ ...btnGhost, flex: 1, background: adjustDirection === "subtract" ? "var(--panel-2)" : "transparent" }}
                  >
                    Subtract
                  </button>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "6px" }}>Points</div>
                  <input type="number" min="0" placeholder="0" value={adjustPointsValue} onChange={(e) => setAdjustPointsValue(e.target.value)} style={inputStyle} />
                </div>
                <input placeholder="Reason (required, e.g. system error correction)" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
                {adjustError && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{adjustError}</p>}
                <button onClick={submitAdjustment} disabled={adjustBusy} style={{ ...btnGhost, opacity: adjustBusy ? 0.6 : 1 }}>
                  {adjustBusy ? "Saving…" : adjustDirection === "add" ? "Add points" : "Subtract points"}
                </button>
              </div>
            )}
          </div>

          <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px" }}>Recent history</div>
          {loadingLedger && <p style={{ color: "var(--fog)", fontSize: "13px" }}>Loading…</p>}
          {!loadingLedger && ledger.length === 0 && <p style={{ color: "var(--fog)", fontSize: "13px", fontStyle: "italic" }}>No points activity yet.</p>}
          {ledger.slice(0, 20).map((row) => {
            const debit = isDebitKind(row.kind);
            const canReverse = canManage && debit && !row.reversed;
            return (
              <div key={row.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: row.reversed ? 0.6 : 1 }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>
                    <span style={{ display: "inline-block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: debit ? "var(--paper)" : "var(--lilac)", border: "1px solid var(--border-strong)", borderRadius: "4px", padding: "2px 6px", marginRight: 8 }}>
                      {LEDGER_KIND_LABELS[row.kind] || row.kind}
                    </span>
                    {row.reversed && (
                      <span style={{ display: "inline-block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--error)", border: "1px solid var(--error)", borderRadius: "4px", padding: "2px 6px", marginRight: 8 }}>
                        Reversed
                      </span>
                    )}
                    <span style={{ textDecoration: row.reversed ? "line-through" : "none" }}>
                      {debit ? "-" : "+"}{row.points} pts
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--fog)", marginTop: "4px" }}>
                    {formatDate(row.created_at)}{clubs && clubs.length > 1 && row.club_id ? ` · ${clubName(row.club_id)}` : ""}
                    {row.dollar_amount != null ? ` · $${Number(row.dollar_amount).toFixed(2)}` : ""}
                    {row.note ? ` · ${row.note}` : ""}
                  </div>
                </div>
                {canReverse && (
                  <button
                    onClick={() => reverseRow(row)}
                    disabled={reversingId === row.id}
                    style={{ ...btnGhost, fontSize: "11px", padding: "6px 10px", opacity: reversingId === row.id ? 0.6 : 1 }}
                  >
                    {reversingId === row.id ? "Reversing…" : "Reverse"}
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

const STAFF_ROLE_LABELS = { bartender: "Bartender", manager: "Manager", admin: "Admin" };

function AdminStaff({ session, staffList, viewerRole, viewerId, onChanged }) {
  const isAdmin = viewerRole === "admin";
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("bartender");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function addStaff() {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setError("Fill in name, email, and a temporary password.");
      return;
    }
    setError("");
    setCreating(true);
    try {
      await callFunction(
        "create-staff",
        { name: newName.trim(), email: newEmail.trim().toLowerCase(), password: newPassword.trim(), role: newRole },
        session.access_token
      );
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("bartender");
      onChanged();
    } catch (e) {
      setError(e.message || "Failed to create staff account.");
    }
    setCreating(false);
  }

  async function changeRole(id, role) {
    setBusyId(id);
    const { error: e } = await supabase.from("staff").update({ role }).eq("id", id);
    if (e) setError(e.message || "Failed to update role.");
    setBusyId(null);
    onChanged();
  }

  async function removeStaff(id) {
    setBusyId(id);
    const { error: e } = await supabase.from("staff").delete().eq("id", id);
    if (e) setError(e.message || "Failed to remove staff member.");
    setBusyId(null);
    onChanged();
  }

  return (
    <div>
      <div style={{ ...cardStyle, marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px", display: "flex", alignItems: "center", gap: 6 }}>
          <Shield size={14} /> Add a staff account
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 150px" }}>
            <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Name</div>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" style={inputStyle} />
          </div>
          <div style={{ flex: "1 1 170px" }}>
            <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Email</div>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" style={inputStyle} />
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Temp. password</div>
            <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password" style={inputStyle} />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 4 }}>Role</div>
            {isAdmin ? (
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={inputStyle}>
                <option value="bartender">Bartender</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            ) : (
              <div style={{ ...inputStyle, color: "var(--fog)" }}>Bartender</div>
            )}
          </div>
          <button onClick={addStaff} disabled={creating} style={btnGold}>
            <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{creating ? "Adding…" : "Add"}
          </button>
        </div>
        {!isAdmin && <p style={{ fontSize: "12px", color: "var(--fog)", marginTop: "10px" }}>Managers can add bartender accounts. Only an admin can grant manager or admin access.</p>}
      </div>

      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {staffList.map((s) => {
          const isSelf = s.id === viewerId;
          // The owner account (the original admin) can never be role-changed
          // or removed by anyone, including other admins — enforced here for
          // the UI and again at the database level (RLS) as the real guard.
          const canRemove = !isSelf && !s.is_owner && (isAdmin || (viewerRole === "manager" && s.role === "bartender"));
          const canChangeRole = isAdmin && !isSelf && !s.is_owner;
          return (
            <div key={s.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>
                  {s.name || "(no name on file)"}{isSelf ? " · You" : ""}{s.is_owner ? " · Owner" : ""}
                </div>
                <div style={{ fontSize: "12px", color: "var(--fog)" }}>{s.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {canChangeRole ? (
                  <select value={s.role} onChange={(e) => changeRole(s.id, e.target.value)} disabled={busyId === s.id} style={{ ...inputStyle, width: "auto", padding: "6px 8px", fontSize: "12px" }}>
                    <option value="bartender">Bartender</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--fog)" }}>{STAFF_ROLE_LABELS[s.role] || s.role}</span>
                )}
                {canRemove && (
                  <button onClick={() => removeStaff(s.id)} disabled={busyId === s.id} style={{ ...btnGhost, fontSize: "11px" }}><Trash2 size={12} /></button>
                )}
              </div>
            </div>
          );
        })}
        {staffList.length === 0 && <p style={{ fontSize: "13px", color: "var(--fog)", fontStyle: "italic" }}>No staff accounts yet.</p>}
      </div>
    </div>
  );
}

function AdminClaims({ claims, members, clubs, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [selectedClaimIds, setSelectedClaimIds] = useState([]);

  function memberName(id) {
    return members.find((m) => m.id === id)?.name || "Unknown member";
  }
  function clubName(id) {
    return (clubs || []).find((c) => c.id === id)?.name || "";
  }

  const needsReview = claims.filter((c) => c.status === "needs_review");
  const pending = claims.filter((c) => c.status === "pending");
  const resolved = claims.filter((c) => c.status === "fulfilled" || c.status === "denied");

  const allPendingSelected = pending.length > 0 && pending.every((c) => selectedClaimIds.includes(c.id));

  function toggleClaimSelected(id) {
    setSelectedClaimIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAllPending() {
    if (allPendingSelected) {
      setSelectedClaimIds((prev) => prev.filter((id) => !pending.some((c) => c.id === id)));
    } else {
      setSelectedClaimIds((prev) => [...new Set([...prev, ...pending.map((c) => c.id)])]);
    }
  }

  function cancelSelection() {
    setSelectedClaimIds([]);
  }

  async function deleteSelected() {
    if (selectedClaimIds.length === 0) return;
    setError("");
    try {
      const { error: delErr } = await supabase.from("photo_claims").delete().in("id", selectedClaimIds);
      if (delErr) throw delErr;
      setSelectedClaimIds([]);
      onChanged();
    } catch (e) {
      setError(e.message || "Failed to delete selected claims.");
    }
  }

  async function approveLateClaim(claim) {
    setError(""); setBusyId(claim.id);
    try {
      // Find the sibling claim that already got a photo, for the same club + tag
      const { data: sibling, error: sibErr } = await supabase
        .from("photo_claims")
        .select("*")
        .eq("club_id", claim.club_id)
        .eq("photo_tag", claim.photo_tag)
        .eq("status", "fulfilled")
        .limit(1)
        .maybeSingle();
      if (sibErr) throw sibErr;
      if (!sibling || !sibling.matched_photo_id) {
        setError("Couldn't find the already-sent photo for this tag — check the Photos tab.");
        setBusyId(null);
        return;
      }
      const { error: tagErr } = await supabase
        .from("photo_tags")
        .insert({ photo_id: sibling.matched_photo_id, member_id: claim.member_id });
      if (tagErr) throw tagErr;

      const { error: updErr } = await supabase
        .from("photo_claims")
        .update({ status: "fulfilled", matched_photo_id: sibling.matched_photo_id })
        .eq("id", claim.id);
      if (updErr) throw updErr;

      onChanged();
    } catch (e) {
      setError(e.message || "Something went wrong.");
    }
    setBusyId(null);
  }

  async function denyClaim(claim) {
    setError(""); setBusyId(claim.id);
    try {
      const { error: updErr } = await supabase.from("photo_claims").update({ status: "denied" }).eq("id", claim.id);
      if (updErr) throw updErr;
      onChanged();
    } catch (e) {
      setError(e.message || "Something went wrong.");
    }
    setBusyId(null);
  }

  function ClaimRow({ c, showActions, showCheckbox }) {
    return (
      <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {showCheckbox && (
            <input
              type="checkbox"
              checked={selectedClaimIds.includes(c.id)}
              onChange={() => toggleClaimSelected(c.id)}
            />
          )}
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600 }}>#{c.photo_tag}{clubs.length > 1 && c.club_id ? ` · ${clubName(c.club_id)}` : ""}</div>
            <div style={{ fontSize: "12px", color: "var(--fog)" }}>{memberName(c.member_id)}</div>
          </div>
        </div>
        {showActions ? (
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => approveLateClaim(c)} disabled={busyId === c.id} style={{ ...btnGold, padding: "6px 12px", fontSize: "12px" }}>
              <Check size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Approve
            </button>
            <button onClick={() => denyClaim(c)} disabled={busyId === c.id} style={{ ...btnGhost, padding: "6px 12px", fontSize: "12px" }}>
              <X size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Deny
            </button>
          </div>
        ) : (
          <span style={{ fontSize: "11px", fontWeight: 600, color: c.status === "fulfilled" ? "var(--lilac)" : c.status === "denied" ? "var(--error)" : "var(--fog)" }}>
            {c.status === "fulfilled" ? "Delivered" : c.status === "denied" ? "Denied" : "Pending"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}

      {needsReview.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "13px", color: "var(--error)", marginBottom: "10px", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} /> Needs your review ({needsReview.length})
          </div>
          <p style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "10px" }}>
            These claims came in after that photo number was already sent to someone else — approve if they're also in the shot.
          </p>
          {needsReview.map((c) => <ClaimRow key={c.id} c={c} showActions />)}
        </div>
      )}

      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {pending.length > 0 && (
              <input type="checkbox" checked={allPendingSelected} onChange={toggleSelectAllPending} title="Select all" />
            )}
            <span style={{ fontSize: "13px", color: "var(--lilac)" }}>Waiting on a photo ({pending.length})</span>
          </div>
          {selectedClaimIds.length > 0 && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={deleteSelected} style={{ ...btnGhost, color: "var(--error)", borderColor: "var(--error)", fontSize: "12px", padding: "6px 12px" }}>
                <Trash2 size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Delete ({selectedClaimIds.length})
              </button>
              <button onClick={cancelSelection} style={{ ...btnGhost, fontSize: "12px", padding: "6px 12px" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
        {pending.length === 0 && <p style={{ fontSize: "13px", color: "var(--fog)", fontStyle: "italic" }}>No pending claims right now.</p>}
        {pending.map((c) => <ClaimRow key={c.id} c={c} showActions={false} showCheckbox />)}
      </div>

      <div>
        <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "10px" }}>Resolved</div>
        {resolved.length === 0 && <p style={{ fontSize: "13px", color: "var(--fog)", fontStyle: "italic" }}>Nothing resolved yet.</p>}
        {resolved.slice(0, 30).map((c) => <ClaimRow key={c.id} c={c} showActions={false} />)}
      </div>
    </div>
  );
}

const LOST_FOUND_STATUSES = ["pending", "found", "returned", "closed"];
const LOST_FOUND_STATUS_LABELS = { pending: "Pending", found: "Found", returned: "Returned", closed: "Closed" };
const LOST_FOUND_STATUS_COLORS = { pending: "var(--fog)", found: "var(--lilac)", returned: "var(--success)", closed: "var(--error)" };

function LostItemRow({ it, clubs, clubName, busyId, onUpdateStatus, note, onNoteChange, onNoteBlur }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600 }}>
            {it.first_name} {it.last_name}
            {clubs.length > 1 && it.club_id ? ` · ${clubName(it.club_id)}` : ""}
          </div>
          <div style={{ fontSize: "12px", color: "var(--fog)" }}>{it.email}</div>
        </div>
        <span style={{ fontSize: "11px", fontWeight: 700, color: LOST_FOUND_STATUS_COLORS[it.status] || "var(--fog)", whiteSpace: "nowrap" }}>
          {LOST_FOUND_STATUS_LABELS[it.status] || it.status}
        </span>
      </div>

      <div style={{ fontSize: "13px", marginBottom: "4px" }}>{it.item_description}</div>
      <div style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "10px" }}>
        {it.location}{it.visit_date ? ` · Visited ${new Date(it.visit_date + "T00:00:00").toLocaleDateString()}` : ""}
        {" · Submitted "}{new Date(it.created_at).toLocaleDateString()}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
        {LOST_FOUND_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => onUpdateStatus(it, s)}
            disabled={busyId === it.id || it.status === s}
            style={{
              ...btnGhost,
              padding: "5px 10px",
              fontSize: "11px",
              background: it.status === s ? "var(--panel-2)" : "transparent",
              opacity: busyId === it.id ? 0.6 : 1,
            }}
          >
            {LOST_FOUND_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        onBlur={onNoteBlur}
        placeholder="Staff notes…"
        rows={2}
        style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
      />
    </div>
  );
}

function AdminLostFound({ items, clubs, session, onItemChanged }) {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notesDraft, setNotesDraft] = useState({});

  function clubName(id) {
    return (clubs || []).find((c) => c.id === id)?.name || "";
  }

  const filtered = items
    .filter((it) => statusFilter === "all" || it.status === statusFilter)
    .filter((it) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const name = `${it.first_name || ""} ${it.last_name || ""}`.toLowerCase();
      return name.includes(q) || (it.email || "").toLowerCase().includes(q) || (it.item_description || "").toLowerCase().includes(q);
    });

  const pendingCount = items.filter((it) => it.status === "pending").length;

  async function updateStatus(item, status) {
    setError(""); setBusyId(item.id);
    try {
      const { data, error: updErr } = await supabase
        .from("lost_items")
        .update({ status, resolved_at: new Date().toISOString(), resolved_by: session.user.id })
        .eq("id", item.id)
        .select()
        .single();
      if (updErr) throw updErr;
      onItemChanged(data);
    } catch (e) {
      setError(e.message || "Failed to update status.");
    }
    setBusyId(null);
  }

  async function saveNote(item) {
    const note = notesDraft[item.id];
    if (note === undefined || note === (item.staff_notes || "")) return;
    setError(""); setBusyId(item.id);
    try {
      const { data, error: updErr } = await supabase
        .from("lost_items")
        .update({ staff_notes: note })
        .eq("id", item.id)
        .select()
        .single();
      if (updErr) throw updErr;
      onItemChanged(data);
      setNotesDraft((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (e) {
      setError(e.message || "Failed to save note.");
    }
    setBusyId(null);
  }

  return (
    <div>
      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px", alignItems: "center" }}>
        <button onClick={() => setStatusFilter("all")} style={{ ...btnGhost, fontSize: "12px", background: statusFilter === "all" ? "var(--panel-2)" : "transparent" }}>All</button>
        {LOST_FOUND_STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ ...btnGhost, fontSize: "12px", background: statusFilter === s ? "var(--panel-2)" : "transparent" }}>
            {LOST_FOUND_STATUS_LABELS[s]}{s === "pending" ? <CountBadge count={pendingCount} /> : ""}
          </button>
        ))}
      </div>

      <div style={{ position: "relative", marginBottom: "16px" }}>
        <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--fog)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or item…"
          style={{ ...inputStyle, paddingLeft: "34px" }}
        />
      </div>

      {filtered.length === 0 && <p style={{ fontSize: "13px", color: "var(--fog)", fontStyle: "italic" }}>No reports here.</p>}
      {filtered.map((it) => (
        <LostItemRow
          key={it.id}
          it={it}
          clubs={clubs}
          clubName={clubName}
          busyId={busyId}
          onUpdateStatus={updateStatus}
          note={notesDraft[it.id] !== undefined ? notesDraft[it.id] : (it.staff_notes || "")}
          onNoteChange={(value) => setNotesDraft((prev) => ({ ...prev, [it.id]: value }))}
          onNoteBlur={() => saveNote(it)}
        />
      ))}
    </div>
  );
}

function AdminUnmatchedPhotos({ session, members, clubs }) {
  const [photos, setPhotos] = useState([]);
  const [tagsByPhoto, setTagsByPhoto] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState("");

  function clubName(id) {
    return (clubs || []).find((c) => c.id === id)?.name || "";
  }
  function memberName(id) {
    return members.find((m) => m.id === id)?.name || "Unknown member";
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: photoRows, error: pErr } = await supabase
        .from("photos")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (pErr) throw pErr;

      const { data: tagRows, error: tErr } = await supabase
        .from("photo_tags")
        .select("photo_id, member_id");
      if (tErr) throw tErr;

      const counts = {};
      (tagRows || []).forEach((t) => {
        if (!counts[t.photo_id]) counts[t.photo_id] = [];
        counts[t.photo_id].push(t.member_id);
      });
      setTagsByPhoto(counts);

      const withUrls = await Promise.all(
        (photoRows || []).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("member-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, signedUrl: signed?.signedUrl };
        })
      );
      setPhotos(withUrls);
    } catch (e) {
      setError(e.message || "Failed to load photos.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function tagPhoto(photoId, memberId) {
    setError("");
    try {
      const { error: tagErr } = await supabase.from("photo_tags").insert({ photo_id: photoId, member_id: memberId });
      if (tagErr) throw tagErr;
      await load();
    } catch (e) {
      setError(e.message || "Failed to tag photo.");
    }
  }

  async function untagPhoto(photoId, memberId) {
    setError("");
    try {
      const { error: delErr } = await supabase.from("photo_tags").delete().eq("photo_id", photoId).eq("member_id", memberId);
      if (delErr) throw delErr;
      await load();
    } catch (e) {
      setError(e.message || "Failed to remove tag.");
    }
  }

  async function resync() {
    setResyncing(true);
    setResyncMsg("");
    setError("");
    try {
      const { error: fnErr } = await supabase.functions.invoke("drive-photo-sync", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnErr) throw fnErr;
      setResyncMsg("Resync complete.");
      await load();
    } catch (e) {
      setError(e.message || "Resync failed.");
    }
    setResyncing(false);
  }

  const unmatched = photos.filter((p) => !tagsByPhoto[p.id] || tagsByPhoto[p.id].length === 0);
  const multiTagged = photos.filter((p) => tagsByPhoto[p.id] && tagsByPhoto[p.id].length >= 2);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ fontSize: "13px", color: "var(--lilac)" }}>Unmatched photos ({unmatched.length})</div>
        <button onClick={resync} disabled={resyncing} style={{ ...btnGhost, fontSize: "12px" }}>
          <RefreshCw size={12} style={{ marginRight: 6, verticalAlign: -2 }} />{resyncing ? "Resyncing…" : "Resync from Drive"}
        </button>
      </div>
      {resyncMsg && <p style={{ color: "var(--success)", fontSize: "13px", marginBottom: "10px" }}>{resyncMsg}</p>}
      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
      {loading && <p style={{ color: "var(--fog)", fontSize: "13px" }}>Loading photos…</p>}

      {!loading && unmatched.length === 0 && (
        <p style={{ fontSize: "13px", color: "var(--fog)", fontStyle: "italic", marginBottom: "24px" }}>Nothing unmatched right now — every synced photo has a member.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "32px" }}>
        {unmatched.map((p) => (
          <UnmatchedPhotoCard key={p.id} photo={p} members={members} clubName={clubName(p.club_id)} onTag={(memberId) => tagPhoto(p.id, memberId)} />
        ))}
      </div>

      {multiTagged.length > 0 && (
        <div>
          <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px" }}>Tagged to more than one member ({multiTagged.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {multiTagged.map((p) => (
              <div key={p.id} style={{ ...cardStyle, display: "flex", gap: "12px", alignItems: "center" }}>
                <img src={p.signedUrl} alt={p.caption || "photo"} style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "6px" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", color: "var(--fog)", marginBottom: 6 }}>{clubName(p.club_id)}{p.caption ? ` · ${p.caption}` : ""}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {tagsByPhoto[p.id].map((mid) => (
                      <span key={mid} style={{ ...btnGhost, display: "inline-flex", alignItems: "center", gap: 6, fontSize: "11px", padding: "4px 8px" }}>
                        {memberName(mid)}
                        <button onClick={() => untagPhoto(p.id, mid)} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", padding: 0, display: "flex" }}>
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UnmatchedPhotoCard({ photo, members, clubName, onTag }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [tagging, setTagging] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return members.filter((m) => m.name.toLowerCase().includes(q) || m.member_number.toLowerCase().includes(q)).slice(0, 6);
  }, [members, search]);

  async function pick(m) {
    setTagging(true);
    await onTag(m.id);
    setTagging(false);
    setSearch("");
    setOpen(false);
  }

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "visible" }}>
      <img src={photo.signedUrl} alt={photo.caption || "Unmatched photo"} style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "10px 10px 0 0", display: "block" }} />
      <div style={{ padding: "10px" }}>
        <div style={{ fontSize: "11px", color: "var(--fog)", marginBottom: 8 }}>{clubName || "No club"}{photo.caption ? ` · ${photo.caption}` : ""}</div>
        <div style={{ position: "relative" }}>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Name or member ID"
            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
          />
          {open && search.trim() && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "var(--panel-2)", border: "1px solid var(--border-strong)", borderRadius: "6px", marginTop: "4px", maxHeight: "160px", overflowY: "auto" }}>
              {filtered.length === 0 && (
                <div style={{ padding: "8px 10px", fontSize: "12px", color: "var(--fog)", fontStyle: "italic" }}>No members match.</div>
              )}
              {filtered.map((m) => (
                <div
                  key={m.id}
                  onClick={() => pick(m)}
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ padding: "8px 10px", fontSize: "12px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                >
                  {m.member_number} · {m.name}
                </div>
              ))}
            </div>
          )}
        </div>
        {tagging && <div style={{ fontSize: "11px", color: "var(--fog)", marginTop: 6 }}>Tagging…</div>}
      </div>
    </div>
  );
}

function AnalyticsDashboard() {
  const [clubs, setClubs] = useState([]);
  const [members, setMembers] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clubFilter, setClubFilter] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [membersRes, photosRes, claimsRes, clubsRes] = await Promise.all([
          supabase.from("members").select("id, created_at"),
          supabase.from("photos").select("id, uploaded_at, club_id"),
          supabase.from("photo_claims").select("id, status, created_at, club_id"),
          supabase.from("clubs").select("*").order("sort_order"),
        ]);
        if (membersRes.error) throw membersRes.error;
        if (photosRes.error) throw photosRes.error;
        if (claimsRes.error) throw claimsRes.error;
        if (clubsRes.error) throw clubsRes.error;
        setMembers(membersRes.data || []);
        setPhotos(photosRes.data || []);
        setClaims(claimsRes.data || []);
        setClubs(clubsRes.data || []);
      } catch (e) {
        setError(e.message || "Failed to load analytics.");
      }
      setLoading(false);
    })();
  }, []);

  function clubName(id) {
    return clubs.find((c) => c.id === id)?.name || "Unknown";
  }

  const visiblePhotos = clubFilter === "all" ? photos : photos.filter((p) => p.club_id === clubFilter);
  const visibleClaims = clubFilter === "all" ? claims : claims.filter((c) => c.club_id === clubFilter);

  function weeklyBuckets(items, dateKey, weeks = 8) {
    const now = new Date();
    const buckets = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const count = items.filter((x) => {
        const d = new Date(x[dateKey]);
        return d >= start && d < end;
      }).length;
      buckets.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, count });
    }
    return buckets;
  }

  const signupBuckets = useMemo(() => weeklyBuckets(members, "created_at"), [members]);
  const photoBuckets = useMemo(() => weeklyBuckets(visiblePhotos, "uploaded_at"), [visiblePhotos]);

  const claimStatusCounts = useMemo(() => {
    const counts = { pending: 0, needs_review: 0, fulfilled: 0, denied: 0 };
    visibleClaims.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [visibleClaims]);

  const photosByClub = useMemo(() => {
    const counts = {};
    photos.forEach((p) => {
      const key = p.club_id || "none";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [photos]);

  if (loading) return <div style={{ padding: "60px", textAlign: "center", color: "var(--fog)" }}>Loading analytics…</div>;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <h2 style={{ fontSize: "22px", margin: 0 }}>Analytics</h2>
      </div>
      <p style={{ color: "var(--fog)", fontSize: "13px", marginBottom: "24px" }}>A snapshot across all clubs, staff only.</p>

      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "16px" }}>{error}</p>}

      {clubs.length > 1 && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          <button onClick={() => setClubFilter("all")} style={{ ...btnGhost, background: clubFilter === "all" ? "var(--panel-2)" : "transparent" }}>All clubs</button>
          {clubs.map((c) => (
            <button key={c.id} onClick={() => setClubFilter(c.id)} style={{ ...btnGhost, background: clubFilter === c.id ? "var(--panel-2)" : "transparent" }}>{c.name}</button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "32px" }}>
        <StatCard label="Total members" value={members.length} />
        <StatCard label={clubFilter === "all" ? "Photos synced" : `Photos · ${clubName(clubFilter)}`} value={visiblePhotos.length} />
        <StatCard label="Pending claims" value={claimStatusCounts.pending + claimStatusCounts.needs_review} />
        <StatCard label="Delivered claims" value={claimStatusCounts.fulfilled} />
      </div>

      <ChartSection title="New signups by week (all clubs)" data={signupBuckets} color="var(--lilac)" />
      <ChartSection title={clubFilter === "all" ? "Photos synced by week (all clubs)" : `Photos synced by week · ${clubName(clubFilter)}`} data={photoBuckets} color="var(--sky, #8fb8e0)" />

      <div style={{ marginTop: "8px" }}>
        <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px" }}>Claims by status{clubFilter !== "all" ? ` · ${clubName(clubFilter)}` : ""}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { key: "pending", label: "Waiting on a photo", color: "var(--fog)" },
            { key: "needs_review", label: "Needs review", color: "var(--error)" },
            { key: "fulfilled", label: "Delivered", color: "var(--lilac)" },
            { key: "denied", label: "Denied", color: "var(--fog)" },
          ].map((row) => {
            const max = Math.max(1, ...Object.values(claimStatusCounts));
            const count = claimStatusCounts[row.key] || 0;
            return (
              <div key={row.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "120px", fontSize: "12px", color: "var(--fog)" }}>{row.label}</div>
                <div style={{ flex: 1, background: "var(--panel-2)", borderRadius: "4px", height: "16px", position: "relative" }}>
                  <div style={{ width: `${(count / max) * 100}%`, background: row.color, height: "100%", borderRadius: "4px" }} />
                </div>
                <div style={{ width: "24px", fontSize: "12px", textAlign: "right" }}>{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {clubs.length > 1 && clubFilter === "all" && (
        <div style={{ marginTop: "32px" }}>
          <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "12px" }}>Photos by club</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {clubs.map((c) => {
              const count = photosByClub[c.id] || 0;
              const max = Math.max(1, ...clubs.map((cc) => photosByClub[cc.id] || 0));
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "120px", fontSize: "12px", color: "var(--fog)" }}>{c.name}</div>
                  <div style={{ flex: 1, background: "var(--panel-2)", borderRadius: "4px", height: "16px" }}>
                    <div style={{ width: `${(count / max) * 100}%`, background: "var(--lilac)", height: "100%", borderRadius: "4px" }} />
                  </div>
                  <div style={{ width: "24px", fontSize: "12px", textAlign: "right" }}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ ...cardStyle, textAlign: "center" }}>
      <div style={{ fontSize: "26px", fontWeight: 700, color: "var(--lilac)" }}>{value}</div>
      <div style={{ fontSize: "11px", color: "var(--fog)", marginTop: "4px" }}>{label}</div>
    </div>
  );
}

function ChartSection({ title, data, color }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ marginBottom: "28px" }}>
      <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "10px" }}>{title}</div>
      <div style={{ ...cardStyle, display: "flex", alignItems: "flex-end", gap: "8px", height: "140px", padding: "16px" }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            <div style={{ fontSize: "10px", color: "var(--paper)", marginBottom: "4px" }}>{d.count}</div>
            <div style={{ width: "100%", maxWidth: "28px", height: `${(d.count / max) * 90}%`, minHeight: d.count > 0 ? "3px" : "0", background: color, borderRadius: "3px 3px 0 0" }} />
            <div style={{ fontSize: "9px", color: "var(--fog)", marginTop: "6px" }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SiteLinesEditor({ section, title }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("site_lines")
      .select("*")
      .eq("section", section)
      .order("sort_order");
    if (e) setError(e.message);
    setLines(data || []);
    setLoading(false);
  }, [section]);

  useEffect(() => { load(); }, [load]);

  function editLocal(id, text) {
    setLines(lines.map((l) => (l.id === id ? { ...l, text } : l)));
  }

  async function saveLine(l) {
    setSaving(true); setError("");
    const { error: e } = await supabase.from("site_lines").update({ text: l.text }).eq("id", l.id);
    if (e) setError(e.message);
    setSaving(false);
  }

  async function addLine() {
    setError("");
    const nextOrder = lines.length ? Math.max(...lines.map((l) => l.sort_order)) + 10 : 10;
    const { error: e } = await supabase.from("site_lines").insert({ section, text: "", sort_order: nextOrder });
    if (e) { setError(e.message); return; }
    load();
  }

  async function removeLine(l) {
    await supabase.from("site_lines").delete().eq("id", l.id);
    load();
  }

  async function move(l, direction) {
    const idx = lines.findIndex((x) => x.id === l.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= lines.length) return;
    const other = lines[swapIdx];
    await supabase.from("site_lines").update({ sort_order: other.sort_order }).eq("id", l.id);
    await supabase.from("site_lines").update({ sort_order: l.sort_order }).eq("id", other.id);
    load();
  }

  if (loading) return <p style={{ color: "var(--fog)", fontSize: "13px" }}>Loading…</p>;

  return (
    <div style={{ ...cardStyle, marginBottom: "20px" }}>
      <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "10px" }}>{title}</div>
      {lines.map((l, i) => (
        <div key={l.id} style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
          <input
            value={l.text}
            onChange={(e) => editLocal(l.id, e.target.value)}
            onBlur={() => saveLine(l)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => move(l, "up")} disabled={i === 0} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px", opacity: i === 0 ? 0.3 : 1 }}>↑</button>
          <button onClick={() => move(l, "down")} disabled={i === lines.length - 1} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px", opacity: i === lines.length - 1 ? 0.3 : 1 }}>↓</button>
          <button onClick={() => removeLine(l)} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px" }}><Trash2 size={12} /></button>
        </div>
      ))}
      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "8px" }}>{error}</p>}
      <button onClick={addLine} style={btnGhost}>+ Add line</button>
      {saving && <span style={{ fontSize: "11px", color: "var(--fog)", marginLeft: "10px" }}>Saving…</span>}
    </div>
  );
}

function AdminGallery() {
  const [photos, setPhotos] = useState([]);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("gallery_photos")
      .select("*")
      .order("sort_order");
    if (e) setError(e.message);
    setPhotos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function publicUrl(path) {
    return supabase.storage.from("gallery-photos").getPublicUrl(path).data.publicUrl;
  }

  async function upload() {
    if (!file) { setError("Choose a photo first."); return; }
    setError(""); setUploading(true);
    try {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("gallery-photos").upload(path, file);
      if (upErr) throw upErr;
      const nextOrder = photos.length ? Math.max(...photos.map((p) => p.sort_order)) + 10 : 10;
      const { error: insErr } = await supabase
        .from("gallery_photos")
        .insert({ storage_path: path, caption: caption.trim(), sort_order: nextOrder });
      if (insErr) throw insErr;
      setFile(null); setCaption("");
      load();
    } catch (e) {
      setError(e.message || "Something went wrong.");
    }
    setUploading(false);
  }

  async function removePhoto(p) {
    await supabase.storage.from("gallery-photos").remove([p.storage_path]);
    await supabase.from("gallery_photos").delete().eq("id", p.id);
    load();
  }

  async function move(p, direction) {
    const idx = photos.findIndex((x) => x.id === p.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= photos.length) return;
    const other = photos[swapIdx];
    await supabase.from("gallery_photos").update({ sort_order: other.sort_order }).eq("id", p.id);
    await supabase.from("gallery_photos").update({ sort_order: p.sort_order }).eq("id", other.id);
    load();
  }

  return (
    <div>
      <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "6px" }}>Public gallery</div>
      <p style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "16px" }}>
        Photos shown on the public site's gallery section, in this order. Use the arrows to reorder.
      </p>

      <div style={{ ...cardStyle, marginBottom: "20px" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ marginBottom: "10px", fontSize: "13px", color: "var(--paper)" }}
        />
        <input
          placeholder="Caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          style={{ ...inputStyle, marginBottom: "10px" }}
        />
        {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
        <button onClick={upload} disabled={uploading} style={{ ...btnGold, opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Uploading…" : "Add to gallery"}
        </button>
      </div>

      {loading && <p style={{ color: "var(--fog)", fontSize: "13px" }}>Loading…</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
        {photos.map((p, i) => (
          <div key={p.id} style={{ ...cardStyle, padding: "10px" }}>
            <img
              src={publicUrl(p.storage_path)}
              alt={p.caption}
              style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "6px", marginBottom: "8px" }}
            />
            <div style={{ fontSize: "12px", color: "var(--paper)", marginBottom: "8px", minHeight: "16px" }}>{p.caption}</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => move(p, "up")} disabled={i === 0} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px", opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button onClick={() => move(p, "down")} disabled={i === photos.length - 1} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px", opacity: i === photos.length - 1 ? 0.3 : 1 }}>↓</button>
              <button onClick={() => removePhoto(p)} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px", marginLeft: "auto" }}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
      {!loading && photos.length === 0 && (
        <p style={{ color: "var(--fog)", fontSize: "13px", fontStyle: "italic" }}>No gallery photos yet — add your first one above.</p>
      )}
    </div>
  );
}

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function PageBlockEditor({ page, onBack }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadingId, setUploadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("page_blocks")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order");
    if (e) setError(e.message);
    setBlocks(data || []);
    setLoading(false);
  }, [page.id]);

  useEffect(() => { load(); }, [load]);

  function publicUrl(path) {
    return supabase.storage.from("gallery-photos").getPublicUrl(path).data.publicUrl;
  }

  async function addBlock(type) {
    const nextOrder = blocks.length ? Math.max(...blocks.map((b) => b.sort_order)) + 10 : 10;
    const { error: e } = await supabase
      .from("page_blocks")
      .insert({ page_id: page.id, block_type: type, content: "", sort_order: nextOrder });
    if (e) { setError(e.message); return; }
    load();
  }

  function editLocal(id, content) {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, content } : b)));
  }

  async function saveBlock(b) {
    await supabase.from("page_blocks").update({ content: b.content }).eq("id", b.id);
  }

  async function uploadImage(b, file) {
    setUploadingId(b.id); setError("");
    try {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("gallery-photos").upload(path, file);
      if (upErr) throw upErr;
      await supabase.from("page_blocks").update({ content: path }).eq("id", b.id);
      load();
    } catch (e) {
      setError(e.message || "Upload failed.");
    }
    setUploadingId(null);
  }

  async function removeBlock(b) {
    await supabase.from("page_blocks").delete().eq("id", b.id);
    load();
  }

  async function move(b, direction) {
    const idx = blocks.findIndex((x) => x.id === b.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= blocks.length) return;
    const other = blocks[swapIdx];
    await supabase.from("page_blocks").update({ sort_order: other.sort_order }).eq("id", b.id);
    await supabase.from("page_blocks").update({ sort_order: b.sort_order }).eq("id", other.id);
    load();
  }

  return (
    <div>
      <button onClick={onBack} style={{ ...btnGhost, marginBottom: "16px" }}>← Back to pages</button>
      <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "6px" }}>
        Editing: {page.title} <span style={{ color: "var(--fog)" }}>({page.published ? "published" : "draft"})</span>
      </div>
      <p style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "16px" }}>
        Public URL: page.html?slug={page.slug}
      </p>

      {loading && <p style={{ color: "var(--fog)", fontSize: "13px" }}>Loading…</p>}
      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}

      {blocks.map((b, i) => (
        <div key={b.id} style={{ ...cardStyle, marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{b.block_type}</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => move(b, "up")} disabled={i === 0} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px", opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button onClick={() => move(b, "down")} disabled={i === blocks.length - 1} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px", opacity: i === blocks.length - 1 ? 0.3 : 1 }}>↓</button>
              <button onClick={() => removeBlock(b)} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px" }}><Trash2 size={12} /></button>
            </div>
          </div>

          {b.block_type === "image" ? (
            <div>
              {b.content && (
                <img src={publicUrl(b.content)} alt="" style={{ width: "100%", maxHeight: "220px", objectFit: "cover", borderRadius: "6px", marginBottom: "10px" }} />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(b, f); }}
                style={{ fontSize: "13px", color: "var(--paper)" }}
              />
              {uploadingId === b.id && <span style={{ fontSize: "11px", color: "var(--fog)", marginLeft: "8px" }}>Uploading…</span>}
            </div>
          ) : b.block_type === "heading" ? (
            <input
              value={b.content}
              onChange={(e) => editLocal(b.id, e.target.value)}
              onBlur={() => saveBlock(b)}
              placeholder="Heading text"
              style={inputStyle}
            />
          ) : (
            <textarea
              rows={4}
              value={b.content}
              onChange={(e) => editLocal(b.id, e.target.value)}
              onBlur={() => saveBlock(b)}
              placeholder="Paragraph text"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <button onClick={() => addBlock("heading")} style={btnGhost}>+ Heading</button>
        <button onClick={() => addBlock("paragraph")} style={btnGhost}>+ Paragraph</button>
        <button onClick={() => addBlock("image")} style={btnGhost}>+ Image</button>
      </div>
    </div>
  );
}

function AdminPages() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase.from("pages").select("*").order("sort_order");
    if (e) setError(e.message);
    setPages(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createPage() {
    const title = newTitle.trim();
    if (!title) { setError("Give the page a title first."); return; }
    const slug = slugify(title);
    const nextOrder = pages.length ? Math.max(...pages.map((p) => p.sort_order)) + 10 : 10;
    const { error: e } = await supabase.from("pages").insert({
      title, slug, nav_label: title, published: false, sort_order: nextOrder,
    });
    if (e) { setError(e.message); return; }
    setNewTitle("");
    load();
  }

  async function togglePublished(p) {
    await supabase.from("pages").update({ published: !p.published }).eq("id", p.id);
    load();
  }

  async function updateNavLabel(p, label) {
    setPages(pages.map((x) => (x.id === p.id ? { ...x, nav_label: label } : x)));
  }
  async function saveNavLabel(p) {
    await supabase.from("pages").update({ nav_label: p.nav_label }).eq("id", p.id);
  }

  async function deletePage(p) {
    await supabase.from("pages").delete().eq("id", p.id);
    load();
  }

  async function move(p, direction) {
    const idx = pages.findIndex((x) => x.id === p.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= pages.length) return;
    const other = pages[swapIdx];
    await supabase.from("pages").update({ sort_order: other.sort_order }).eq("id", p.id);
    await supabase.from("pages").update({ sort_order: p.sort_order }).eq("id", other.id);
    load();
  }

  if (editing) {
    return <PageBlockEditor page={editing} onBack={() => { setEditing(null); load(); }} />;
  }

  return (
    <div>
      <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "6px" }}>Site pages</div>
      <p style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "16px" }}>
        Create new pages (About, FAQ, Press, Menu, etc.). Published pages appear in the site's nav automatically.
      </p>

      <div style={{ ...cardStyle, marginBottom: "20px", display: "flex", gap: "8px" }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New page title, e.g. About Us"
          style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
        />
        <button onClick={createPage} style={btnGold}>+ Create page</button>
      </div>

      {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
      {loading && <p style={{ color: "var(--fog)", fontSize: "13px" }}>Loading…</p>}

      {pages.map((p, i) => (
        <div key={p.id} style={{ ...cardStyle, marginBottom: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <strong style={{ fontSize: "14px" }}>{p.title}</strong>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => move(p, "up")} disabled={i === 0} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px", opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button onClick={() => move(p, "down")} disabled={i === pages.length - 1} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px", opacity: i === pages.length - 1 ? 0.3 : 1 }}>↓</button>
              <button onClick={() => deletePage(p)} style={{ ...btnGhost, fontSize: "11px", padding: "4px 8px" }}><Trash2 size={12} /></button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", color: "var(--fog)" }}>Nav label:</label>
            <input
              value={p.nav_label}
              onChange={(e) => updateNavLabel(p, e.target.value)}
              onBlur={() => saveNavLabel(p)}
              style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
            />
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={() => setEditing(p)} style={btnGhost}>Edit content</button>
            <button onClick={() => togglePublished(p)} style={btnGhost}>
              {p.published ? "Unpublish" : "Publish"}
            </button>
            <span style={{ fontSize: "12px", color: p.published ? "var(--success)" : "var(--fog)" }}>
              {p.published ? "● Live" : "○ Draft"}
            </span>
          </div>
        </div>
      ))}
      {!loading && pages.length === 0 && (
        <p style={{ color: "var(--fog)", fontSize: "13px", fontStyle: "italic" }}>No pages yet — create your first one above.</p>
      )}
    </div>
  );
}

function AdminSiteContent() {
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("site_content")
      .select("*")
      .order("sort_order");
    if (e) { setError(e.message); setLoading(false); return; }
    setRows(data || []);
    const d = {};
    (data || []).forEach((r) => { d[r.key] = r.value; });
    setDraft(d);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = rows.some((r) => draft[r.key] !== r.value);

  async function saveAll() {
    setSaving(true); setError(""); setSaved(false);
    const changed = rows.filter((r) => draft[r.key] !== r.value);
    for (const r of changed) {
      const { error: e } = await supabase
        .from("site_content")
        .update({ value: draft[r.key], updated_at: new Date().toISOString() })
        .eq("key", r.key);
      if (e) { setError(e.message); setSaving(false); return; }
    }
    setSaving(false);
    setSaved(true);
    load();
  }

  if (loading) return <p style={{ color: "var(--fog)", fontSize: "13px" }}>Loading…</p>;

  return (
    <div>
      <div style={{ fontSize: "13px", color: "var(--lilac)", marginBottom: "6px" }}>Public website content</div>
      <p style={{ fontSize: "12px", color: "var(--fog)", marginBottom: "16px" }}>
        Changes here update the public marketing site. Visitors see them on their next page refresh.
      </p>

      <SiteLinesEditor section="hours" title="Hours (add as many lines as you need)" />
      <SiteLinesEditor section="address" title="Address (add as many lines as you need)" />

      <div style={{ ...cardStyle, marginBottom: "20px" }}>
        {rows.map((r) => (
          <div key={r.key} style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "var(--fog)", marginBottom: "4px" }}>{r.label}</label>
            {(r.value || "").length > 60 ? (
              <textarea
                rows={3}
                value={draft[r.key] ?? ""}
                onChange={(e) => { setDraft({ ...draft, [r.key]: e.target.value }); setSaved(false); }}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            ) : (
              <input
                value={draft[r.key] ?? ""}
                onChange={(e) => { setDraft({ ...draft, [r.key]: e.target.value }); setSaved(false); }}
                style={inputStyle}
              />
            )}
          </div>
        ))}
        {error && <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "10px" }}>{error}</p>}
        {saved && !error && <p style={{ color: "var(--success)", fontSize: "13px", marginBottom: "10px" }}>Saved. Refresh the public site to see it live.</p>}
        <button onClick={saveAll} disabled={saving || !dirty} style={{ ...btnGold, opacity: saving || !dirty ? 0.5 : 1 }}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
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
