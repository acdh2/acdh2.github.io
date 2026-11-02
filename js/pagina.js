/* =========================================================
   Pagina: bouwt de opmaak van de fasepagina's automatisch op.

   Elke fase heeft een eigen map, bijvoorbeeld doelgroep-ontdekken/.
   Aan de naam van de map ziet dit script bij welke fase een pagina
   hoort (titel bovenin en kleur).

   Een fasemap kan ook een eigen map bevatten voor een groter onderwerp
   met deelonderwerpen, bijvoorbeeld ontwerp-bewijzen/vectorworks-gebruiken/.
   Die map werkt hetzelfde (index.html is het overzicht), en de naam
   ervan komt klein onder de fasenaam bovenin
   ("vectorworks-gebruiken" wordt "Vectorworks gebruiken").

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

      Staat er in de body alleen tekst (geen tags), dan wordt die gelezen
      als Markdown en eerst omgezet naar bovenstaande HTML:
        # Titel               ## Tussenkop          ### Kleine kop
        - punt  of  * punt    1. genummerd punt     **vet**  *schuin*
        foto.png              (regel met alleen een afbeelding)
        ![beschrijving](foto.png)
        Tekst: https://...    (laatste regel met een link: QR-code)
        Een witregel begint een nieuwe alinea, een enkele Enter een nieuwe regel.

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
  var isOverzicht = bestand === '' || bestand === 'index.html';

  // Zoek de fasemap in het pad; een map daaronder is een sectie
  var faseIndex = -1;
  for (var i = pad.length - 2; i >= 0; i--) {
    if (FASES[pad[i]]) { faseIndex = i; break; }
  }
  var fase = faseIndex >= 0 ? FASES[pad[faseIndex]] : { naam: '', kleur: '#ffffff' };
  // Plek van de fase in het wiel: 0 = bovenaan, daarna met de klok mee
  var fasePlek = faseIndex >= 0 ? Object.keys(FASES).indexOf(pad[faseIndex]) : -1;
  var sectie = faseIndex >= 0 && faseIndex < pad.length - 2 ? maakNaam(pad[pad.length - 2]) : '';

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

  // "vectorworks-gebruiken" wordt "Vectorworks gebruiken"
  function maakNaam(mapnaam) {
    var naam = mapnaam.replace(/-/g, ' ');
    return naam.charAt(0).toUpperCase() + naam.slice(1);
  }

  function maakLogo(bestand, klasse) {
    var img = maak('img', klasse);
    img.src = basis + bestand;
    img.alt = '';
    img.onerror = function () { this.style.visibility = 'hidden'; };
    return img;
  }

  function maakSvg(tag, attributen) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var naam in attributen) el.setAttribute(naam, attributen[naam]);
    return el;
  }

  // Aanwijzer over het IDT-logo: het stuk van de grijze ring van deze fase
  // in de fasekleur, met de rode pin uit het wiel ("je bevindt je hier").
  // Maten in de eenheden van logo1.svg (127 breed, ring van straal 32.5 tot 63.5).
  function maakAanwijzer() {
    var m = 63.5, buiten = 63.5, binnen = 32.5;
    var van = (-90 + 72 * fasePlek) * Math.PI / 180;
    var tot = van + 72 * Math.PI / 180;
    var midden = (van + tot) / 2;
    function punt(straal, hoek) {
      return (m + straal * Math.cos(hoek)).toFixed(2) + ' ' + (m + straal * Math.sin(hoek)).toFixed(2);
    }

    var svg = maakSvg('svg', { 'class': 'logo logo-aanwijzer', viewBox: '0 0 127 127', 'aria-hidden': 'true' });
    svg.appendChild(maakSvg('path', {
      fill: fase.kleur,
      d: 'M ' + punt(buiten, van) + ' A ' + buiten + ' ' + buiten + ' 0 0 1 ' + punt(buiten, tot) +
         ' L ' + punt(binnen, tot) + ' A ' + binnen + ' ' + binnen + ' 0 0 0 ' + punt(binnen, van) + ' Z'
    }));

    // Pin met de punt in het gekleurde vlak, de kop naar buiten gericht
    var pin = maakSvg('g', {
      transform: 'translate(' + punt(48, midden) + ') rotate(' + (midden * 180 / Math.PI + 90) + ') scale(1.4)'
    });
    pin.appendChild(maakSvg('path', {
      fill: '#bd1520',
      d: 'M 0 0 C -6 -7 -13 -12 -13 -20 A 13 13 0 1 1 13 -20 C 13 -12 6 -7 0 0 Z'
    }));
    pin.appendChild(maakSvg('circle', { cx: 0, cy: -20, r: 5.5, fill: '#ffffff' }));
    svg.appendChild(pin);
    return svg;
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
  // en eventueel daaronder de naam van de sectie.
  // Een tik op het IDT-logo gaat terug, net als de Terug-knop.
  function maakKop(titel, terug) {
    var vlak = maak('div', 'title-text fase-titel');
    vlak.appendChild(maak('div', '', titel));
    if (sectie) vlak.appendChild(maak('div', 'fase-sectie', sectie));

    var idtLogo = maak('a', 'logo-terug');
    idtLogo.href = terug;
    idtLogo.setAttribute('aria-label', 'Terug');
    idtLogo.appendChild(maakLogo('logo1.svg', 'logo'));
    if (fasePlek >= 0) idtLogo.appendChild(maakAanwijzer());

    var kop = maak('header', 'header-container');
    kop.append(idtLogo, vlak, maakLogo('logo2.svg', 'logo logo-right'));
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
    // Terug naar het wiel, of vanuit een sectie naar het overzicht van de fase
    var terug = sectie ? '../index.html' : basis + 'index.html';
    body.append(maakKop(fase.naam || titelTekst, terug), tegels, maakTerug(terug));
  }

  // ---------- Markdown: platte tekst omzetten naar HTML ----------

  var AFBEELDING = /\.(png|jpe?g|gif|webp|svg)$/i;

  // De tekst die los in de body staat (opmerkingen tellen niet mee)
  function losseTekst(body) {
    var tekst = '';
    Array.prototype.forEach.call(body.childNodes, function (node) {
      if (node.nodeType === Node.TEXT_NODE) tekst += node.textContent;
    });
    return tekst;
  }

  function isMarkdown(body) {
    var heeftTags = Array.prototype.some.call(body.children, function (el) {
      return el.tagName !== 'SCRIPT';
    });
    return !heeftTags && losseTekst(body).trim() !== '';
  }

  // **vet**, *schuin* en [tekst](adres) binnen een regel
  function voegRegelToe(el, tekst) {
    tekst.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/).forEach(function (deel, i) {
      if (!deel) return;
      var m;
      if (i % 2 === 0) {
        el.appendChild(document.createTextNode(deel));
      } else if ((m = deel.match(/^\[(.+)\]\((.+)\)$/))) {
        var link = maak('a', '', m[1]);
        link.setAttribute('href', m[2]);
        el.appendChild(link);
      } else if (deel.charAt(1) === '*') {
        el.appendChild(maak('strong', '', deel.slice(2, -2)));
      } else {
        el.appendChild(maak('em', '', deel.slice(1, -1)));
      }
    });
  }

  function maakRegel(tag, tekst) {
    var el = document.createElement(tag);
    voegRegelToe(el, tekst);
    return el;
  }

  // Laatste regel met een link: "Tekst: https://..." of "[Tekst](https://...)"
  function leesLink(regel) {
    if (/^(#|[-*+]\s|\d+[.)]\s)/.test(regel)) return null;
    var m = regel.match(/^\[(.+)\]\((https?:\/\/\S+)\)$/) || regel.match(/^(.*?)\s*(https?:\/\/\S+)$/);
    return m ? { tekst: m[1].trim(), adres: m[2] } : null;
  }

  function zetMarkdownOm(body) {
    var regels = losseTekst(body).split(/\r?\n/).map(function (r) { return r.trim(); });
    while (regels.length && !regels[regels.length - 1]) regels.pop();

    var link = regels.length ? leesLink(regels[regels.length - 1]) : null;
    if (link) regels.pop();

    var blokken = [];
    var alinea = null, lijst = null;

    regels.forEach(function (regel) {
      var m;
      if (!regel) {
        // Witregel: nieuwe alinea of nieuwe lijst
        alinea = lijst = null;
      } else if ((m = regel.match(/^(#{1,3})\s+(.*)$/))) {
        alinea = lijst = null;
        blokken.push(maakRegel('h' + m[1].length, m[2]));
      } else if ((m = regel.match(/^!\[(.*)\]\((\S+)\)$/)) || (AFBEELDING.test(regel) && !/\s/.test(regel))) {
        alinea = lijst = null;
        var img = document.createElement('img');
        img.setAttribute('src', m ? m[2] : regel);
        img.alt = m ? m[1] : '';
        blokken.push(img);
      } else if ((m = regel.match(/^([-*+]|\d+[.)])\s+(.*)$/))) {
        alinea = null;
        var soort = /\d/.test(m[1]) ? 'OL' : 'UL';
        if (!lijst || lijst.tagName !== soort) {
          lijst = document.createElement(soort);
          blokken.push(lijst);
        }
        lijst.appendChild(maakRegel('li', m[2]));
      } else if (alinea) {
        // Enkele Enter: nieuwe regel binnen dezelfde alinea
        alinea.appendChild(document.createElement('br'));
        voegRegelToe(alinea, regel);
      } else {
        lijst = null;
        alinea = maakRegel('p', regel);
        blokken.push(alinea);
      }
    });

    if (link) {
      var a = maak('a', '', link.tekst);
      a.setAttribute('href', link.adres);
      blokken.push(a);
    }

    // Tekst vervangen door de opgebouwde HTML
    Array.prototype.slice.call(body.childNodes).forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
    blokken.forEach(function (el) { body.appendChild(el); });
  }

  // ---------- Onderwerp: titel, afbeelding, tekst en eventueel QR-code ----------

  function bouwOnderwerp(body) {
    if (isMarkdown(body)) zetMarkdownOm(body);

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

    body.append(maakKop(fase.naam, 'index.html'), inhoud, maakTerug('index.html'));
  }
})();
