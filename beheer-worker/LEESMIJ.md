# Beheerserver (Cloudflare Worker) instellen

De beheeromgeving op de site (`/beheer.html`) slaat wijzigingen op via deze kleine Worker. De Worker controleert het wachtwoord en zet de wijziging op GitHub. De GitHub-sleutel staat alleen hier, nooit in de site zelf.

Je hoeft dit maar één keer te doen.

## 1. GitHub-sleutel maken

1. Ga op GitHub naar **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Naam: `IDT beheer`. Kies bij de vervaldatum de langste die je kunt kiezen, en zet een herinnering in je agenda.
3. **Repository access:** *Only select repositories* en kies de repository van de site (bijvoorbeeld `acdh2.github.io`).
4. **Permissions → Repository permissions → Contents:** *Read and write*.
5. Klik op **Generate token** en kopieer de sleutel. Je ziet hem maar één keer.

## 2. Worker maken bij Cloudflare

1. Maak een gratis account aan op **dash.cloudflare.com**.
2. Ga naar **Workers & Pages** en maak een nieuwe Worker met het voorbeeld "Hello World". Noem hem `idt-beheer` en klik op **Deploy**.
3. Klik op **Edit code**, vervang alle code door de inhoud van `worker.js` uit deze map, en klik op **Deploy**.

## 3. Instellingen invullen

Ga bij de Worker naar **Settings → Variables and Secrets** en voeg toe:

| Naam | Soort | Waarde |
|---|---|---|
| `GITHUB_TOKEN` | Secret | de sleutel uit stap 1 |
| `WACHTWOORD` | Secret | het wachtwoord voor de beheeromgeving |
| `GEBRUIKER` | Text | de naam om mee in te loggen, bijvoorbeeld `beheer` |
| `REPO` | Text | `acdh2/acdh2.github.io` |
| `TOEGESTAAN` | Text | `https://acdh2.github.io` |

Klik op **Deploy** (of **Save and deploy**).

**Controleren:** open het adres van de Worker (iets als `https://idt-beheer.jouw-naam.workers.dev`). Zie je `{"fout":"Niet ingelogd"}`, dan werkt hij.

## 4. Adres in de site zetten

Zet het adres van de Worker bovenin `js/beheer.js` bij `var API = ...`.

## Later

- **Wachtwoord veranderen:** pas `WACHTWOORD` aan. Iedereen moet dan opnieuw inloggen.
- **Sleutel verlopen:** maak een nieuwe (stap 1) en vervang `GITHUB_TOKEN`.
- **Site verhuisd** (bijvoorbeeld naar Labidhbs.github.io): pas `REPO` en `TOEGESTAAN` aan, en `RAW` bovenin `js/beheer.js`. Bij `TOEGESTAAN` mogen meerdere adressen, gescheiden door komma's.
