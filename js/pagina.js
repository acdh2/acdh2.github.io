/* =========================================================
   Pagina: bouwt de opmaak van de fasepagina's automatisch op.

   Elke fase heeft een eigen map, bijvoorbeeld doelgroep-ontdekken/.
   Aan de naam van de map ziet dit script bij welke fase een pagina
   hoort (titel bovenin en kleur).

   Er zijn twee soorten pagina's:

   1. Overzicht (index.html in een fasemap)
        Elke <a> wordt een tegel.
        <a href="observation.html"><img src="..."> Observation (CMD)</a>
        Zonder href is de tegel (nog) niet aanklikbaar.

   2. Onderwerp (elk ander bestand in een fasemap)
        <h1>        de titel in het witte vlak
        <img>       de afbeelding
        <a href>    als laatste: de link, hiervan komt een QR-code (optioneel)
        de rest     koppen, alinea's en lijstjes

   Om de inhoud van een pagina te wijzigen hoeft dit bestand
   niet aangepast te worden.
   ========================================================= */

(function () {
  'use strict';

  // Een nieuwe fase toevoegen? Maak een map met deze naam en zet hem hier bij.
  var FASES = {
    'doelgroep-ontdekken': { naam: 'Doelgroep ontdekken', kleur: '#fcdc0e' },
    'kaders-stellen':      { naam: 'Kaders stellen',      kleur: '#f2aa28' },
    'idee-bedenken':       { naam: 'Idee bedenken',       kleur: '#96d0e6' },
    'ontwerp-testen':      { naam: 'Ontwerp testen',      kleur: '#0a997d' },
    'ontwerp-bewijzen':    { naam: 'Ontwerp bewijzen',    kleur: '#cf0852' }
  };

  // Map van het project, afgeleid van waar dit script staat
  var basis = document.currentScript.src.replace(/js\/[^\/]*$/, '');
  var pad = decodeURIComponent(location.pathname).split('/');
  var bestand = pad[pad.length - 1];
  var fase = FASES[pad[pad.length - 2]] || { naam: '', kleur: '#ffffff' };
  var isOverzicht = bestand === '' || bestand === 'index.html';

  var root = document.documentElement;

  // Pagina verbergen tot de opmaak klaar is, zodat de ruwe inhoud niet even zichtbaar is
  root.style.visibility = 'hidden';
  var toonPagina = function () { root.style.visibility = ''; };
  // Vangnet: toon de pagina hoe dan ook na 3 seconden
  setTimeout(toonPagina, 3000);

  // Wacht op drie dingen: de CSS, de QR-bibliotheek en de inhoud van de pagina
  var wachtOp = 3;
  function stapKlaar() {
    wachtOp--;
    if (wachtOp === 0) {
      try {
        bouwPagina();
      } finally {
        toonPagina();
      }
    }
  }

  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = basis + 'css/style.css';
  css.onload = css.onerror = stapKlaar;
  document.head.appendChild(css);

  var qrScript = document.createElement('script');
  qrScript.src = basis + 'js/qrcode.min.js';
  qrScript.onload = qrScript.onerror = stapKlaar;
  document.head.appendChild(qrScript);

  document.addEventListener('DOMContentLoaded', stapKlaar);


  function maak(tag, klasse, tekst) {
    var el = document.createElement(tag);
    if (klasse) el.className = klasse;
    if (tekst) el.textContent = tekst;
    return el;
  }

  function maakLogo(bestand, klasse) {
    var img = maak('img', klasse);
    img.src = basis + bestand;
    img.alt = '';
    img.onerror = function () { this.style.visibility = 'hidden'; };
    return img;
  }

  // Haalt een element uit de pagina. Blijft er een lege ouder over
  // (bijvoorbeeld een <p> rond een <img>), dan verdwijnt die ook.
  function haalWeg(el) {
    if (!el) return null;
    var ouder = el.parentNode;
    el.remove();
    if (ouder !== document.body && !ouder.textContent.trim() && !ouder.querySelector('img')) {
      ouder.remove();
    }
    return el;
  }

  // Kopregel: logo's in de hoeken, gekleurd vlak met de naam van de fase
  function maakKop(titel) {
    var kop = maak('header', 'header-container');
    kop.append(
      maakLogo('logo1.svg', 'logo'),
      maak('div', 'title-text fase-titel', titel),
      maakLogo('logo2.svg', 'logo logo-right')
    );
    return kop;
  }

  function maakTerug(href) {
    var knop = maak('a', 'terug-knop', 'Terug');
    knop.href = href;
    return knop;
  }

  function bouwPagina() {
    var body = document.body;
    body.classList.add('fasepagina', isOverzicht ? 'overzicht' : 'onderwerp');
    body.style.setProperty('--fase-kleur', fase.kleur);

    if (isOverzicht) {
      bouwOverzicht(body);
    } else {
      bouwOnderwerp(body);
    }
  }

  // ---------- Overzicht: tegels naar de onderwerpen ----------

  function bouwOverzicht(body) {
    var titel = body.querySelector('h1');
    var titelTekst = (titel && titel.textContent.trim()) || fase.naam;
    document.title = titelTekst;

    var tegels = maak('main', 'tegels');
    Array.prototype.slice.call(body.querySelectorAll('a')).forEach(function (link) {
      var img = link.querySelector('img');
      if (img) img.remove();
      var href = link.getAttribute('href');

      // Met href een aanklikbare tegel, zonder href een lege plek voor later
      var tegel = maak(href ? 'a' : 'div', 'tegel' + (href ? '' : ' tegel-leeg'));
      if (href) tegel.href = href;
      tegel.appendChild(maak('div', 'tegel-titel', link.textContent.trim()));
      if (img && img.getAttribute('src')) {
        img.className = 'tegel-afbeelding';
        img.alt = img.alt || '';
        img.addEventListener('error', function () { img.remove(); });
        if (img.complete && !img.naturalWidth) img.remove();
        else tegel.appendChild(img);
      }
      tegels.appendChild(tegel);
    });

    body.textContent = '';
    body.append(maakKop(titelTekst), tegels, maakTerug(basis + 'index.html'));
  }

  // ---------- Onderwerp: titel, afbeelding, tekst en eventueel QR-code ----------

  function bouwOnderwerp(body) {
    var titel = haalWeg(body.querySelector('h1'));
    var afbeelding = haalWeg(body.querySelector('img'));
    // Alleen een losse link onderaan wordt een QR-code; links in de tekst blijven staan
    var link = body.lastElementChild && body.lastElementChild.matches('a[href]')
      ? haalWeg(body.lastElementChild) : null;

    var titelTekst = titel ? titel.textContent.trim() : '';
    document.title = titelTekst || fase.naam;

    // Alles wat overblijft komt in het tekstdeel
    var tekst = maak('div', 'card-text');
    Array.prototype.slice.call(body.childNodes).forEach(function (node) {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'SCRIPT') {
        tekst.appendChild(node);
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        // Losse tekst zonder <p> eromheen
        tekst.appendChild(maak('p', '', node.textContent.trim()));
        node.remove();
      } else {
        node.remove();
      }
    });

    var kaart = maak('section', 'card onderwerp-kaart');
    kaart.appendChild(maak('h2', 'onderwerp-titel', titelTekst));
    if (afbeelding && afbeelding.getAttribute('src')) {
      afbeelding.className = 'onderwerp-afbeelding';
      afbeelding.addEventListener('error', function () { afbeelding.remove(); });
      if (!(afbeelding.complete && !afbeelding.naturalWidth)) kaart.appendChild(afbeelding);
    }
    kaart.appendChild(tekst);

    var inhoud = maak('main', 'onderwerp-inhoud');
    inhoud.appendChild(kaart);

    // Link met QR-code. De link is op het scherm niet klikbaar,
    // zodat bezoekers de app niet per ongeluk verlaten.
    if (link) {
      var adres = link.getAttribute('href').trim();
      var linkBlok = maak('section', 'card card-qr');
      var linkTekst = maak('div', 'link-container');
      linkTekst.append(
        maak('div', 'link-title', link.textContent.trim() || 'Meer informatie:'),
        maak('div', 'target-url', adres)
      );
      linkBlok.appendChild(linkTekst);

      if (window.QRCode) {
        var qrCode = maak('div', 'qr-code');
        var qrHouder = maak('div', 'qr-container');
        qrHouder.appendChild(qrCode);
        linkBlok.appendChild(qrHouder);
        new QRCode(qrCode, {
          text: adres,
          width: 256,
          height: 256,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      }
      inhoud.appendChild(linkBlok);
    }

    body.append(maakKop(fase.naam), inhoud, maakTerug('index.html'));
  }
})();
