/* =========================================================
   Infopagina: bouwt de opmaak van pagina 1-5 automatisch op.

   De pagina's zelf bevatten alleen eenvoudige inhoud:
     <h1>        de titel bovenin, tussen de logo's
     <img>       de afbeelding in het bovenste blok
     <a href>    de link; hier wordt de QR-code van gemaakt (onderste blok)
     de rest     koppen, alinea's en lijstjes komen in het middelste blok

   Om de inhoud van een pagina te wijzigen hoeft dit bestand
   niet aangepast te worden.
   ========================================================= */

(function () {
  'use strict';

  // Map van het project, afgeleid van waar dit script staat
  var basis = document.currentScript.src.replace(/js\/[^\/]*$/, '');
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

  function bouwPagina() {
    var body = document.body;
    body.classList.add('infopagina');

    var titel = haalWeg(body.querySelector('h1'));
    var afbeelding = haalWeg(body.querySelector('img'));
    var links = body.querySelectorAll('a[href]');
    var link = haalWeg(links[links.length - 1]);

    var titelTekst = titel ? titel.textContent.trim() : '';
    if (!document.title) document.title = titelTekst;

    // Blok 2: alles wat overblijft komt in het tekstblok
    var tekstBlok = maak('section', 'card card-text');
    Array.prototype.slice.call(body.childNodes).forEach(function (node) {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'SCRIPT') {
        tekstBlok.appendChild(node);
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        // Losse tekst zonder <p> eromheen
        tekstBlok.appendChild(maak('p', '', node.textContent.trim()));
        node.remove();
      } else if (node.nodeType !== Node.ELEMENT_NODE) {
        node.remove();
      }
    });

    // Kopregel met logo's
    var kop = maak('header', 'header-container');
    kop.append(
      maakLogo('logo1.svg', 'logo'),
      maak('div', 'title-text', titelTekst),
      maakLogo('logo2.svg', 'logo logo-right')
    );

    // Blok 1: afbeelding, met een grijs vlak als die ontbreekt of niet laadt
    var afbeeldingBlok = maak('section', 'card card-image');
    var toonPlaceholder = function () {
      afbeeldingBlok.textContent = '';
      afbeeldingBlok.appendChild(maak('div', 'image-placeholder', 'Afbeelding ontbreekt'));
    };
    if (afbeelding && afbeelding.getAttribute('src')) {
      afbeeldingBlok.appendChild(afbeelding);
      afbeelding.addEventListener('error', toonPlaceholder);
      if (afbeelding.complete && !afbeelding.naturalWidth) toonPlaceholder();
    } else {
      toonPlaceholder();
    }

    var blokken = maak('main', 'content-grid');
    blokken.append(afbeeldingBlok, tekstBlok);

    // Blok 3: link met QR-code. De link is op het scherm niet klikbaar,
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
      blokken.appendChild(linkBlok);
    } else {
      blokken.classList.add('zonder-link');
    }

    body.append(kop, blokken);
  }
})();
