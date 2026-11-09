import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/cashfree/config-check — Admin-only diagnostics for the
// "payment failed: authentication failed" problem.
// It does NOT call Cashfree and NEVER returns any key value (or prefix).
// It returns only: the normalised environment (PROD or SANDBOX), whether
// APP_ID and SECRET_KEY are set (booleans), their trimmed lengths
// (numbers), and whether they contain whitespace (booleans). That is
// enough for Admin to tell a pasted-with-spaces key or a missing key
// apart from a wrong-environment key, without exposing anything.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (String(profile?.role || "") !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const appIdRaw = process.env.CASHFREE_APP_ID || "";
  const secretRaw = process.env.CASHFREE_SECRET_KEY || "";
  const appId = appIdRaw.trim();
  const secret = secretRaw.trim();
  const envRaw = (process.env.CASHFREE_ENV || "").trim().toUpperCase();
  const env = envRaw === "PROD" || envRaw === "PRODUCTION" ? "PROD" : "SANDBOX";

  return NextResponse.json({
    env,
    env_raw_is_prod_like: envRaw === "PROD" || envRaw === "PRODUCTION",
    app_id_set: appId.length > 0,
    app_id_length: appId.length,
    app_id_has_whitespace: /\s/.test(appIdRaw),
    secret_key_set: secret.length > 0,
    secret_key_length: secret.length,
    secret_key_has_whitespace: /\s/.test(secretRaw),
  });
}
