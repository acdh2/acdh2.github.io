/* =========================================================
   IDT-beheer: Cloudflare Worker tussen de beheeromgeving van de site
   (beheer.html / bewerk.html) en GitHub.

   Het controleert de naam en het wachtwoord, en zet wijzigingen in de
   repository. De GitHub-sleutel blijft hier, en komt nooit in de browser.

   Instellingen (Cloudflare > Worker > Settings > Variables and Secrets):
     GITHUB_TOKEN  (secret)  fine-grained token met Contents: Read and write
     WACHTWOORD    (secret)  het wachtwoord voor de beheeromgeving
     GEBRUIKER     (tekst)   de naam om mee in te loggen, bijv. beheer
     REPO          (tekst)   bijv. acdh2/acdh2.github.io
     TOEGESTAAN    (tekst)   site(s) die dit mogen gebruiken, gescheiden door
                             komma's, bijv. https://acdh2.github.io
     BRANCH        (tekst, optioneel)  standaard main
   ========================================================= */

const MAP = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/;
const AFBEELDING = /^(jpe?g|png|webp|gif)$/;
const SESSIE_DAGEN = 30;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      const url = new URL(request.url);
      const route = request.method + ' ' + url.pathname.replace(/\/+$/, '');

      if (route === 'POST /login') return antwoord(await login(await request.json(), env), cors);

      const naam = await controleerSessie(request, env);
      if (!naam) return antwoord({ status: 401, fout: 'Niet ingelogd' }, cors);

      switch (route) {
        case 'GET /map':        return antwoord(await leesMap(url.searchParams.get('pad'), env), cors);
        case 'GET /pagina':     return antwoord(await leesPagina(url.searchParams.get('pad'), env), cors);
        case 'PUT /pagina':     return antwoord(await schrijfPagina(await request.json(), naam, env), cors);
        case 'DELETE /pagina':  return antwoord(await wisPagina(await request.json(), naam, env), cors);
        case 'POST /afbeelding': return antwoord(await schrijfAfbeelding(await request.json(), naam, env), cors);
        default:                return antwoord({ status: 404, fout: 'Onbekend adres' }, cors);
      }
    } catch (e) {
      return antwoord({ status: e.status || 500, fout: e.message || 'Er ging iets mis' }, cors);
    }
  }
};

// ---------- Inloggen ----------

async function login(gegevens, env) {
  const naam = String(gegevens.naam || '').trim().toLowerCase();
  const wachtwoord = String(gegevens.wachtwoord || '');
  const goedeNaam = String(env.GEBRUIKER || 'beheer').trim().toLowerCase();
  // Vergelijk via HMAC, zodat de tijd niet verraadt hoeveel tekens kloppen
  const [a, b] = await Promise.all([teken(env, 'ww:' + wachtwoord), teken(env, 'ww:' + env.WACHTWOORD)]);
  if (!env.WACHTWOORD || naam !== goedeNaam || a !== b) {
    await new Promise(r => setTimeout(r, 800));
    return { status: 401, fout: 'Naam of wachtwoord klopt niet' };
  }
  const inhoud = b64url(JSON.stringify({ n: naam, e: Date.now() + SESSIE_DAGEN * 864e5 }));
  return { token: inhoud + '.' + await teken(env, inhoud), naam };
}

async function controleerSessie(request, env) {
  const kop = request.headers.get('Authorization') || '';
  const m = kop.match(/^Bearer ([\w-]+)\.([\w-]+)$/);
  if (!m || await teken(env, m[1]) !== m[2]) return null;
  try {
    const sessie = JSON.parse(vanBase64(m[1].replace(/-/g, '+').replace(/_/g, '/')));
    return sessie.e > Date.now() ? sessie.n : null;
  } catch (e) {
    return null;
  }
}

// De sleutel hangt af van het wachtwoord: wachtwoord wijzigen = iedereen uitgelogd
async function teken(env, tekst) {
  const sleutel = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.WACHTWOORD + '|' + env.GITHUB_TOKEN),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', sleutel, new TextEncoder().encode(tekst));
  return b64urlBytes(new Uint8Array(sig));
}

// ---------- Pagina's ----------

// Alle pagina's in een map, met hun tekst (één verzoek via GraphQL)
async function leesMap(map, env) {
  controleerPad(map);
  const [owner, name] = env.REPO.split('/');
  const query = `query($owner:String!,$name:String!,$expr:String!){repository(owner:$owner,name:$name){object(expression:$expr){
    ... on Tree{entries{name type object{
      ... on Blob{oid text}
      ... on Tree{entries{name type object{... on Blob{oid text}}}}}}}}}}`;
  const res = await github(env, 'POST', '/graphql', {
    query, variables: { owner, name, expr: `${branch(env)}:_onderwerpen/${map}` }
  });
  if (res.errors) throw fout(500, res.errors[0].message);
  const boom = res.data.repository.object;
  if (!boom) throw fout(404, 'Deze map bestaat niet');

  const items = [];
  for (const e of boom.entries) {
    if (e.type === 'blob' && e.name.endsWith('.md')) {
      const naam = e.name.slice(0, -3);
      items.push({ pad: `${map}/${naam}`, naam, soort: naam === 'index' ? 'overzicht' : 'pagina', sha: e.object.oid, tekst: e.object.text });
    } else if (e.type === 'tree') {
      const index = (e.object.entries || []).find(x => x.name === 'index.md');
      if (index) items.push({ pad: `${map}/${e.name}/index`, naam: e.name, soort: 'onderdeel', sha: index.object.oid, tekst: index.object.text });
    }
  }
  return { items };
}

async function leesPagina(pad, env) {
  controleerPad(pad);
  const res = await github(env, 'GET', `/repos/${env.REPO}/contents/_onderwerpen/${pad}.md?ref=${branch(env)}`);
  return { pad, sha: res.sha, tekst: vanBase64(res.content) };
}

async function schrijfPagina({ pad, tekst, sha }, naam, env) {
  controleerPad(pad);
  if (typeof tekst !== 'string' || tekst.length > 200000) throw fout(400, 'Ongeldige inhoud');
  const titel = (tekst.match(/^titel:\s*["']?(.*?)["']?\s*$/m) || [])[1] || pad;
  const body = {
    message: `${sha ? 'Pagina bijgewerkt' : 'Nieuwe pagina'}: ${titel} (via beheer, ${naam})`,
    content: naarBase64(tekst),
    branch: branch(env)
  };
  if (sha) body.sha = sha;
  const res = await github(env, 'PUT', `/repos/${env.REPO}/contents/_onderwerpen/${pad}.md`, body);
  return { pad, sha: res.content.sha };
}

async function wisPagina({ pad, sha }, naam, env) {
  controleerPad(pad);
  if (/(^|\/)index$/.test(pad)) throw fout(400, 'Een overzicht kan hier niet worden verwijderd');
  await github(env, 'DELETE', `/repos/${env.REPO}/contents/_onderwerpen/${pad}.md`, {
    message: `Pagina verwijderd: ${pad} (via beheer, ${naam})`, sha, branch: branch(env)
  });
  return { pad, verwijderd: true };
}

// ---------- Afbeeldingen ----------

async function schrijfAfbeelding({ naam: bestandsnaam, data }, naam, env) {
  const m = String(bestandsnaam || '').toLowerCase().match(/^(.*?)\.([a-z0-9]+)$/);
  if (!m || !AFBEELDING.test(m[2])) throw fout(400, 'Alleen jpg, png, webp of gif');
  if (typeof data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(data)) throw fout(400, 'Ongeldige afbeelding');
  if (data.length > 12e6) throw fout(413, 'Afbeelding is te groot');
  const basisnaam = (m[1].normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'afbeelding').slice(0, 50);
  const uniek = crypto.getRandomValues(new Uint8Array(3)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  const pad = `media/${basisnaam}-${uniek}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`;
  await github(env, 'PUT', `/repos/${env.REPO}/contents/${pad}`, {
    message: `Afbeelding toegevoegd: ${pad} (via beheer, ${naam})`, content: data, branch: branch(env)
  });
  return { pad: '/' + pad };
}

// ---------- Hulpjes ----------

async function github(env, method, pad, body) {
  const res = await fetch((env.GITHUB_API || 'https://api.github.com') + pad, {
    method,
    headers: {
      'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'idt-beheer',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const tekst = await res.text();
  const json = tekst ? JSON.parse(tekst) : {};
  if (!res.ok) {
    if (res.status === 409 || (res.status === 422 && /sha/i.test(json.message || ''))) {
      throw fout(409, 'Deze pagina is intussen door iemand anders gewijzigd. Laad de pagina opnieuw.');
    }
    if (res.status === 404) throw fout(404, 'Niet gevonden');
    if (res.status === 401 || res.status === 403) throw fout(502, 'GitHub weigert de toegang. Controleer GITHUB_TOKEN.');
    throw fout(502, 'GitHub: ' + (json.message || res.status));
  }
  return json;
}

function controleerPad(pad) {
  if (typeof pad !== 'string' || !MAP.test(pad)) throw fout(400, 'Ongeldig pad');
}

function branch(env) {
  return env.BRANCH || 'main';
}

function fout(status, bericht) {
  const e = new Error(bericht);
  e.status = status;
  return e;
}

function corsHeaders(origin, env) {
  const toegestaan = String(env.TOEGESTAAN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (toegestaan.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function antwoord(data, cors) {
  const status = data.status || 200;
  if (data.status) delete data.status;
  return new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function b64url(tekst) {
  return b64urlBytes(new TextEncoder().encode(tekst));
}

function b64urlBytes(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function naarBase64(tekst) {
  const bytes = new TextEncoder().encode(tekst);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function vanBase64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
