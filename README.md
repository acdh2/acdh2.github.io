# IDT-app voor het Samsung Flip-scherm

Startpagina met het ontwerpwiel, per fase een overzicht met tegels, en per tegel een pagina met tekst, afbeelding, video en QR-code.

## Pagina's bewerken (beheerders)

Ga op een laptop of telefoon naar **/beheer.html** van de site (bijvoorbeeld https://acdh2.github.io/beheer.html) en log in. Daarna zie je de gewone site, maar dan bewerkbaar:

- **Pagina toevoegen:** de **+**-tegel in een overzicht.
- **Pagina verwijderen:** het prullenbakje rechtsonder op een tegel.
- **Pagina bewerken:** tik op een tegel. Klik op de titel of de tekst om ze te wijzigen. In de tekst maakt **#** aan het begin van een regel een tussenkop en **\*** een opsomming. Onder de afbeelding staan knoppen om hem te vervangen of te wissen. Onderaan vul je het kopje en de link in; de QR-code komt vanzelf.
- Klik op **Opslaan** om de wijzigingen te bewaren, of op **Annuleren** om ze weg te gooien.

Na opslaan staat de wijziging na ongeveer een minuut op het scherm. Uitloggen kan linksonder.

Op het Flip-scherm ben je niet ingelogd; daar zie je gewoon de site.

De beheerserver moet één keer worden ingesteld: zie `beheer-worker/LEESMIJ.md`.

### Ook mogelijk: Pages CMS

Via **https://app.pagescms.org** kun je dezelfde pagina's ook bewerken, met extra instellingen (volgorde, video, andere tegeltekst) onder **Geavanceerd**.

## Hoe het werkt

| Wat | Waar |
|---|---|
| Inhoud van alle pagina's | `_onderwerpen/<fase>/<pagina>.md` (Markdown met velden bovenaan) |
| Overzicht van een fase of onderdeel | `_onderwerpen/<fase>/index.md` |
| Afbeeldingen | `media/` |
| HTML van elke pagina | `_layouts/pagina.html` |
| Opmaak, logo's, video's, QR-codes | `js/pagina.js` en `css/style.css` |
| Startpagina met het wiel | `index.html` |
| Beheer op de site | `beheer.html`, `bewerk.html`, `js/beheer.js`, `css/beheer.css` |
| Beheerserver (Cloudflare Worker) | `beheer-worker/` |
| Instellingen Pages CMS | `.pages.yml` |

GitHub Pages bouwt de site met Jekyll: `_onderwerpen/ontwerp-testen/vr-sketch.md` wordt `/ontwerp-testen/vr-sketch.html`.

Een nieuwe fase toevoegen gaat niet via Pages CMS: maak een map in `_onderwerpen` met een `index.md`, en zet de fase met kleur in `js/pagina.js` en in het wiel in `index.html`.

### Lokaal bekijken

Daarvoor heb je Jekyll nodig (`gem install jekyll kramdown-parser-gfm`). Start in deze map:

```
jekyll serve
```

en open http://localhost:4000. Je kunt ook gewoon opslaan en het na een minuut online bekijken.
