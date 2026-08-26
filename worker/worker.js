/**
 * Eva Vogel — "Audition Nerves Reset" Opt-in Worker
 * -------------------------------------------------
 * Nimmt {first_name, email} von reset.evavogel.com entgegen, legt den
 * Subscriber in Flodesk an und haengt ihn an das Segment "Audition Nerves Reset".
 *
 * Der Flodesk-API-Key liegt als Secret im Worker und taucht nie im Browser auf.
 *
 * Secrets / Variablen (siehe README.md):
 *   FLODESK_API_KEY   (Secret)  — Flodesk API Key
 *   FLODESK_SEGMENT_ID (Var)    — ID des Segments "Audition Nerves Reset"
 *   ALLOWED_ORIGINS   (Var)     — Komma-Liste erlaubter Origins
 */

const FLODESK_API = "https://api.flodesk.com/v1";

// Flodesk verlangt einen aussagekraeftigen User-Agent, sonst 403.
const USER_AGENT = "EvaVogelResetLanding (https://reset.evavogel.com)";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    // Wenn ALLOWED_ORIGINS leer ist, wird alles erlaubt (praktisch fuer den ersten Test).
    const originOk = allowed.length === 0 || allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk && origin ? origin : allowed[0] || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
    if (!originOk) return json({ error: "Forbidden origin" }, 403, cors);

    // ---- Eingabe pruefen -------------------------------------------------
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    const firstName = String(body.first_name || "").trim().slice(0, 80);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const honeypot = String(body.website || "").trim();

    // Bot hat das versteckte Feld ausgefuellt: freundlich "ok" melden, nichts speichern.
    if (honeypot) return json({ ok: true }, 200, cors);

    if (!firstName) return json({ error: "Please add your first name." }, 400, cors);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return json({ error: "Please check your email address." }, 400, cors);
    }

    if (!env.FLODESK_API_KEY || !env.FLODESK_SEGMENT_ID) {
      return json({ error: "Server not configured" }, 500, cors);
    }

    const auth = "Basic " + btoa(env.FLODESK_API_KEY + ":");
    const headers = {
      "Authorization": auth,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    };

    try {
      // ---- 1) Subscriber anlegen bzw. aktualisieren (Flodesk macht Upsert) ----
      const create = await fetch(`${FLODESK_API}/subscribers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email,
          first_name: firstName,
          // Optionale Zusatzfelder — nur senden, wenn sie in Flodesk als
          // Custom Field existieren, sonst lehnt die API sie ab:
          // custom_fields: { source: "reset-landing" },
        }),
      });

      if (!create.ok) {
        const detail = await safeText(create);
        console.log("flodesk/subscribers", create.status, detail);
        return json({ error: "Signup failed", status: create.status }, 502, cors);
      }

      // ---- 2) Segment "Audition Nerves Reset" zuweisen ----------------------
      const segment = await fetch(
        `${FLODESK_API}/subscribers/${encodeURIComponent(email)}/segments`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ segment_ids: [env.FLODESK_SEGMENT_ID] }),
        }
      );

      if (!segment.ok) {
        const detail = await safeText(segment);
        console.log("flodesk/segments", segment.status, detail);
        // Subscriber existiert bereits — nur die Segment-Zuweisung hakt.
        // Kein harter Fehler fuer den Nutzer, aber im Log sichtbar.
        return json({ ok: true, warning: "segment_assign_failed" }, 200, cors);
      }

      return json({ ok: true }, 200, cors);
    } catch (err) {
      console.log("worker error", String(err));
      return json({ error: "Upstream unavailable" }, 502, cors);
    }
  },
};

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
  });
}

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}
