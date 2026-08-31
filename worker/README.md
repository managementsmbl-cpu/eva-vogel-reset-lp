# Opt-in Worker — Deploy in 5 Minuten

Der Worker ist die einzige Stelle, die den Flodesk-API-Key kennt. Die Landingpage
schickt nur `{first_name, email}` dorthin.

## 1. Voraussetzungen

- Cloudflare-Account (kostenlos reicht: 100.000 Requests/Tag)
- Node.js auf dem Rechner
- Flodesk-API-Key: Flodesk → **Integrations → API** → Key erzeugen
- Segment-IDs: Flodesk → **Audience → Segments** → Segment öffnen → die ID
  steht in der Adresszeile (`.../segments/**64f...**`)

## 2. Segment-IDs und Origin eintragen

In `wrangler.toml`:

```toml
FLODESK_SEGMENT_IDS = "id-eins,id-zwei"
ALLOWED_ORIGINS     = "https://reset.evavogel.com"
```

**Wichtig:** Hier muessen dieselben Segmente stehen wie beim bestehenden
Anmeldeweg auf evavogel.com. Jedes Segment ist der Ausloeser fuer den
zugehoerigen Workflow — fehlt eines, laeuft die entsprechende Mailstrecke nicht
an, und der Anmelder bekommt nichts. Aktuell eingetragen:

| Segment | ID | Workflow |
|---|---|---|
| Audition Nerves Reset | `69d16ace4a086815315a4708` | Freebie-Strecke |
| Main Nurture | `69de589129f5238e07401f8d` | Nurture-Strecke |

Gegenprobe, welche Segmente ein bestehender Anmelder hat:

```bash
curl -s -u "$FLODESK_KEY:" -H "User-Agent: check" "https://api.flodesk.com/v1/subscribers?per_page=100" | python3 -m json.tool
```

## 3. Deployen

```bash
cd worker && npx wrangler login
```

```bash
cd worker && npx wrangler secret put FLODESK_API_KEY
```

(Key einfügen, Enter — er wird verschlüsselt gespeichert und ist danach nicht mehr auslesbar.)

```bash
cd worker && npx wrangler deploy
```

Am Ende gibt Wrangler die URL aus. Aktuell deployed:
`https://eva-reset-optin.smblmedia.workers.dev`

## 4. Landingpage scharfschalten

In `index.html` ganz unten im `CONFIG`-Block die URL eintragen:

```js
var CONFIG = {
  workerUrl:   "https://eva-reset-optin.smblmedia.workers.dev",
  redirectUrl: "https://evavogel.com/your-reset",
  timeoutMs:   12000
};
```

Solange `workerUrl` leer ist, läuft die Seite im Demo-Modus: Der Submit wird nur
in der Browser-Konsole geloggt, es wird nichts gesendet und nicht weitergeleitet.

## 5. Testen

```bash
curl -i -X POST https://eva-reset-optin.smblmedia.workers.dev \
  -H "Content-Type: application/json" \
  -H "Origin: https://reset.evavogel.com" \
  -d '{"first_name":"Test","email":"dein+test@gmail.com"}'
```

Erwartet: `HTTP/2 200` und `{"ok":true}`. Danach in Flodesk prüfen, ob der
Kontakt im Segment „Audition Nerves Reset" liegt.

Logs live mitlesen:

```bash
cd worker && npx wrangler tail
```

## Fehlercodes

| Antwort | Bedeutung |
|---|---|
| `400 Please add your first name.` | Feld leer |
| `400 Please check your email address.` | E-Mail-Format ungültig |
| `403 Forbidden origin` | Origin steht nicht in `ALLOWED_ORIGINS` |
| `500 Server not configured` | API-Key-Secret oder Segment-ID fehlt |
| `502 Signup failed` | Flodesk hat abgelehnt — Status und Antwort stehen in `wrangler tail` |
| `200 {"ok":true,"warning":"segment_assign_failed"}` | Kontakt angelegt, aber nicht im Segment. Der Besucher merkt nichts, die Freebie-Automation loest aber nicht aus. Ursache in `wrangler tail` nachsehen. |

**Flodesk-Eigenheit:** Die Segment-Route adressiert Subscriber ueber die
**Subscriber-ID**, nicht ueber die E-Mail. Mit der E-Mail im Pfad antwortet die
API mit 404. Der Worker liest die ID deshalb aus der Antwort von Schritt 1.

## Optional später

- **Rate-Limit**: Cloudflare → Security → WAF → Rate limiting rule auf die
  Worker-Route (z. B. 5 Requests pro Minute pro IP). Kein Code nötig.
- **Turnstile**: Falls doch Spam-Anmeldungen kommen, Cloudflare Turnstile
  einbauen (unsichtbarer Modus, ca. 2 KB JS) und den Token im Worker prüfen.
- **Double Opt-in**: In Flodesk am Segment/Workflow einstellen, nicht im Worker.
