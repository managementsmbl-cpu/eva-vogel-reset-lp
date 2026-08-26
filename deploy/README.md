# CNAME — bewusst noch nicht aktiv

Solange diese Datei hier liegt, laeuft die Seite unter der GitHub-Adresse
`https://managementsmbl-cpu.github.io/eva-vogel-reset/` und ist sofort
anschaubar.

Sobald sie im Repo-Root liegt, schaltet GitHub Pages auf die eigene Domain um
und leitet die github.io-Adresse dorthin weiter. Ist der DNS-Eintrag dann noch
nicht gesetzt, ist die Seite fuer niemanden erreichbar.

## Reihenfolge

1. DNS setzen: CNAME `reset` -> `managementsmbl-cpu.github.io.`
2. Warten, bis `dig +short reset.evavogel.com` eine github.io-Adresse liefert
3. Erst dann:

```bash
git mv deploy/CNAME CNAME && git commit -m "Custom Domain aktivieren" && git push
```

4. Repo -> Settings -> Pages -> "Enforce HTTPS" anhaken, sobald das
   Zertifikat ausgestellt ist (dauert 5-20 Minuten)
