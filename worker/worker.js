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
 *   FLODESK_SEGMENT_IDS (Var)   — Komma-Liste der Segmente, in die der
 *                                 Kontakt soll (Reihenfolge egal)
 *   FLODESK_WORKFLOW_IDS (Var)  — Komma-Liste der Workflows, in die der
 *                                 Kontakt eingeschrieben wird
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

    const segmentIds = (env.FLODESK_SEGMENT_IDS || env.FLODESK_SEGMENT_ID || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const workflowIds = (env.FLODESK_WORKFLOW_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!env.FLODESK_API_KEY || segmentIds.length === 0) {
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

      // Flodesk adressiert Subscriber in der Segment-Route ueber die ID, nicht
      // ueber die E-Mail — mit der E-Mail im Pfad antwortet die API mit 404.
      // Die ID steht in der Antwort von Schritt 1.
      const created = await create.json().catch(() => ({}));
      const subscriberId = created.id;

      if (!subscriberId) {
        console.log("flodesk/subscribers ohne id", JSON.stringify(created).slice(0, 300));
        return json({ ok: true, warning: "no_subscriber_id" }, 200, cors);
      }

      // ---- 2) Segmente zuweisen --------------------------------------------
      // Wichtig: alle Segmente in EINEM Aufruf. Jedes Segment ist der Ausloeser
      // fuer den zugehoerigen Flodesk-Workflow — fehlt eines, laeuft die
      // entsprechende Mailstrecke nicht an.
      const segment = await fetch(
        `${FLODESK_API}/subscribers/${encodeURIComponent(subscriberId)}/segments`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ segment_ids: segmentIds }),
        }
      );

      if (!segment.ok) {
        const detail = await safeText(segment);
        console.log("flodesk/segments", segment.status, detail);
        // Der Subscriber ist angelegt, nur die Segment-Zuweisung hakt. Bewusst
        // kein harter Fehler: Der Besucher wird trotzdem auf die Video-Seite
        // weitergeleitet. Sichtbar wird es in `wrangler tail` und daran, dass
        // die Freebie-Automation nicht ausloest.
        return json({ ok: true, warning: "segment_assign_failed" }, 200, cors);
      }

      // ---- 3) In die Workflows einschreiben --------------------------------
      // Der entscheidende Schritt: Die Segment-Zuweisung allein startet KEINEN
      // Workflow. Ohne diesen Aufruf landet der Kontakt zwar in der Liste,
      // bekommt aber nie eine Mail.
      const failedWorkflows = [];

      for (const workflowId of workflowIds) {
        const enroll = await fetch(
          `${FLODESK_API}/workflows/${encodeURIComponent(workflowId)}/subscribers`,
          { method: "POST", headers, body: JSON.stringify({ id: subscriberId }) }
        );

        if (enroll.ok) continue;

        const detail = await safeText(enroll);

        // Wiederanmeldung: steckt schon drin, laeuft also bereits. Kein Fehler.
        if (detail.includes("active_subscriber_in_workflow")) continue;

        console.log("flodesk/workflows", workflowId, enroll.status, detail);
        failedWorkflows.push(workflowId);
      }

      if (failedWorkflows.length) {
        return json({ ok: true, warning: "workflow_enroll_failed" }, 200, cors);
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
