/* =========================================================
   Beheer: pagina's toevoegen, bewerken en verwijderen vanuit de site.

   Wordt alleen geladen als je bent ingelogd via beheer.html
   (op het Flip-scherm dus nooit). Opslaan gaat via een kleine
   Cloudflare Worker (beheer-worker/worker.js) naar GitHub; daarna
   bouwt GitHub Pages de site opnieuw (ongeveer een minuut).

   - Overzicht: tegels uit de actuele inhoud, een +-tegel en een
     prullenbak per tegel.
   - bewerk.html?pad=fase/pagina: titel, afbeelding, tekst en link
     bewerken, met Opslaan en Annuleren.
   ========================================================= */

(function () {
  'use strict';
  if (window.IDT_BEHEER) return;
  window.IDT_BEHEER = true;

  // Adres van de Cloudflare Worker (zie beheer-worker/LEESMIJ.md)
  var API = 'https://idt-beheer.WORKER-SUBDOMEIN.workers.dev';
  // Afbeeldingen die net zijn geüpload staan al op GitHub, maar nog niet op de site
  var RAW = 'https://raw.githubusercontent.com/acdh2/acdh2.github.io/main/';
  try { API = localStorage.getItem('idt-beheer-api') || API; } catch (e) { /* standaard */ }

  var SESSIE = 'idt-beheer';
  var scriptSrc = document.currentScript && document.currentScript.src;
  var basis = scriptSrc ? scriptSrc.replace(/js\/[^\/]*$/, '') : location.href.replace(/[^\/]*$/, '');

  // ---------- Sessie en verbinding met de Worker ----------

  function sessie() {
    try { return JSON.parse(localStorage.getItem(SESSIE)) || null; } catch (e) { return null; }
  }

  function uitloggen() {
    try { localStorage.removeItem(SESSIE); } catch (e) { /* niets */ }
    location.href = basis + 'index.html';
  }

  function naarLogin() {
    try { localStorage.removeItem(SESSIE); } catch (e) { /* niets */ }
    location.href = basis + 'beheer.html?terug=' + encodeURIComponent(location.href);
  }

  function api(method, pad, data) {
    var s = sessie();
    return fetch(API + pad, {
      method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' },
        s ? { 'Authorization': 'Bearer ' + s.token } : {}),
      body: data ? JSON.stringify(data) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (res.status === 401 && pad !== '/login') { naarLogin(); throw new Error('Niet ingelogd'); }
        if (!res.ok) throw new Error(json.fout || ('Fout ' + res.status));
        return json;
      });
    }, function () {
      throw new Error('Geen verbinding met de beheerserver. Controleer je internet.');
    });
  }

  // ---------- Pagina-bestanden (Markdown met velden bovenaan) ----------

  function leesBestand(tekst) {
    var m = String(tekst).replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n?---\n?([\s\S]*)$/);
    if (!m) return { data: {}, body: tekst };
    return { data: window.jsyaml.load(m[1]) || {}, body: m[2].replace(/^\n+/, '').replace(/\s+$/, '') };
  }

  function maakBestand(data, body) {
    var schoon = {};
    Object.keys(data).forEach(function (k) {
      if (data[k] !== '' && data[k] !== null && data[k] !== undefined) schoon[k] = data[k];
    });
    var yaml = window.jsyaml.dump(schoon, { lineWidth: -1, quotingType: '"' });
    return '---\n' + yaml + '---\n' + (body ? '\n' + body + '\n' : '');
  }

  function geavanceerd(data) {
    return (Array.isArray(data.geavanceerd) && data.geavanceerd[0]) || {};
  }

  // Opgeslagen Markdown -> tekst voor in het tekstvak (# kop, * punt)
  function naarEditor(md) {
    var t = document.createElement('textarea');
    t.innerHTML = md;                                  // &amp; enz. terug naar tekens
    return t.value.split('\n').map(function (r) {
      r = r.replace(/(\s{2,}|\\)$/, '').replace(/\s+$/, '');
      var m;
      if ((m = r.match(/^(#{2,6})\s+(.*)$/))) return m[1].slice(1) + ' ' + m[2];
      if ((m = r.match(/^[-+]\s+(.*)$/))) return '* ' + m[1];
      return r;
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Tekst uit het tekstvak -> Markdown om op te slaan
  function naarOpslag(tekst) {
    var uit = [], vorige = 'leeg';
    String(tekst).replace(/\r\n/g, '\n').split('\n').forEach(function (r) {
      r = r.replace(/\s+$/, '');
      var m, soort;
      if (!r.trim()) {
        if (uit.length && uit[uit.length - 1] !== '') uit.push('');
        vorige = 'leeg';
        return;
      }
      if ((m = r.match(/^\s*(#{1,5})\s*(\S.*)$/))) {
        soort = 'kop'; r = '#' + m[1] + ' ' + m[2];
      } else if ((m = r.match(/^\s*[*•\-]\s+(.*)$/)) || (m = r.match(/^\s*\*(?=[^*\s])([^*]*)$/))) {
        soort = 'lijst'; r = '- ' + m[1];
      } else if ((m = r.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
        soort = 'nummers'; r = m[1] + '. ' + m[2];
      } else {
        soort = 'tekst';
      }
      // Witregel tussen blokken van een ander soort, en rond koppen
      if (vorige !== 'leeg' && (soort !== vorige || soort === 'kop')) uit.push('');
      uit.push(r);
      vorige = soort;
    });
    while (uit.length && uit[uit.length - 1] === '') uit.pop();
    return uit.join('\n');
  }

  function slug(tekst) {
    return String(tekst).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'pagina';
  }

  // /media/foto.jpg -> volledig adres; valt terug op GitHub als de site hem nog niet heeft
  function zetAfbeelding(img, pad) {
    if (/^(https?:|data:)/.test(pad)) { img.src = pad; return; }
    var rel = String(pad).replace(/^\//, '');
    img.src = basis + rel;
    img.onerror = function () { img.onerror = null; img.src = RAW + rel; };
  }

  // Waar staan we? "ontwerp-bewijzen/vectorworks-gebruiken/index.html" enz.
  function relatiefPad() {
    var p = decodeURIComponent(location.href.split(/[?#]/)[0]);
    return p.indexOf(basis) === 0 ? p.slice(basis.length) : location.pathname.replace(/^\//, '');
  }

  // ---------- Kleine bouwstenen ----------

  function el(tag, klasse, tekst) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (tekst !== undefined && tekst !== null) e.textContent = tekst;
    return e;
  }

  function knop(tekst, klasse, actie) {
    var b = el('button', 'beheer-knop ' + (klasse || ''), tekst);
    b.type = 'button';
    if (actie) b.addEventListener('click', actie);
    return b;
  }

  // Venster met vraag en knoppen; geeft een Promise met de gekozen waarde
  function venster(titel, inhoud, knoppen) {
    return new Promise(function (klaar) {
      var achter = el('div', 'beheer-venster-achter');
      var v = el('div', 'beheer-venster');
      v.setAttribute('role', 'dialog');
      v.appendChild(el('h2', '', titel));
      if (inhoud) v.appendChild(typeof inhoud === 'string' ? el('p', '', inhoud) : inhoud);
      var rij = el('div', 'beheer-venster-knoppen');
      knoppen.forEach(function (k) {
        rij.appendChild(knop(k.tekst, k.klasse, function () { sluit(k.waarde); }));
      });
      v.appendChild(rij);
      achter.appendChild(v);
      document.body.appendChild(achter);
      function sluit(waarde) {
        achter.remove();
        document.removeEventListener('keydown', toets);
        klaar(waarde);
      }
      function toets(e) {
        if (e.key === 'Escape') sluit(null);
      }
      document.addEventListener('keydown', toets);
      var veld = v.querySelector('input');
      (veld || v.querySelector('.beheer-knop-hoofd') || v.querySelector('button')).focus();
      if (veld) veld.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); sluit(knoppen[knoppen.length - 1].waarde); }
      });
    });
  }

  function melding(tekst, soort) {
    var m = document.querySelector('.beheer-melding') || el('div', 'beheer-melding');
    m.textContent = tekst;
    m.className = 'beheer-melding' + (soort ? ' beheer-melding-' + soort : '');
    document.body.appendChild(m);
    clearTimeout(melding.timer);
    if (soort !== 'bezig') melding.timer = setTimeout(function () { m.remove(); }, soort === 'fout' ? 9000 : 6000);
  }

  function laadCss() {
    if (document.querySelector('link[data-beheer]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = basis + 'css/beheer.css';
    l.setAttribute('data-beheer', '');
    document.head.appendChild(l);
  }

  function balk() {
    if (document.querySelector('.beheer-balk')) return;
    var s = sessie();
    var b = el('div', 'beheer-balk');
    b.appendChild(el('span', '', 'Beheer' + (s && s.naam ? ' (' + s.naam + ')' : '')));
    var uit = el('a', '', 'Uitloggen');
    uit.href = '#';
    uit.addEventListener('click', function (e) { e.preventDefault(); uitloggen(); });
    b.appendChild(uit);
    document.body.appendChild(b);
  }

  // ---------- Inlogpagina (beheer.html) ----------

  function inlogPagina() {
    var form = document.getElementById('beheer-login');
    var ingelogd = document.getElementById('beheer-ingelogd');
    var terug = new URLSearchParams(location.search).get('terug');
    var doel = terug && terug.indexOf(basis) === 0 ? terug : basis + 'index.html';
    var s = sessie();
    if (s) {
      form.hidden = true;
      ingelogd.hidden = false;
      ingelogd.querySelector('[data-naam]').textContent = s.naam;
      ingelogd.querySelector('[data-uitloggen]').addEventListener('click', function () {
        try { localStorage.removeItem(SESSIE); } catch (e) { /* niets */ }
        location.reload();
      });
      return;
    }
    var foutVak = form.querySelector('.beheer-fout');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var knopEl = form.querySelector('button');
      knopEl.disabled = true;
      foutVak.textContent = '';
      api('POST', '/login', { naam: form.naam.value, wachtwoord: form.wachtwoord.value })
        .then(function (res) {
          localStorage.setItem(SESSIE, JSON.stringify({ token: res.token, naam: res.naam }));
          location.href = doel;
        })
        .catch(function (err) {
          foutVak.textContent = err.message;
          knopEl.disabled = false;
          form.wachtwoord.select();
        });
    });
  }

  // js-yaml is nodig om de velden van een pagina te lezen
  function laadYaml() {
    if (window.jsyaml) return Promise.resolve();
    return new Promise(function (klaar, mislukt) {
      var sc = document.createElement('script');
      sc.src = basis + 'js/js-yaml.min.js';
      sc.onload = klaar;
      sc.onerror = function () { mislukt(new Error('Kon js-yaml niet laden')); };
      document.head.appendChild(sc);
    });
  }

  // ---------- Overzicht: tegels, + en prullenbak ----------

  function overzicht() {
    var pad = relatiefPad().replace(/(^|\/)index\.html$/, '').replace(/\/$/, '');
    var tegels = document.querySelector('.tegels');
    if (!tegels || !pad) return;
    tegels.classList.add('beheer-laden');

    Promise.all([api('GET', '/map?pad=' + encodeURIComponent(pad)), laadYaml()]).then(function (r) {
      var res = r[0];
      var items = res.items.filter(function (i) { return i.soort !== 'overzicht'; }).map(function (i) {
        var b = leesBestand(i.tekst);
        var g = geavanceerd(b.data);
        return {
          pad: i.pad, naam: i.naam, soort: i.soort, sha: i.sha,
          titel: b.data.titel || i.naam,
          tegeltitel: g.tegeltitel || b.data.titel || i.naam,
          beeld: g.tegelafbeelding || b.data.afbeelding || '',
          volgorde: typeof g.volgorde === 'number' ? g.volgorde : null,
          klaar: g.klaar !== false
        };
      });
      items.sort(function (a, b) {
        if (a.volgorde !== b.volgorde) {
          if (a.volgorde === null) return 1;
          if (b.volgorde === null) return -1;
          return a.volgorde - b.volgorde;
        }
        return a.naam < b.naam ? -1 : 1;
      });

      tegels.textContent = '';
      tegels.classList.remove('beheer-laden');
      items.forEach(function (item) { tegels.appendChild(maakTegel(item)); });
      tegels.appendChild(plusTegel(pad, items));
    }).catch(function (err) {
      tegels.classList.remove('beheer-laden');
      melding(err.message, 'fout');
    });
  }

  function maakTegel(item) {
    var tegel = el('a', 'tegel beheer-tegel' + (item.klaar ? '' : ' beheer-tegel-concept'));
    tegel.href = item.soort === 'onderdeel'
      ? basis + item.pad.replace(/index$/, 'index.html')
      : basis + 'bewerk.html?pad=' + encodeURIComponent(item.pad);
    tegel.appendChild(el('div', 'tegel-titel', item.tegeltitel));
    if (item.beeld) {
      var img = el('img', 'tegel-afbeelding');
      img.alt = '';
      zetAfbeelding(img, item.beeld);
      tegel.appendChild(img);
    }
    if (!item.klaar) tegel.appendChild(el('div', 'beheer-label', 'Nog niet klaar'));

    if (item.soort === 'onderdeel') {
      tegel.appendChild(el('div', 'beheer-label', 'Onderdeel met eigen tegels'));
      return tegel;
    }
    var prullenbak = knop('', 'beheer-prullenbak', function (e) {
      e.preventDefault();
      e.stopPropagation();
      venster('Tegel verwijderen?', '"' + item.titel + '" en de pagina erachter worden verwijderd.', [
        { tekst: 'Nee', waarde: false },
        { tekst: 'Ja', waarde: true, klasse: 'beheer-knop-gevaar' }
      ]).then(function (ja) {
        if (!ja) return;
        tegel.classList.add('beheer-laden');
        api('DELETE', '/pagina', { pad: item.pad, sha: item.sha }).then(function () {
          tegel.remove();
          melding('"' + item.titel + '" is verwijderd. Over ongeveer een minuut is hij ook van het scherm.');
        }).catch(function (err) {
          tegel.classList.remove('beheer-laden');
          melding(err.message, 'fout');
        });
      });
    });
    prullenbak.setAttribute('aria-label', 'Tegel verwijderen');
    prullenbak.title = 'Tegel verwijderen';
    prullenbak.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z"/></svg>';
    tegel.appendChild(prullenbak);
    return tegel;
  }

  function plusTegel(map, items) {
    var tegel = el('button', 'tegel beheer-plus');
    tegel.type = 'button';
    tegel.setAttribute('aria-label', 'Nieuwe pagina');
    tegel.appendChild(el('div', 'beheer-plus-teken', '+'));
    tegel.appendChild(el('div', 'tegel-titel', 'Nieuwe pagina'));
    tegel.addEventListener('click', function () {
      var veld = el('input');
      veld.type = 'text';
      veld.placeholder = 'Titel van de nieuwe pagina';
      veld.className = 'beheer-invoer';
      venster('Nieuwe pagina', veld, [
        { tekst: 'Annuleren', waarde: null },
        { tekst: 'Maken', waarde: 'ok', klasse: 'beheer-knop-hoofd' }
      ]).then(function (ok) {
        var titel = veld.value.trim();
        if (!ok || !titel) return;
        var namen = items.map(function (i) { return i.naam; });
        var naam = slug(titel), n = 2;
        while (namen.indexOf(naam) >= 0 || naam === 'index') naam = slug(titel) + '-' + (n++);
        var hoogste = items.reduce(function (m, i) { return i.volgorde !== null && i.volgorde > m ? i.volgorde : m; }, 0);
        var tekst = maakBestand(
          { titel: titel, geavanceerd: [{ volgorde: hoogste + 1 }] },
          naarOpslag('# Wat is het?\nVertel hier in een paar zinnen waar het over gaat.\n\n# Hoe werkt het?\n* Eerste stap\n* Tweede stap\n* Derde stap')
        );
        melding('Pagina wordt gemaakt...', 'bezig');
        api('PUT', '/pagina', { pad: map + '/' + naam, tekst: tekst }).then(function (res) {
          location.href = basis + 'bewerk.html?pad=' + encodeURIComponent(res.pad);
        }).catch(function (err) { melding(err.message, 'fout'); });
      });
    });
    return tegel;
  }

  // ---------- Gewone pagina: knop naar de editor ----------

  function bewerkKnop() {
    var pad = relatiefPad().replace(/\.html$/, '');
    if (!pad || pad.indexOf('/') < 0) return;
    var a = el('a', 'beheer-knop beheer-knop-hoofd beheer-bewerk-link', 'Bewerken');
    a.href = basis + 'bewerk.html?pad=' + encodeURIComponent(pad);
    document.body.appendChild(a);
  }

  // ---------- Editor (bewerk.html) ----------

  var staat = null;     // { pad, sha, data, body }
  var gewijzigd = false;

  function editorLaden() {
    var pad = new URLSearchParams(location.search).get('pad') || '';
    var domKlaar = new Promise(function (r) {
      if (document.readyState !== 'loading') r();
      else document.addEventListener('DOMContentLoaded', r);
    });
    return Promise.all([api('GET', '/pagina?pad=' + encodeURIComponent(pad)), domKlaar]).then(function (res) {
      var b = leesBestand(res[0].tekst);
      staat = { pad: pad, sha: res[0].sha, data: b.data, body: b.body };
      // pagina.js bouwt de pagina op uit deze tekst; afbeelding en link doet de editor zelf
      document.body.textContent = '# ' + (b.data.titel || '') + '\n\n' + b.body;
    }).catch(function (err) {
      document.addEventListener('idt-klaar', function () { melding(err.message, 'fout'); });
      throw err;
    });
  }

  function editor() {
    if (!staat) return;
    document.body.classList.add('beheer-editor');
    var kaart = document.querySelector('.onderwerp-kaart');
    var titelEl = kaart.querySelector('.onderwerp-titel');
    var tekstEl = kaart.querySelector('.card-text');
    var inhoud = document.querySelector('.onderwerp-inhoud');
    var data = staat.data;
    var g = geavanceerd(data);
    var nieuweAfbeelding = null;   // { naam, data, url } van een gekozen bestand
    var afbeelding = data.afbeelding || '';
    var editorTekst = naarEditor(staat.body);

    function wijziging() { gewijzigd = true; }

    // Titel
    titelEl.setAttribute('contenteditable', 'plaintext-only');
    if (titelEl.contentEditable !== 'plaintext-only') titelEl.setAttribute('contenteditable', 'true');
    titelEl.classList.add('beheer-bewerkbaar');
    titelEl.setAttribute('data-leeg', 'Titel');
    titelEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); titelEl.blur(); } });
    titelEl.addEventListener('input', wijziging);

    // Afbeelding
    var beeldVak = el('div', 'beheer-afbeelding');
    kaart.insertBefore(beeldVak, tekstEl);
    var bestandKiezer = el('input');
    bestandKiezer.type = 'file';
    bestandKiezer.accept = 'image/*';
    bestandKiezer.hidden = true;
    bestandKiezer.addEventListener('change', function () {
      var f = bestandKiezer.files[0];
      bestandKiezer.value = '';
      if (!f) return;
      verklein(f).then(function (res) {
        nieuweAfbeelding = res;
        afbeelding = res.url;
        wijziging();
        tekenAfbeelding();
      }).catch(function () { melding('Dit bestand kan niet als afbeelding worden gebruikt.', 'fout'); });
    });
    beeldVak.appendChild(bestandKiezer);

    function tekenAfbeelding() {
      Array.prototype.slice.call(beeldVak.children).forEach(function (c) { if (c !== bestandKiezer) c.remove(); });
      var knoppen = el('div', 'beheer-afbeelding-knoppen');
      if (afbeelding) {
        var img = el('img', 'onderwerp-afbeelding');
        img.alt = g.afbeelding_beschrijving || '';
        zetAfbeelding(img, afbeelding);
        beeldVak.appendChild(img);
        knoppen.appendChild(knop('Afbeelding vervangen', '', function () { bestandKiezer.click(); }));
        knoppen.appendChild(knop('Afbeelding wissen', '', function () {
          afbeelding = '';
          nieuweAfbeelding = null;
          wijziging();
          tekenAfbeelding();
        }));
      } else {
        beeldVak.classList.add('beheer-afbeelding-leeg');
        knoppen.appendChild(knop('Afbeelding toevoegen', '', function () { bestandKiezer.click(); }));
        knoppen.appendChild(el('span', 'beheer-hint', 'Zonder afbeelding wordt hier niets getoond.'));
      }
      beeldVak.classList.toggle('beheer-afbeelding-leeg', !afbeelding);
      beeldVak.appendChild(knoppen);
    }
    tekenAfbeelding();

    // Video uit Geavanceerd (alleen tonen; bewerken kan in Pages CMS)
    if (g.video && window.IDT.leesVideo(g.video)) {
      kaart.insertBefore(window.IDT.maakVideo(window.IDT.leesVideo(g.video)), tekstEl);
    }

    // Tekst: aanklikken om te bewerken
    tekstEl.classList.add('beheer-bewerkbaar', 'beheer-tekst');
    tekstEl.setAttribute('tabindex', '0');
    tekstEl.title = 'Klik om de tekst te bewerken';
    function tekenTekst() {
      tekstEl.textContent = '';
      if (!editorTekst.trim()) {
        tekstEl.appendChild(el('p', 'beheer-hint', 'Klik hier om tekst te typen.'));
        return;
      }
      window.IDT.markdownBlokken(naarOpslag(editorTekst), false).forEach(function (b) { tekstEl.appendChild(b); });
    }
    tekenTekst();

    var tekstVak = el('textarea', 'beheer-tekstvak');
    var hulp = el('div', 'beheer-hint', '# aan het begin van een regel: tussenkop.   * aan het begin: opsomming.   **woord**: vet.');
    function openTekst() {
      if (tekstVak.isConnected) return;
      tekstVak.value = editorTekst;
      tekstEl.replaceWith(tekstVak);
      tekstVak.after(hulp);
      groei();
      tekstVak.focus();
    }
    function sluitTekst() {
      editorTekst = tekstVak.value;
      tekstVak.replaceWith(tekstEl);
      hulp.remove();
      tekenTekst();
    }
    function groei() {
      tekstVak.style.height = 'auto';
      tekstVak.style.height = (tekstVak.scrollHeight + 4) + 'px';
    }
    tekstEl.addEventListener('click', openTekst);
    tekstEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); openTekst(); } });
    tekstVak.addEventListener('input', function () { wijziging(); groei(); });
    tekstVak.addEventListener('blur', sluitTekst);

    // Link met QR-code
    var linkBlok = el('section', 'card card-qr beheer-link');
    var linkVelden = el('div', 'link-container');
    var kopjeVeld = el('input', 'beheer-invoer beheer-kopje');
    kopjeVeld.placeholder = 'Meer informatie:';
    kopjeVeld.value = data.link_tekst || '';
    kopjeVeld.setAttribute('aria-label', 'Kopje bij de link');
    var linkVeld = el('input', 'beheer-invoer beheer-linkveld');
    linkVeld.type = 'url';
    linkVeld.placeholder = 'https://...';
    linkVeld.value = data.link || '';
    linkVeld.setAttribute('aria-label', 'Link');
    linkVelden.append(el('label', 'link-title', 'Kopje'), kopjeVeld, el('label', 'link-title', 'Link (wordt een QR-code)'), linkVeld);
    var linkHint = el('div', 'beheer-hint');
    linkVelden.appendChild(linkHint);
    linkBlok.appendChild(linkVelden);
    var qrPlek = el('div', 'beheer-qr');
    linkBlok.appendChild(qrPlek);
    inhoud.appendChild(linkBlok);
    var qrTimer;
    function tekenQr() {
      qrPlek.textContent = '';
      var adres = linkVeld.value.trim();
      if (!adres) {
        linkHint.textContent = 'Zonder link wordt dit blok niet getoond.';
      } else if (!/^https?:\/\/\S+$/.test(adres)) {
        linkHint.textContent = 'Een link begint met https:// en heeft geen spaties.';
      } else {
        linkHint.textContent = '';
        var qr = window.IDT.maakQr(adres);
        if (qr) qrPlek.appendChild(qr);
      }
    }
    tekenQr();
    [kopjeVeld, linkVeld].forEach(function (v) { v.addEventListener('input', wijziging); });
    linkVeld.addEventListener('input', function () { clearTimeout(qrTimer); qrTimer = setTimeout(tekenQr, 300); });

    // Opslaan / Annuleren
    var acties = el('div', 'beheer-acties');
    var opslaan = knop('Opslaan', 'beheer-knop-hoofd', bewaar);
    var annuleren = knop('Annuleren', '', function () {
      if (!gewijzigd) { location.href = terugAdres(); return; }
      venster('Wijzigingen weggooien?', 'Wat je hebt veranderd sinds de laatste keer opslaan, gaat verloren.', [
        { tekst: 'Nee, verder bewerken', waarde: false },
        { tekst: 'Ja, weggooien', waarde: true, klasse: 'beheer-knop-gevaar' }
      ]).then(function (ja) { if (ja) { gewijzigd = false; location.reload(); } });
    });
    acties.append(annuleren, opslaan);
    document.body.appendChild(acties);

    // Niet per ongeluk weglopen met wijzigingen
    window.addEventListener('beforeunload', function (e) {
      if (gewijzigd) { e.preventDefault(); e.returnValue = ''; }
    });
    Array.prototype.forEach.call(document.querySelectorAll('.terug-knop, .logo-terug'), function (a) {
      a.addEventListener('click', function (e) {
        if (!gewijzigd) return;
        e.preventDefault();
        venster('Niet opgeslagen', 'Je wijzigingen zijn nog niet opgeslagen. Toch teruggaan?', [
          { tekst: 'Nee', waarde: false },
          { tekst: 'Ja, teruggaan', waarde: true, klasse: 'beheer-knop-gevaar' }
        ]).then(function (ja) { if (ja) { gewijzigd = false; location.href = a.href; } });
      });
    });

    function terugAdres() {
      var t = document.querySelector('.terug-knop');
      return t ? t.href : basis + 'index.html';
    }

    function bewaar() {
      if (tekstVak.isConnected) sluitTekst();
      var titel = titelEl.textContent.replace(/\s+/g, ' ').trim();
      var link = linkVeld.value.trim();
      if (!titel) { melding('Geef de pagina een titel.', 'fout'); titelEl.focus(); return; }
      if (link && !/^https?:\/\/\S+$/.test(link)) { melding('De link moet beginnen met https:// en mag geen spaties hebben.', 'fout'); linkVeld.focus(); return; }

      opslaan.disabled = annuleren.disabled = true;
      melding('Bezig met opslaan...', 'bezig');
      var upload = nieuweAfbeelding
        ? api('POST', '/afbeelding', { naam: nieuweAfbeelding.naam, data: nieuweAfbeelding.data }).then(function (r) { return r.pad; })
        : Promise.resolve(afbeelding);

      upload.then(function (beeldPad) {
        var nieuw = Object.assign({}, data);
        nieuw.titel = titel;
        nieuw.afbeelding = beeldPad || '';
        nieuw.link_tekst = kopjeVeld.value.trim();
        nieuw.link = link;
        // Volgorde van de velden zoals in Pages CMS
        var geordend = {};
        ['titel', 'afbeelding', 'link_tekst', 'link'].concat(Object.keys(nieuw)).forEach(function (k) {
          if (!(k in geordend)) geordend[k] = nieuw[k];
        });
        var tekst = maakBestand(geordend, naarOpslag(editorTekst));
        return api('PUT', '/pagina', { pad: staat.pad, tekst: tekst, sha: staat.sha }).then(function (res) {
          staat.sha = res.sha;
          data = staat.data = leesBestand(tekst).data;
          afbeelding = data.afbeelding || '';
          nieuweAfbeelding = null;
          gewijzigd = false;
          document.title = titel;
          melding('Opgeslagen. Over ongeveer een minuut staat het ook op het scherm.', 'goed');
        });
      }).catch(function (err) {
        melding(err.message, 'fout');
      }).then(function () {
        opslaan.disabled = annuleren.disabled = false;
      });
    }
  }

  // Afbeelding verkleinen tot maximaal 1600 pixels breed of hoog (jpg)
  function verklein(bestand) {
    return new Promise(function (klaar, mislukt) {
      var url = URL.createObjectURL(bestand);
      var img = new Image();
      img.onload = function () {
        var max = 1600, s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var dataUrl = c.toDataURL('image/jpeg', 0.85);
        klaar({
          naam: (bestand.name.replace(/\.[^.]*$/, '') || 'afbeelding') + '.jpg',
          data: dataUrl.split(',')[1],
          url: dataUrl
        });
      };
      img.onerror = function () { URL.revokeObjectURL(url); mislukt(); };
      img.src = url;
    });
  }

  // ---------- Start ----------

  if (window.IDT_BEWERK) {
    if (!sessie()) { naarLogin(); return; }
    window.IDT_WACHT = editorLaden();
  }

  function start() {
    laadCss();
    if (document.body && document.body.getAttribute('data-beheer') === 'login') { inlogPagina(); return; }
    if (!sessie()) return;
    balk();
    if (window.IDT_BEWERK) editor();
    else if (window.IDT && window.IDT.isOverzicht && document.body.classList.contains('fasepagina')) overzicht();
    else if (document.body.classList.contains('onderwerp')) bewerkKnop();
  }

  // Pagina's met pagina.js: wachten tot de opmaak klaar is. Andere (start, inloggen): meteen.
  var metPaginaJs = window.IDT_BEWERK || !!window.IDT ||
    Array.prototype.some.call(document.scripts, function (sc) { return /js\/pagina\.js/.test(sc.src); });
  if (metPaginaJs) {
    if (window.IDT && window.IDT.klaar) start();
    else document.addEventListener('idt-klaar', start);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
