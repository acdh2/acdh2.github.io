# IDT-app voor het Samsung Flip-scherm

Startpagina met het ontwerpwiel, per fase een overzicht met tegels, en per tegel een pagina met tekst, afbeelding, video en QR-code.

## Pagina's bewerken (beheerders)

Ga naar **https://app.pagescms.org**, log in en open deze repository. Onder **Pagina's** staan de vijf fases.

- **Pagina bewerken:** klik op de pagina, pas de velden aan en klik op **Save**. Na een minuut of twee staat de wijziging op het scherm.
- **Pagina toevoegen:** klik op het **+** naast een fase (of naast "Vectorworks gebruiken"). Vul de titel in en zet bij **Plek in het overzicht** het nummer van de tegel.
- **Afbeelding toevoegen of vervangen:** klik in het veld **Afbeelding** en upload een nieuwe, of kies er een uit **Media**.
- **Link en QR-code:** vul **Link (wordt een QR-code)** in. De QR-code wordt automatisch gemaakt.
- **Video:** plak een YouTube- of Vimeo-link in het veld **Video**, of als losse regel in de tekst.
- **Tegel die nog niet af is:** zet **Pagina is klaar** uit. De tegel staat dan wel in het overzicht, maar is niet aan te tikken.

Een overzicht vult zichzelf aan tot minstens zes tegels. Ontbreken er tegels, dan verschijnen er lege tegels met "Onderwerp".

## Hoe het werkt

| Wat | Waar |
|---|---|
| Inhoud van alle pagina's | `_onderwerpen/<fase>/<pagina>.md` (Markdown met velden bovenaan) |
| Overzicht van een fase of onderdeel | `_onderwerpen/<fase>/index.md` |
| Afbeeldingen | `media/` |
| HTML van elke pagina | `_layouts/pagina.html` |
| Opmaak, logo's, video's, QR-codes | `js/pagina.js` en `css/style.css` |
| Startpagina met het wiel | `index.html` |
| Instellingen Pages CMS | `.pages.yml` |

GitHub Pages bouwt de site met Jekyll: `_onderwerpen/ontwerp-testen/vr-sketch.md` wordt `/ontwerp-testen/vr-sketch.html`.

Een nieuwe fase toevoegen gaat niet via Pages CMS: maak een map in `_onderwerpen` met een `index.md`, en zet de fase met kleur in `js/pagina.js` en in het wiel in `index.html`.

### Lokaal bekijken

Daarvoor heb je Jekyll nodig (`gem install jekyll kramdown-parser-gfm`). Start in deze map:

```
jekyll serve
```

en open http://localhost:4000. Je kunt ook gewoon opslaan en het na een minuut online bekijken.
