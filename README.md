# reset.evavogel.com — Audition Nerves Reset Landingpage

Eine einzelne statische Seite mit genau einem Ziel: E-Mail-Eintragung.
Kein Framework, kein Build. Einzige Fremddomain ist der Meta Pixel, der
asynchron nachlaedt und den Seitenaufbau nicht blockiert.

```
index.html                        alles drin: Markup, Critical CSS, JS (~15 KB)
deploy/CNAME                      reset.evavogel.com — erst nach DNS ins Root schieben
robots.txt
assets/freebie-mockup.webp        56 KB — Eva im Studio, 960x540
assets/freebie-mockup.jpg         78 KB — Fallback fuer alte Browser
assets/fonts/playfair-display-latin.woff2   30 KB, subsetted, self-hosted
worker/worker.js                  Cloudflare Worker -> Flodesk (3 Schritte:
                                  Subscriber anlegen, Segmente zuweisen,
                                  in den Workflow einschreiben)
worker/wrangler.toml
worker/README.md                  Deploy-Anleitung fuer den Worker
tools/optimize-mockup.sh          Thumbnail neu komprimieren
tools/make-placeholder-mockup.py  erzeugt einen Platzhalter, falls mal keins da ist
```

## Was schon fertig ist

- Ad-Congruenz: Die H1 ist wortgleich der Ad-Hook, direkt darunter die Aufloesung.
- Alles Wesentliche bis zum CTA-Button passt auf 375 x 620 px — das ist die
  nutzbare Hoehe im Instagram-In-App-Browser auf einem iPhone. Nachgemessen
  auf 390x640 (Button endet bei 563 px), 360x600 (556) und 320x568 (555);
  die Headline bleibt ueberall dreizeilig.

  **Wer die Headline-Groesse, die Bildgroesse oder die Textlaengen darueber
  aendert, muss das nachmessen.** Der CTA-Button ohne Scrollen ist der
  wichtigste Conversion-Faktor der Seite.
- Formular mit Validierung, Ladezustand, Doppel-Submit-Sperre, Honeypot.
- **Demo-Modus aktiv**: Solange keine Worker-URL eingetragen ist, wird der Submit
  nur in die Browser-Konsole geloggt. Die Seite ist damit komplett testbar.
- Genau ein Font-File (Playfair Display, subsetted, self-hosted, preloaded).
  Fliesstext laeuft auf System-Sans — 0 Byte Download.
- Keine Cookies, kein Banner. Der Kommentar im `<head>` markiert, wo der Pixel
  hinkommt und wo ein Consent-Gate nachzuruesten waere.

## Gewichte

| Datei | Uebertragen |
|---|---|
| index.html (inkl. CSS + JS, gzip) | 6 KB |
| Font (woff2, subsetted) | 30 KB |
| Thumbnail (WebP, 960x540) | 56 KB |
| **Gesamt First Load** | **91 KB** in 3 eigenen Requests |

Dazu kommt der Meta Pixel von `connect.facebook.net` (~80 KB). Er laedt
asynchron und blockiert den Seitenaufbau nicht, taucht in Lighthouse aber als
Fremdressource auf.

Das JPG wird nur von Browsern ohne WebP-Unterstuetzung geladen und zaehlt
praktisch nie mit.

---

# Checkliste bis Live

## 1. Eigenes Repo anlegen

Der Ordner ist ein kompletter Repo-Root. Wichtig: GitHub Pages erlaubt **eine
CNAME-Datei pro Repo**, deshalb muss das ein eigenes Repo werden, nicht ein
Unterordner der SMBL-Seite.

Repo auf github.com/new anlegen (Name `eva-vogel-reset-lp`, **public** — GitHub
Pages braucht auf dem Gratis-Plan ein oeffentliches Repo, **kein** README/
.gitignore/Lizenz ankreuzen), dann:

```bash
git init -b main && git add -A && git commit -m "Reset landing page"
```

```bash
git remote add origin git@github.com:managementsmbl-cpu/eva-vogel-reset-lp.git && git push -u origin main
```

## 2. GitHub Pages aktivieren

1. Repo → **Settings → Pages**
2. Source: **Deploy from a branch**, Branch: `main`, Ordner: `/ (root)` → Save
3. Nach 1–2 Minuten laeuft die Seite unter
   `https://managementsmbl-cpu.github.io/eva-vogel-reset-lp/`

Die eigene Domain kommt bewusst erst in Schritt 3 dazu — siehe
[deploy/README.md](deploy/README.md).

## 3. DNS-Eintrag setzen, dann Domain scharfschalten

Beim DNS-Anbieter von evavogel.com (das ist Evas Domain — ggf. braucht ihr
dafuer ihren Zugang oder den ihres Webmasters):

| Typ | Name | Wert | TTL |
|---|---|---|---|
| CNAME | `reset` | `managementsmbl-cpu.github.io.` | 3600 |

Kein A-Record noetig, `reset` ist eine Subdomain. Pruefen:

```bash
dig +short reset.evavogel.com
```

Kommt eine `github.io`-Adresse zurueck, die CNAME-Datei ins Root schieben:

```bash
git mv deploy/CNAME CNAME && git commit -m "Custom Domain aktivieren" && git push
```

Danach Settings → Pages → **Enforce HTTPS** anhaken, sobald das Zertifikat
ausgestellt ist (5–20 Min.).

## 4. Worker deployen (Key + Segment-ID)

Vollstaendige Anleitung: [worker/README.md](worker/README.md). Kurzfassung:

```bash
cd worker && npx wrangler login && npx wrangler secret put FLODESK_API_KEY
```

Vorher in `worker/wrangler.toml` die `FLODESK_SEGMENT_ID` eintragen
(Flodesk → Audience → Segments → „Audition Nerves Reset" → ID aus der URL).

```bash
cd worker && npx wrangler deploy
```

Die ausgegebene URL in `index.html` ganz unten eintragen:

```js
var CONFIG = {
  workerUrl:   "https://eva-reset-optin.<subdomain>.workers.dev",
  redirectUrl: "https://evavogel.com/your-reset",
  timeoutMs:   12000
};
```

## 5. Thumbnail — erledigt, aber gut zu wissen

Drin ist das echte Bild („FREE RESET", Eva im Studio), 960x540, WebP 56 KB.
Falls es spaeter getauscht wird:

```bash
./tools/optimize-mockup.sh ~/Downloads/neues-thumbnail.png
```

Zwei Regeln fuers Motiv:

- **16:9**, sonst `width`/`height` im `<img>` in `index.html` mit anpassen,
  weil sonst das Layout beim Laden springt.
- **Unten links nichts Wichtiges** — dort sitzt der Play-Button. Er steht
  bewusst nicht mittig, weil dort die Schrift und Evas Gesicht sind.

Ohne Tools auf dem Rechner: [squoosh.app](https://squoosh.app) → WebP, Quality
86, Breite 960 → als `assets/freebie-mockup.webp` speichern, dazu ein JPG
gleicher Groesse als `assets/freebie-mockup.jpg`.

## 6. Meta Pixel — erledigt

Pixel `27045961755077839` liegt im `<head>`, **nur PageView**. Es ist derselbe
Pixel wie auf `evavogel.com/your-reset`, bewusst kein zweiter: Meta lernt pro
Pixel, zwei halbieren die Datenbasis und machen Zielgruppen wie
"Landingpage gesehen, aber nicht eingetragen" unmoeglich.

**Kein Lead-Event auf dieser Seite.** Das feuert auf `/your-reset`. Wuerde es
hier zusaetzlich feuern, zaehlte Meta jede Anmeldung doppelt und die Kosten pro
Lead saehen halb so hoch aus, wie sie sind. Wer das aendern will, aendert es
auf einer der beiden Seiten — nie auf beiden.

Geprueft im Browser: genau ein Aufruf an `facebook.com/tr` mit `ev=PageView`
und der richtigen ID, kein Lead.

Offen: Der Pixel muss noch in `evavogel.com/legal` ergaenzt werden.

Zusaetzlich in der Ad: als Ziel-URL `https://reset.evavogel.com/` eintragen,
UTM-Parameter optional (die Seite ignoriert sie, Flodesk sieht sie nicht).

## 7. Rechtstexte pruefen

Die Seite verlinkt auf drei Adressen auf evavogel.com. **Slugs pruefen und ggf.
in `index.html` korrigieren**:

- `https://evavogel.com/legal` — Datenschutzerklaerung (Consent-Zeile
  „Privacy Policy" + Footer-Link „Datenschutz"). Geprueft: erreichbar, nennt
  den „Audition Nerves Reset" und Flodesk bereits namentlich.
- `https://evavogel.com/impressum` — geprueft, erreichbar
- `https://evavogel.com/your-reset` — Redirect-Ziel nach dem Optin,
  geprueft, erreichbar

Offen: In der Datenschutzerklaerung muss der Meta-Pixel ergaenzt werden,
sobald er live ist. Die Landingpage selbst setzt keine Cookies.

## 8. Livetest

- [ ] `https://reset.evavogel.com` laedt, Schloss-Symbol ist da (HTTPS aktiv)
- [ ] Auf dem echten iPhone **aus Instagram heraus** oeffnen (Link in Story an
      sich selbst schicken): CTA-Button ohne Scrollen sichtbar?
- [ ] Gleicher Test auf Android/Facebook-In-App-Browser
- [ ] Tap auf das Thumbnail → scrollt zum Formular, Tastatur geht auf
- [ ] Leeres Formular absenden → freundliche Fehlermeldung, kein Reload
- [ ] Kaputte E-Mail (`test@@x`) → Fehlermeldung
- [ ] **Test-Opt-in**: echte Adresse (`deinname+test1@gmail.com`) eintragen →
      Redirect auf `https://evavogel.com/your-reset` landet
- [ ] In Flodesk: Kontakt liegt im Segment „Audition Nerves Reset", Vorname stimmt
- [ ] Freebie-Mail kommt an (Spam-Ordner mitpruefen)
- [ ] Zweimal schnell auf den Button tippen → nur ein Eintrag in Flodesk
- [ ] Events Manager → Test Events: `PageView` und `Lead` kommen an
- [ ] PageSpeed Insights (Mobile) auf der Live-URL: Performance 95+
      https://pagespeed.web.dev/analysis?url=https://reset.evavogel.com

Nach dem Test die Test-Kontakte in Flodesk wieder loeschen, damit die
Segment-Statistik sauber bleibt.

---

## Wenn spaeter etwas geaendert wird

- **Headline-Text**: Muss weiter wortgleich zum Ad-Hook sein. Aendert sich die
  Anzeige, aendert sich die H1 mit — das ist der wichtigste Conversion-Hebel.
- **Weitere Felder im Formular**: Jedes zusaetzliche Feld kostet Opt-ins.
  Vorname + E-Mail ist bereits ein Feld mehr als das Minimum.
- **Links hinzufuegen**: Bewusst gibt es keine Navigation, keine Social Icons,
  keinen Link zur Hauptseite. Jeder Ausgang ist eine verlorene E-Mail.
- **Font tauschen**: Nur ein woff2-File, subsetted. Ein zweiter Schnitt
  (z. B. Italic) kostet ~25 KB und einen weiteren Request.
