<div align="center">
  <img 
    src="_images/logo.png" 
    alt="OpenCode VPet logo" 
    width="160" 
    style="image-rendering: pixelated"
  >
  <h1>opencode-vpet</h1>
  <p>
    A Digimon virtual pet for OpenCode that evolves with usage.
  </p>
  <p>
    <a href="#about">About</a> | 
    <a href="#evolution">Evolution</a> | 
    <a href="#quick-start">Quick start</a> | 
    <a href="#commands">Commands</a> | 
    <a href="#settings">Settings</a> | 
    <a href="#storage">Storage</a> | 
    <a href="#partner-list">Partner list</a> |
    <a href="#license">License</a> |
    <a href="#attributions">Attributions</a>

  </p>
</div>

---

## About

<div align="center">
  <img 
    src="_images/vpet-overview.png" 
    alt="OpenCode VPet Overview" 
    width="100%" 
  >
</div>

`@sbugallo/opencode-vpet` is an OpenCode v2 plugin that adds a Digimon virtual pet to your OpenCode TUI 
sidebar. Your Digimon evolves as you use OpenCode, and you can browse your discoveries and 
partner history.

The plugin support multiple concurrent sessions, so every token counts to evolve your partner.

There are more than 1,100 Digimon to discover, and the plugin is designed to be extensible so that new Digimon can be added in future releases.

## Evolution

Your active partner gains experience from the tokens reported for completed assistant
messages in OpenCode. This includes input, output, reasoning, and cache tokens.
Progress is shared across concurrent OpenCode sessions, so completed work in each
session contributes to the same partner.

Each stage has a configurable experience threshold. When your partner reaches the
threshold for its current stage, it evolves and its experience gauge resets for the
next stage. Use `/vpet-freeze` to pause partner progression; usage while frozen is
not applied to your partner.

The bundled evolution lines were extracted from the original V-Pets. When a Digimon
reaches an evolution threshold, the plugin randomly chooses one of the evolution
options in that Digimon's line.

## Quick start

Requirements:
- OpenCode `>=2.0.18`
- Node `>=20` to run `npx`
- Bun `>=1.3.5` only for local development


1. Install both plugins:

   ```sh
   npx @sbugallo/opencode-vpet init
   ```

   The CLI delegates to `opencode plugin add @sbugallo/opencode-vpet@<installed-package-version>`.
   It uses the package's installed exact version so OpenCode uses a version-specific cache key rather
   than reusing a stale bare or `@latest` cache entry.

2. Restart OpenCode when the command finishes.

3. In OpenCode, run `/vpet-spawn` to hatch a partner.

After that, use `/vpet-dex` to browse discoveries and `/vpet-history` to browse current and retired generations.

---

## Commands

| Command | Description |
| --- | --- |
| `/vpet-spawn` | Spawns a random Digiegg. |
| `/vpet-spawn-<field>` | Spawns a Digiegg of one Digitama field (`deep-savers`, `dragons-roar`, `jungle-troopers`, `metal-empire`, `nature-spirits`, `nightmare-soldiers`, `virus-busters`, `wind-guardians`). |
| `/vpet-freeze` | Pauses partner progression. |
| `/vpet-unfreeze` | Resumes partner progression. |
| `/vpet-set <id>` | Overrides the partner with the specified catalog ID. |
| `/vpet-dex` | Opens the partner Dex. |
| `/vpet-history` | Opens the partner History. |

> [!NOTE]
> Using `/vpet-set` does not count for dex completion.

## Update

To update the plugin, run:

```sh
npx @sbugallo/opencode-vpet update
```

Like `init`, `update` delegates to OpenCode's native global plugin installer with the installed exact
package version. If a legacy unscoped `opencode-vpet` registration is present, remove it manually.

## Settings

Settings are stored in `opencode-vpet.json` and control naming, notifications, and evolution
thresholds.

The location of the settings file depends on your operating system:

- Linux, WSL, and macOS: `~/.config/opencode-vpet.json`
- Windows: `%APPDATA%\opencode-vpet.json`, or `%USERPROFILE%\AppData\Roaming\opencode-vpet.json`
  when `APPDATA` isn't set.


Available settings are:

| Setting | Description |
| --- | --- |
| `notifications` | Enables or disables notifications. |
| `language` | Sets the naming convention. Valid values are `jp` (Japanese, e.g., Omegamon, Child, Adult...) and `en` (English, e.g., Omnimon, Rookie, Champion...). |
| `stageThresholds` | Defines the experience thresholds for each evolution stage. |

Default values are:

```json
{
  "notifications": true,
  "language": "jp",
  "stageThresholds": {
    "egg": 500000,
    "babyI": 1000000,
    "babyII": 2000000,
    "child": 4000000,
    "adult": 7500000,
    "perfect": 12500000,
    "ultimate": 20000000,
    "superUltimate": 30000000
  }
}
```

## Storage

To persist your partner, history, and control state, VPet uses a SQLite database named `pet.db`. The location of the database depends on your operating system:

- Linux, WSL: `~/.local/share/opencode-vpet/pet.db`
- macOS: `~/Library/Application Support/opencode-vpet/pet.db`
- Windows: `%APPDATA%\opencode-vpet\pet.db`, or `%USERPROFILE%\AppData\Roaming\opencode-vpet\pet.db` 
  when `APPDATA` isn't set.

---

## Partner list

| ID | Japanese name | English name |
| --- | --- | --- |
| D-001 | Digitama (Deep Savers) | Digiegg (Deep Savers) |
| D-002 | Digitama (Dragon's Roar) | Digiegg (Dragon's Roar) |
| D-003 | Digitama (Jungle Troopers) | Digiegg (Jungle Troopers) |
| D-004 | Digitama (Metal Empire) | Digiegg (Metal Empire) |
| D-005 | Digitama (Nature Spirits) | Digiegg (Nature Spirits) |
| D-006 | Digitama (Nightmare Soldiers) | Digiegg (Nightmare Soldiers) |
| D-007 | Digitama (Virus Busters) | Digiegg (Virus Busters) |
| D-008 | Digitama (Wind Guardians) | Digiegg (Wind Guardians) |
| BI-001 | Algomon | Argomon |
| BI-002 | Bommon | Bommon |
| BI-003 | Bombmon (2010) | Bommon (2010) |
| BI-004 | Botamon | Botamon |
| BI-005 | Bubbmon | Pabumon |
| BI-006 | Chibickmon | Chibickmon |
| BI-007 | Chicomon | Chibomon |
| BI-008 | Choromon | Choromon |
| BI-009 | Cocomon | Conomon |
| BI-010 | Cotsucomon | Cotsucomon |
| BI-011 | Curimon | Curimon |
| BI-012 | Dodomon | Dodomon |
| BI-013 | Dokimon | Dokimon |
| BI-014 | Fufumon | Fufumon |
| BI-015 | Fukamon | Fukamon |
| BI-016 | Fusamon | Fusamon |
| BI-017 | Jyarimon | Jyarimon |
| BI-018 | Kiimon | Keemon |
| BI-019 | Ketomon | Ketomon |
| BI-020 | Kuramon | Kuramon |
| BI-021 | Leafmon | Leafmon |
| BI-022 | Mokumon | Mokumon |
| BI-023 | Nyokimon | Nyokimon |
| BI-024 | Pafumon | Pafumon |
| BI-025 | Paomon | Paomon |
| BI-026 | Petitmon | Petitmon |
| BI-027 | Pipimon | Pipimon |
| BI-028 | Pitchmon | Pichimon |
| BI-029 | Popomon | Popomon |
| BI-030 | Poyomon | Poyomon |
| BI-031 | Punimon | Punimon |
| BI-032 | Pupumon | Pupumon |
| BI-033 | Pururumon | Pururumon |
| BI-034 | Pusumon | Pusumon |
| BI-035 | Puttimon | Puttimon |
| BI-036 | Puwamon | Puwamon |
| BI-037 | Puyomon | Puyomon |
| BI-038 | Pyonmon | Pyonmon |
| BI-039 | Relemon | Relemon |
| BI-040 | Sakumon | Sakumon |
| BI-041 | Sunamon | Sandmon |
| BI-042 | Tomorimon | Tomorimon |
| BI-043 | Tsubumon | Tsubumon |
| BI-044 | Yolkmon | Yolkmon |
| BI-045 | YukimiBotamon | YukimiBotamon |
| BI-046 | Yuramon | Yuramon |
| BI-047 | Zerimon | Zerimon |
| BI-048 | Zurumon | Zurumon |
| BII-001 | Algomon | Argomon |
| BII-002 | Arkadimon | Arcadiamon In-Training |
| BII-003 | Babydmon | Bebydomon |
| BII-004 | Bibimon | Bibimon |
| BII-005 | Bowmon | Bowmon |
| BII-006 | Budmon | Budmon |
| BII-007 | Capromon | Kapurimon |
| BII-008 | Chapmon | Chapmon |
| BII-009 | Chibimon | DemiVeemon |
| BII-010 | Chicchimon | Chicchimon |
| BII-011 | Chocomon | Kokomon |
| BII-012 | Cupimon | Cupimon |
| BII-013 | Dorimon | Dorimon |
| BII-014 | Fluffymon | Fluffymon |
| BII-015 | Gigimon | Gigimon |
| BII-016 | Goromon | Tumblemon |
| BII-017 | Gummymon | Gummymon |
| BII-018 | Gurimon | Gurimon |
| BII-019 | Hiyarimon | Hiyarimon |
| BII-020 | Hopmon | Hopmon |
| BII-021 | Kakkinmon | Kakkinmon |
| BII-022 | Koromon | Koromon |
| BII-023 | Kozenimon | Kozenimon |
| BII-024 | Kyaromon | Kyaromon |
| BII-025 | Kyokyomon | Kyokyomon |
| BII-026 | Minomon | Minomon |
| BII-027 | Mochimon | Motimon |
| BII-028 | Mococomon | Mococomon |
| BII-029 | Monimon | Monimon |
| BII-030 | Moonmon | Moonmon |
| BII-031 | Negamon | Negamon |
| BII-032 | Nyaromon | Nyaromon |
| BII-033 | Onibimon | Onibimon |
| BII-034 | Pagumon | Pagumon |
| BII-035 | PetiMeramon | DemiMeramon |
| BII-036 | Pickmon | Pickmon |
| BII-037 | Pinamon | Pinamon |
| BII-038 | Pokomon | Viximon |
| BII-039 | Poromon | Poromon |
| BII-040 | Pukamon | Bukamon |
| BII-041 | Puroromon | Puroromon |
| BII-042 | Pusurimon | Pusurimon |
| BII-043 | Puyoyomon | Puyoyomon |
| BII-044 | Pyocomon | Yokomon |
| BII-045 | Sakuttomon | Sakuttomon |
| BII-046 | Sunmon | Sunmon |
| BII-047 | Tanemon | Tanemon |
| BII-048 | Tokomon | Tokomon |
| BII-049 | Tokomon (X Antibody) | Tokomon (X Antibody) |
| BII-050 | Tsumemon | Tsumemon |
| BII-051 | Tunomon | Tsunomon |
| BII-052 | Upamon | Upamon |
| BII-053 | Wanyamon | Wanyamon |
| BII-054 | Xiaomon | Xiaomon |
| BII-055 | Yarmon | Yaamon |
| C-001 | Burakkugirumon | BlackGuilmon |
| C-002 | Puchimamon | PetitMamon |
| C-003 | Agumon | Agumon |
| C-004 | Agumon (2006) | Agumon (2006) |
| C-005 | Agumon (Black) | Agumon (Black) |
| C-006 | Agumon (Black) (X Antibody) | Agumon (Black) (X Antibody) |
| C-007 | Agumon (X Antibody) | Agumon (X Antibody) |
| C-008 | Agumon Hakase | Agumon Expert |
| C-009 | Algomon | Argomon |
| C-010 | Alraumon | Aruraumon |
| C-011 | Angoramon | Angoramon |
| C-012 | Arkadimon | Arcadiamon |
| C-013 | Armadimon | Armadillomon |
| C-014 | Bakumon | Tapirmon |
| C-015 | Bearmon | Bearmon |
| C-016 | Vemmon | Vemmon |
| C-017 | Betamon | Betamon |
| C-018 | Betamon (X Antibody) | Betamon (X Antibody) |
| C-019 | Blucomon | Bulucomon |
| C-020 | BushiAgumon | BushiAgumon |
| C-021 | Candmon | Candlemon |
| C-022 | Chikurimon | Chikurimon |
| C-023 | ClearAgumon | ClearAgumon |
| C-024 | Commandramon | Commandramon |
| C-025 | Coronamon | Coronamon |
| C-026 | DoKunemon | DoKunemon |
| C-027 | DORUmon | Dorumon |
| C-028 | Dracomon | Dracomon |
| C-029 | Dracomon (X Antibody) | Dracomon (X Antibody) |
| C-030 | Dracumon | Dracmon |
| C-031 | Ekakimon | Ekakimon |
| C-032 | Elecmon | Elecmon |
| C-033 | Elecmon (Violet) | Elecmon (Violet) |
| C-034 | Elizamon | Elizamon |
| C-035 | Falcomon | Falcomon |
| C-036 | Floramon | Floramon |
| C-037 | Fujamon | Fujamon |
| C-038 | FunBeemon | FunBeemon |
| C-039 | Gabumon | Gabumon |
| C-040 | Gabumon (Black) | Gabumon (Black) |
| C-041 | Gabumon (X Antibody) | Gabumon (X Antibody) |
| C-042 | Gammamon | Gammamon |
| C-043 | Ganimon | Crabmon |
| C-044 | Gaomon | Gaomon |
| C-045 | Gaossmon | Gaossmon |
| C-046 | Gasamon | Gasamon |
| C-047 | Gazimon | Gazimon |
| C-048 | Gazimon (X Antibody) | Gazimon (X Antibody) |
| C-049 | Ghostmon | Ghostmon |
| C-050 | Gizamon | Gizamon |
| C-051 | Goburimon | Goblimon |
| C-052 | Gomamon | Gomamon |
| C-053 | Gomamon (X Antibody) | Gomamon (X Antibody) |
| C-054 | Gottsumon | Gotsumon |
| C-055 | Gottsumon (X Antibody) | Gotsumon (X Antibody) |
| C-056 | Guilmon | Guilmon |
| C-057 | Guilmon (X Antibody) | Guilmon (X Antibody) |
| C-058 | Gumdramon | Gumdramon |
| C-059 | Hagurumon | Hagurumon |
| C-060 | Hagurumon (X Antibody) | Hagurumon (X Antibody) |
| C-061 | Hanimon | Hanimon |
| C-062 | Hawkmon | Hawkmon |
| C-063 | Herissmon | Herissmon |
| C-064 | Hackmon | Huckmon |
| C-065 | Hyokomon | Hyokomon |
| C-066 | Impmon | Impmon |
| C-067 | Impmon (X Antibody) | Impmon (X Antibody) |
| C-068 | Jazamon | Jazamon |
| C-069 | Jellymon | Jellymon |
| C-070 | Junkmon | Junkmon |
| C-071 | Kakamon | Kakamon |
| C-072 | Kamemon | Kamemon |
| C-073 | Keramon | Keramon |
| C-074 | Keramon (X Antibody) | Keramon (X Antibody) |
| C-075 | KoDokugumon | KoDokugumon |
| C-076 | Koemon | Monmon |
| C-077 | KoKabuterimon | KoKabuterimon |
| C-078 | Kokuwamon | Kokuwamon |
| C-079 | Kokuwamon (X Antibody) | Kokuwamon (X Antibody) |
| C-080 | Kotemon | Kotemon |
| C-081 | Kudamon | Kudamon |
| C-082 | Kunemon | Kunemon |
| C-083 | Labramon | Labramon |
| C-084 | Lalamon | Lalamon |
| C-085 | Liollmon | Liollmon |
| C-086 | Loogamon | Loogamon |
| C-087 | Lopmon | Lopmon |
| C-088 | Lopmon (X Antibody) | Lopmon (X Antibody) |
| C-089 | Lucemon | Lucemon |
| C-090 | Ludomon | Ludomon |
| C-091 | Lunamon | Lunamon |
| C-092 | Luxmon | Luxmon |
| C-093 | ModokiBetamon | ModokiBetamon |
| C-094 | Monodramon | Monodramon |
| C-095 | Morphomon | Morphomon |
| C-096 | Muchomon | Muchomon |
| C-097 | Mushmon | Mushroomon |
| C-098 | Neamon | Neemon |
| C-099 | Otamamon | Otamamon |
| C-100 | Otamamon (Red) | Otamamon (Red) |
| C-101 | Otamamon (X Antibody) | Otamamon (X Antibody) |
| C-102 | Palmon | Palmon |
| C-103 | Palmon (X Antibody) | Palmon (X Antibody) |
| C-104 | Patamon | Patamon |
| C-105 | Paunchessmon (Black) | PawnChessmon (Black) |
| C-106 | Paunchessmon (White) | PawnChessmon (White) |
| C-107 | Penmon | Penmon |
| C-108 | Phascomon | Phascomon |
| C-109 | PicoDevimon | DemiDevimon |
| C-110 | Pillomon | Pillomon |
| C-111 | Piyomon | Biyomon |
| C-112 | Plotmon | Salamon |
| C-113 | Plotmon (X Antibody) | Salamon (X Antibody) |
| C-114 | Pomumon | Pomumon |
| C-115 | Psychemon | Psychemon |
| C-116 | Pteromon | Pteromon |
| C-117 | Pulsemon | Pulsemon |
| C-118 | Renamon | Renamon |
| C-119 | Renamon (X Antibody) | Renamon (X Antibody) |
| C-120 | Ryudamon | Ryudamon |
| C-121 | Sangomon | Sangomon |
| C-122 | Shakomon | Syakomon |
| C-123 | Shakomon (X Antibody) | Syakomon (X Antibody) |
| C-124 | Shoemon | Shoemon |
| C-125 | Shoutmon | Shoutmon |
| C-126 | Sistermon Blanc | Sistermon Blanc |
| C-127 | SnowGoburimon | SnowGoblimon |
| C-128 | Solarmon | Solarmon |
| C-129 | Spadamon | Spadamon |
| C-130 | Starmons | Starmons |
| C-131 | Sunarizamon | Sunarizamon |
| C-132 | Swimmon | Swimmon |
| C-133 | Takinmon | Takinmon |
| C-134 | Tentomon | Tentomon |
| C-135 | Terriermon | Terriermon |
| C-136 | Terriermon Assistant | Terriermon Assistant |
| C-137 | Terriermon (X Antibody) | Terriermon (X Antibody) |
| C-138 | Tinkermon | Tinkermon |
| C-139 | ToyAgumon | ToyAgumon |
| C-140 | ToyAgumon (Black) | ToyAgumon (Black) |
| C-141 | Tukaimon | Tsukaimon |
| C-142 | Tyumon | Chuumon |
| C-143 | Ukkomon | Ukkomon |
| C-144 | V-mon | Veemon |
| C-145 | Vorvomon | Vorvomon |
| C-146 | Wankomon | Wankomon |
| C-147 | Wormmon | Wormmon |
| C-148 | YukiAgumon | SnowAgumon |
| C-149 | Zenimon | Zenimon |
| C-150 | Zubamon | Zubamon |
| UN-001 | Culumon | Calumon |
| A-001 | Arkadimon | Arkadimon Adult |
| A-002 | RedV-dramon | RedVeedramon |
| A-003 | Aegiomon | Aegiomon |
| A-004 | Airdramon | Airdramon |
| A-005 | Akatorimon | Akatorimon |
| A-006 | Algomon | Argomon |
| A-007 | Allomon (X Antibody) | Allomon (X Antibody) |
| A-008 | Angemon | Angemon |
| A-009 | Ankylomon | Ankylomon |
| A-010 | Aquilamon | Aquilamon |
| A-011 | Arresterdramon | Arresterdramon |
| A-012 | Baboongamon | Baboongamon |
| A-013 | Bakemon | Bakemon |
| A-014 | Baluchimon | Baluchimon |
| A-015 | BaoHuckmon | BaoHuckmon |
| A-016 | BetelGammamon | BetelGammamon |
| A-017 | Birdramon | Birdramon |
| A-018 | BlackGalgomon | BlackGargomon |
| A-019 | BlackGaogamon | BlackGaogamon |
| A-020 | BlackGrowmon | BlackGrowlmon |
| A-021 | BlackTailmon | BlackGatomon |
| A-022 | BladeKuwagamon | BladeKuwagamon |
| A-023 | Boogiemon | Boogiemon |
| A-024 | Bulkmon | Bulkmon |
| A-025 | Buraimon | Buraimon |
| A-026 | Centalmon | Centarumon |
| A-027 | Chamblemon | Chamblemon |
| A-028 | Chrysalimon | Kurisarimon |
| A-029 | Clockmon | Clockmon |
| A-030 | Cockatrimon | Kokatorimon |
| A-031 | Coelamon | Coelamon |
| A-032 | Coredramon (Blue) | Coredramon (Blue) |
| A-033 | Coredramon (Green) | Coredramon (Green) |
| A-034 | Cyclomon | Cyclonemon |
| A-035 | Damemon | Damemon |
| A-036 | Darcmon | Darcmon |
| A-037 | DarkLizamon | DarkLizardmon |
| A-038 | DarkMaildramon | DarkMaildramon |
| A-039 | DarkTyranomon | DarkTyrannomon |
| A-040 | DarkTyranomon (X Antibody) | DarkTyrannomon (X Antibody) |
| A-041 | Death-X-Dorugamon | DexDorugamon |
| A-042 | Deckerdramon | Deckerdramon |
| A-043 | Deltamon | Deltamon |
| A-044 | Devidramon | Devidramon |
| A-045 | Devimon | Devimon |
| A-046 | Diatrymon | Diatrymon |
| A-047 | Dimetromon | Dimetromon |
| A-048 | Dinohumon | Dinohyumon |
| A-049 | Dobermon | Dobermon |
| A-050 | Dogmon | Doggymon |
| A-051 | Dokugumon | Dokugumon |
| A-052 | DORUgamon | Dorugamon |
| A-053 | Dorulumon | Dorulumon |
| A-054 | Drimogemon | Drimogemon |
| A-055 | Ebidramon | Ebidramon |
| A-056 | Eosmon | Eosmon |
| A-057 | Exermon | Exermon |
| A-058 | Eyesmon | Eyesmon |
| A-059 | Fangmon | Fangmon |
| A-060 | Filmon | Filmon |
| A-061 | Firamon | Firamon |
| A-062 | FlareLizamon | Flarerizamon |
| A-063 | Flymon | Flymon |
| A-064 | Fugamon | Fugamon |
| A-065 | Galemon | Galemon |
| A-066 | Galgomon | Gargomon |
| A-067 | Ganemon | Ganemon |
| A-068 | Gaogamon | Gaogamon |
| A-069 | Gardromon (Gold) | Guardromon (Gold) |
| A-070 | Garurumon | Garurumon |
| A-071 | Garurumon (Black) | Garurumon (Black) |
| A-072 | Garurumon (X Antibody) | Garurumon (X Antibody) |
| A-073 | Gawappamon | Gawappamon |
| A-074 | Gekomon | Gekomon |
| A-075 | GeoGreymon | GeoGreymon |
| A-076 | Geremon | Geremon |
| A-077 | Gesomon | Gesomon |
| A-078 | Ginkakumon | Ginkakumon |
| A-079 | Ginryumon | Ginryumon |
| A-080 | Gladimon | Gladimon |
| A-081 | Gokimon | Roachmon |
| A-082 | GoldNumemon | GoldNumemon |
| A-083 | Golemon | Golemon |
| A-084 | Gorimon | Gorillamon |
| A-085 | Greymon (2010) | Greymon (2010) |
| A-086 | Greymon | Greymon |
| A-087 | Greymon (Blue) | Greymon (Blue) |
| A-088 | Greymon (X Antibody) | Greymon (X Antibody) |
| A-089 | Growmon | Growlmon |
| A-090 | Growmon (Orange) | Growlmon (Orange) |
| A-091 | Growmon (X Antibody) | Growlmon (X Antibody) |
| A-092 | Gryzmon | Grizzlymon |
| A-093 | Guardromon | Guardromon |
| A-094 | GulusGammamon | GulusGammamon |
| A-095 | Gururumon | Gururumon |
| A-096 | Hakubamon | Hakubamon |
| A-097 | Hanumon | Apemon |
| A-098 | Hi-Commandramon | Hi-Commandramon |
| A-099 | Hookmon | Hookmon |
| A-100 | Hudiemon | Hudiemon |
| A-101 | Hyougamon | Hyogamon |
| A-102 | IceDevimon | IceDevimon |
| A-103 | Icemon | Icemon |
| A-104 | Igamon | Ninjamon |
| A-105 | Ikkakumon | Ikkakumon |
| A-106 | Jazardmon | Jazardmon |
| A-107 | JungleMojyamon | JungleMojyamon |
| A-108 | Kabuterimon | Kabuterimon |
| A-109 | KaratukiNumemon | ShellNumemon |
| A-110 | KausGammamon | KausGammamon |
| A-111 | Kinkakumon | Kinkakumon |
| A-112 | Kiwimon | Kiwimon |
| A-113 | KnightChessmon (White) | KnightChessmon (White) |
| A-114 | KnightChessmon (Black) | KnightChessmon (Black) |
| A-115 | Kokeshimon | Kokeshimon |
| A-116 | Komondomon | Komondomon |
| A-117 | Kougamon | Kogamon |
| A-118 | Kuwagamon | Kuwagamon |
| A-119 | Kuwagamon (X Antibody) | Kuwagamon (X Antibody) |
| A-120 | Kyubimon | Kyubimon |
| A-121 | Lavorvomon | Lavorvomon |
| A-122 | Lekismon | Lekismon |
| A-123 | Leomon | Leomon |
| A-124 | Leomon (X Antibody) | Leomon (X Antibody) |
| A-125 | Liamon | Liamon |
| A-126 | Lianpumon | Lianpumon |
| A-127 | Loogarmon | Loogarmon |
| A-128 | Machmon | Machmon |
| A-129 | MadLeomon | MadLeomon |
| A-130 | MailBirdramon | MailBirdramon |
| A-131 | Manekimon | Manekimon |
| A-132 | Mantaraymon (X Antibody) | Mantaraymon (X Antibody) |
| A-133 | Mechanorimon | Mekanorimon |
| A-134 | Meicoomon | Meicoomon |
| A-135 | Meramon | Meramon |
| A-136 | Meramon (X Antibody) | Meramon (X Antibody) |
| A-137 | Mikemon | Mikemon |
| A-138 | Mimicmon | Mimicmon |
| A-139 | Minotaurmon | Minotarumon |
| A-140 | Mojyamon | Mojyamon |
| A-141 | Monochromon | Monochromon |
| A-142 | Monochromon (X Antibody) | Monochromon (X Antibody) |
| A-143 | MoriShellmon | MoriShellmon |
| A-144 | Musyamon | Musyamon |
| A-145 | Nanimon | Nanimon |
| A-146 | Nefertimon (X Antibody) | Nefertimon (X Antibody) |
| A-147 | NiseDrimogemon | NiseDrimogemon |
| A-148 | Numemon | Numemon |
| A-149 | Numemon (X Antibody) | Numemon (X Antibody) |
| A-150 | Octmon | Octomon |
| A-151 | Omekamon | Omekamon |
| A-152 | Orgemon | Ogremon |
| A-153 | Orgemon (X Antibody) | Ogremon (X Antibody) |
| A-154 | Paledramon | Paledramon |
| A-155 | Parasaurmon | Parasaurmon |
| A-156 | Peckmon | Peckmon |
| A-157 | Pegasmon (X Antibody) | Pegasusmon (X Antibody) |
| A-158 | Petermon | Petermon |
| A-159 | Pidmon | Piddomon |
| A-160 | PlatinaSukamon | PlatinumSukamon |
| A-161 | Porcupamon | Porcupamon |
| A-162 | Pteranomon (X Antibody) | Pteramon (X Antibody) |
| A-163 | Publimon | Publimon |
| A-164 | Punkmon | Punkmon |
| A-165 | Raptordramon | Raptordramon |
| A-166 | Raremon | Raremon |
| A-167 | RedVegimon | RedVegiemon |
| A-168 | Reppamon | Reppamon |
| A-169 | Revolmon | Deputymon |
| A-170 | Rhinomon (X Antibody) | Rhinomon (X Antibody) |
| A-171 | Rukamon | Dolphmon |
| A-172 | Saberdramon | Saberdramon |
| A-173 | SandYammamon | SandYanmamon |
| A-174 | Sangloupmon | Sangloupmon |
| A-175 | Scumon | Sukamon |
| A-176 | Seadramon | Seadramon |
| A-177 | Seadramon (X Antibody) | Seadramon (X Antibody) |
| A-178 | Sealsdramon | Sealsdramon |
| A-179 | Shellmon | Shellmon |
| A-180 | ShimaUnimon | ShimaUnimon |
| A-181 | ShoeShoemon | ShoeShoemon |
| A-182 | Shoutmon (King) | Shoutmon (King) |
| A-183 | Shoutmon X2 | Shoutmon X2 |
| A-184 | Shoutmon X3 | Shoutmon X3 |
| A-185 | Shoutmon X4 | Shoutmon X4 |
| A-186 | Siesamon | Seasarmon |
| A-187 | Siesamon (X Antibody) | Seasarmon (X Antibody) |
| A-188 | Sistermon Ciel | Sistermon Ciel |
| A-189 | Sistermon Ciel (Awakened) | Sistermon Ciel (Awakened) |
| A-190 | Sistermon Noir | Sistermon Noir |
| A-191 | Snatchmon | Snatchmon |
| A-192 | Snimon | Snimon |
| A-193 | Sorcerimon | Sorcermon |
| A-194 | Soulmon | Soulmon |
| A-195 | Starmon | Starmon |
| A-196 | Stingmon | Stingmon |
| A-197 | Strikedramon | Strikedramon |
| A-198 | Sunflowmon | Sunflowmon |
| A-199 | SymbareAngoramon | SymbareAngoramon |
| A-200 | Tailmon | Gatomon |
| A-201 | Tailmon (X Antibody) | Gatomon (X Antibody) |
| A-202 | Tankmon | Tankmon |
| A-203 | Targetmon | Targetmon |
| A-204 | TeslaJellymon | TeslaJellymon |
| A-205 | Thunderballmon | Thundermon |
| A-206 | Thunderballmon (X Antibody) | Thundermon (X Antibody) |
| A-207 | TiaLudomon | TiaLudomon |
| A-208 | Tobiumon | Tobiumon |
| A-209 | Tobucatmon | TobuCatmon |
| A-210 | Togemon | Togemon |
| A-211 | Togemon (X Antibody) | Togemon (X Antibody) |
| A-212 | Tortamon | Tortomon |
| A-213 | Trailmon | Trailmon |
| A-214 | Troopmon | Troopmon |
| A-215 | Tuchidarumon | MudFrigimon |
| A-216 | Turuiemon | Turuiemon |
| A-217 | Tuskmon | Tuskmon |
| A-218 | Tylomon (X Antibody) | Tylomon (X Antibody) |
| A-219 | Tyranomon | Tyrannomon |
| A-220 | Tyranomon (X Antibody) | Tyrannomon (X Antibody) |
| A-221 | V-dramon | Veedramon |
| A-222 | Vegimon | Vegiemon |
| A-223 | Waspmon | Waspmon |
| A-224 | Wendimon | Wendigomon |
| A-225 | WezenGammamon | WezenGammamon |
| A-226 | Whamon | Whamon |
| A-227 | Witchmon | Witchmon |
| A-228 | Wizarmon | Wizardmon |
| A-229 | Wizarmon (X Antibody) | Wizardmon (X Antibody) |
| A-230 | Wolvermon | Wolvermon |
| A-231 | Woodmon | Woodmon |
| A-232 | Xiquemon | Xiquemon |
| A-233 | XV-mon | ExVeemon |
| A-234 | Yammamon | Yanmamon |
| A-235 | Youkomon | Youkomon |
| A-236 | Yukidarumon | Frigimon |
| A-237 | Unimon | Unimon |
| A-238 | Zassoumon | Weedmon |
| A-239 | Zubaeagermon | ZubaEagermon |
| AR-001 | Allomon | Allomon |
| AR-002 | Archelomon | Archelomon |
| AR-003 | Baromon | Baronmon |
| AR-004 | Bitmon | Rabbitmon |
| AR-005 | Boamon | Boarmon |
| AR-006 | Bullmon | Bullmon |
| AR-007 | Butterflamon | Butterflymon |
| AR-008 | Chamelemon | Chameleonmon |
| AR-009 | Depthmon | Depthmon |
| AR-010 | Digmon | Digmon |
| AR-011 | Elephamon | Elephantmon |
| AR-012 | Fladramon | Flamedramon |
| AR-013 | Flybeemon | Flybeemon |
| AR-014 | Frogmon | Frogmon |
| AR-015 | Gargomon | Gargoylemon |
| AR-016 | Goatmon | Goatmon |
| AR-017 | GoldV-dramon | GoldVeedramon |
| AR-018 | Harpymon | Harpymon |
| AR-019 | Holsmon | Halsemon |
| AR-020 | Honeybeemon | Honeybeemon |
| AR-021 | Kabukimon | Kabukimon |
| AR-022 | Kangarumon | Kangarumon |
| AR-023 | Kenkimon | Kenkimon |
| AR-024 | Kongoumon | Kongoumon |
| AR-025 | Lighdramon | Lighdramon |
| AR-026 | Lynxmon | Lynxmon |
| AR-027 | Magnamon | Magnamon |
| AR-028 | Maildramon | Maildramon |
| AR-029 | Manbomon | Manbomon |
| AR-030 | Mantaraymon | Mantaraymon |
| AR-031 | Moosemon | Moosemon |
| AR-032 | Mothmon | Mothmon |
| AR-033 | Nefertimon | Nefertimon |
| AR-034 | Nohemon | Nohemon |
| AR-035 | Opossummon | Opossummon |
| AR-036 | Orcamon | Orcamon |
| AR-037 | Owlmon | Aurumon |
| AR-038 | Peacockmon | Peacockmon |
| AR-039 | Pegasmon | Pegasusmon |
| AR-040 | Pipismon | Pipismon |
| AR-041 | Ponchomon | Ponchomon |
| AR-042 | Prairiemon | Prairiemon |
| AR-043 | Pteranomon | Pteramon |
| AR-044 | Pucchiemon | Bucchiemon |
| AR-045 | Pucchiemon (Green) | Bucchiemon (Green) |
| AR-046 | Quetzalmon | Quetzalmon |
| AR-047 | Rapidmon (Gold) | Rapidmon (Gold) |
| AR-048 | Rhinomon | Rhinomon |
| AR-049 | Rinkmon | Rinkmon |
| AR-050 | Submarimon | Submarimon |
| AR-051 | Sagittarimon | Sagittarimon |
| AR-052 | Salamandamon | Salamandermon |
| AR-053 | Seahomon | Seahomon |
| AR-054 | Searchmon | Searchmon |
| AR-055 | Sepikmon | Sepikmon |
| AR-056 | Sethmon | Sethmon |
| AR-057 | Shadramon | Shadramon |
| AR-058 | Sheepmon | Sheepmon |
| AR-059 | Shurimon | Shurimon |
| AR-060 | Stegomon | Stegomon |
| AR-061 | Swanmon | Swanmon |
| AR-062 | Thunderbirmon | Thunderbirdmon |
| AR-063 | Tocanmon | Toucanmon |
| AR-064 | Togemogumon | Togemogumon |
| AR-065 | Tylomon | Tylomon |
| AR-066 | Yaksamon | Yasyamon |
| H-001 | Agnimon | Agunimon |
| H-002 | Aldamon | Aldamon |
| H-003 | Arbormon | Arbormon |
| H-004 | Beowolfmon | Beowolfmon |
| H-005 | Blitzmon | Beetlemon |
| H-006 | Blizzarmon | Korikakumon |
| H-007 | Bolgmon | MetalKabuterimon |
| H-008 | Calamaramon | Calmaramon |
| H-009 | Chackmon | Kumamon |
| H-010 | DaiPenmon | DaiPenmon |
| H-011 | Duskmon | Duskmon |
| H-012 | Fairimon | Kazemon |
| H-013 | Garummon | KendoGarurumon |
| H-014 | Gigasmon | Gigasmon |
| H-015 | Grottemon | Grumblemon |
| H-016 | JetSilphymon | JetSilphymon |
| H-017 | KaiserGreymon | EmperorGreymon |
| H-018 | KaiserLeomon | JagerLoweemon |
| H-019 | MagnaGarurumon | MagnaGarurumon |
| H-020 | Mercuremon | Mercuremon |
| H-021 | Petaldramon | Petaldramon |
| H-022 | Raihimon | Rhihimon |
| H-023 | Ranamon | Lanamon |
| H-024 | RhinoKabuterimon | RhinoKabuterimon |
| H-025 | Sephirothmon | Sephirothmon |
| H-026 | Shutumon | Zephyrmon |
| H-027 | Velgrmon | Velgrmon |
| H-028 | Vritramon | BurningGreymon |
| H-029 | Wolfmon | Lobomon |
| P-001 | Arkadimon | Arcadiamon |
| P-002 | Aegiochusmon | Aegiochusmon |
| P-003 | Ajatarmon | Ajatarmon |
| P-004 | Algomon | Argomon |
| P-005 | Andiramon (Deva) | Antylamon (Deva) |
| P-006 | Andiramon | Antylamon |
| P-007 | Andromon | Andromon |
| P-008 | Angewomon | Angewomon |
| P-009 | Angewomon (X Antibody) | Angewomon (X Antibody) |
| P-010 | Anomalocarimon | Scorpiomon |
| P-011 | Anomalocarimon (X Antibody) | Scorpiomon (X Antibody) |
| P-012 | Archnemon | Arukenimon |
| P-013 | Arresterdramon (Superior Mode) | Arresterdramon (Superior Mode) |
| P-014 | Astamon | Astamon |
| P-015 | Asuramon | Asuramon |
| P-016 | AtlurKabuterimon (Red) | MegaKabuterimon (Red) |
| P-017 | AtlurKabuterimon (Blue) | MegaKabuterimon (Blue) |
| P-018 | Azhdarmon | Azhdarmon |
| P-019 | Baalmon | Baalmon |
| P-020 | Bastemon | Bastemon |
| P-021 | Betsumon | Betsumon |
| P-022 | BigMamemon | BigMamemon |
| P-023 | BishopChessmon | BishopChessmon |
| P-024 | BlackKingNumemon | BlackKingNumemon |
| P-025 | BlackMachGaogamon | BlackMachGaogamon |
| P-026 | BlackMegaloGrowmon | BlackWarGrowlmon |
| P-027 | BlackRapidmon | BlackRapidmon |
| P-028 | Blossomon | Blossomon |
| P-029 | BlueMeramon | BlueMeramon |
| P-030 | Boutmon | Boutmon |
| P-031 | Brakimon | Brachiomon |
| P-032 | Butenmon | Butenmon |
| P-033 | CannonBeemon | CannonBeemon |
| P-034 | Canoweissmon | Canoweissmon |
| P-035 | CaptainHookmon | CaptainHookmon |
| P-036 | Cargodramon | Cargodramon |
| P-037 | CatchMamemon | CatchMamemon |
| P-038 | Caturamon | Caturamon |
| P-039 | Cerberumon | Cerberusmon |
| P-040 | Cerberumon (Werewolf Mode) | Cerberusmon (Werewolf Mode) |
| P-041 | Cerberumon (X Antibody) | Cerberusmon (X Antibody) |
| P-042 | Chaperomon | Chaperomon |
| P-043 | Chimairamon | Kimeramon |
| P-044 | Cho-Hakkaimon | Cho-Hakkaimon |
| P-045 | Climbmon | Climbmon |
| P-046 | Crescemon | Crescemon |
| P-047 | CrysPaledramon | CrysPaledramon |
| P-048 | Cyberdramon | Cyberdramon |
| P-049 | Cyberdramon (X Antibody) | Cyberdramon (X Antibody) |
| P-050 | Dagomon | Dragomon |
| P-051 | DarkKnightmon | DarkKnightmon |
| P-052 | DarkSuperStarmon | DarkSuperStarmon |
| P-053 | Darumamon | Darumamon |
| P-054 | Death-X-DORUguremon | DexDoruGreymon |
| P-055 | DeathMeramon | SkullMeramon |
| P-056 | Delumon | Deramon |
| P-057 | Destromon | Destromon |
| P-058 | Digitamamon | Digitamamon |
| P-059 | Dinobeemon | Dinobeemon |
| P-060 | Divemon | Divemon |
| P-061 | DORUguremon | DoruGreymon |
| P-062 | Doumon | Doumon |
| P-063 | Duramon | Duramon |
| P-064 | AeroV-dramon | AeroVeedramon |
| P-065 | Entmon | Entmon |
| P-066 | Eosmon | Eosmon |
| P-067 | Etemon | Etemon |
| P-068 | Ex-Tyranomon | ExTyrannomon |
| P-069 | Fantomon | Phantomon |
| P-070 | Flaremon | Flaremon |
| P-071 | Frozomon | Frozomon |
| P-072 | Garudamon | Garudamon |
| P-073 | Garudamon (X Antibody) | Garudamon (X Antibody) |
| P-074 | Gerbemon | Garbagemon |
| P-075 | Ghilliedhumon | Ghilliedhumon |
| P-076 | Gigadramon | Gigadramon |
| P-077 | Giromon | Giromon |
| P-078 | Gogmamon | Gogmamon |
| P-079 | Gokuwmon | Gokuumon |
| P-080 | Grademon | Grademon |
| P-081 | GrandGalemon | GrandGalemon |
| P-082 | GrappuLeomon | GrapLeomon |
| P-083 | Gravimon | Gravimon |
| P-084 | GreatKingScumon | KingSukamon |
| P-085 | Groundramon | Groundramon |
| P-086 | Gusokumon | Gusokumon |
| P-087 | Gyukimon | Gyuukimon |
| P-088 | Hangyomon | Divermon |
| P-089 | Helloogarmon | Helloogarmon |
| P-090 | Hippogriffomon | HippoGryphonmon |
| P-091 | Hisyaryumon | Hisyaryumon |
| P-092 | HolyAngemon | MagnaAngemon |
| P-093 | Huankunmon | Huankunmon |
| P-094 | Infermon | Infermon |
| P-095 | Insekimon | Meteormon |
| P-096 | Jazarichmon | Jazarichmon |
| P-097 | Jewelbeemon | JewelBeemon |
| P-098 | Jokermon | Jokermon |
| P-099 | Jyagamon | Jagamon |
| P-100 | Jyureimon | Cherrymon |
| P-101 | Karakurumon | Karakurumon |
| P-102 | Karatenmon | Karatenmon |
| P-103 | Knightmon | Knightmon |
| P-104 | Kumbhiramon | Kumbhiramon |
| P-105 | Kyukimon | Kyukimon |
| P-106 | LadyDevimon | LadyDevimon |
| P-107 | LadyDevimon (X Antibody) | LadyDevimon (X Antibody) |
| P-108 | Lamiamon | Lamiamon |
| P-109 | Lamortmon | Lamortmon |
| P-110 | Lavogaritamon | Lavogaritamon |
| P-111 | Lilamon | Lilamon |
| P-112 | Lilimon | Lillymon |
| P-113 | Lilimon (X Antibody) | Lillymon (X Antibody) |
| P-114 | LoaderLeomon | LoaderLeomon |
| P-115 | Locomon | Locomon |
| P-116 | Loudmon | Loudmon |
| P-117 | Luminamon | Luminamon |
| P-118 | MachGaogamon | MachGaogamon |
| P-119 | Majiramon | Majiramon |
| P-120 | Makuramon | Makuramon |
| P-121 | Mamemon | Mamemon |
| P-122 | Mamemon (X Antibody) | Mamemon (X Antibody) |
| P-123 | Mametyramon | Mametyramon |
| P-124 | Mammon | Mammothmon |
| P-125 | Mammon (X Antibody) | Mammothmon (X Antibody) |
| P-126 | Manticoremon | Manticoremon |
| P-127 | MarinBullmon | MarineBullmon |
| P-128 | MarinChimairamon | MarineChimairamon |
| P-129 | MarinDevimon | MarineDevimon |
| P-130 | MasterTyranomon | MasterTyrannomon |
| P-131 | Matadrmon | Matadormon |
| P-132 | Megadramon | Megadramon |
| P-133 | MegaloGrowmon (Orange) | WarGrowlmon (Orange) |
| P-134 | MegaloGrowmon | WarGrowlmon |
| P-135 | MegaloGrowmon (X Antibody) | WarGrowlmon (X Antibody) |
| P-136 | MegaSeadramon | MegaSeadramon |
| P-137 | MegaSeadramon (X Antibody) | MegaSeadramon (X Antibody) |
| P-138 | Meicrackmon | Maycrackmon |
| P-139 | Meicrackmon (Vicious Mode) | Maycrackmon (Vicious Mode) |
| P-140 | Mephismon | Mephistomon |
| P-141 | Mephismon (X Antibody) | Mephistomon (X Antibody) |
| P-142 | Mermaimon | Mermaimon |
| P-143 | MetalFantomon | MetalPhantomon |
| P-144 | MetalGreymon (Vaccine) | MetalGreymon (Vaccine) |
| P-145 | MetalGreymon | MetalGreymon |
| P-146 | MetalGreymon (Alterous Mode) | MetalGreymon (Alterous Mode) |
| P-147 | MetalGreymon (X Antibody) | MetalGreymon (X Antibody) |
| P-148 | MetalGreymon (X Antibody) | MetalGreymon (X Antibody) |
| P-149 | MetallifeKuwagamon | MetallifeKuwagamon |
| P-150 | MetalMamemon | MetalMamemon |
| P-151 | MetalMamemon (X Antibody) | MetalMamemon (X Antibody) |
| P-152 | MetalTyranomon | MetalTyrannomon |
| P-153 | Metal Tyranomon (X Antibody) | MetalTyrannomon (X Antibody) |
| P-154 | Mihiramon | Mihiramon |
| P-155 | Mistymon | Mistymon |
| P-156 | Monzaemon | Monzaemon |
| P-157 | Monzaemon (X Antibody) | Monzaemon (X Antibody) |
| P-158 | Mummymon | Mummymon |
| P-159 | Nanomon | Datamon |
| P-160 | NeoDevimon | NeoDevimon |
| P-161 | Oboromon | Oboromon |
| P-162 | Okuwamon | Okuwamon |
| P-163 | Okuwamon (X Antibody) | Okuwamon (X Antibody) |
| P-164 | Oleamon | Oleamon |
| P-165 | OmegaShoutmon | OmniShoutmon |
| P-166 | OmegaShoutmon (X Antibody) | OmniShoutmon (X Antibody) |
| P-167 | Orochimon | Orochimon |
| P-168 | Paildramon | Paildramon |
| P-169 | Pajiramon | Pajiramon |
| P-170 | Pandamon | Pandamon |
| P-171 | Panjyamon | IceLeomon |
| P-172 | Panjyamon (X Antibody) | IceLeomon (X Antibody) |
| P-173 | Parrotmon | Parrotmon |
| P-174 | Piccolomon | Piximon |
| P-175 | Piranimon | Piranimon |
| P-176 | Pistmon | Pistmon |
| P-177 | Pumpmon | Pumpkinmon |
| P-178 | RaijiLudomon | RaijiLudomon |
| P-179 | Rapidmon | Rapidmon |
| P-180 | Rebellimon | Rebellimon |
| P-181 | Regulusmon | Regulusmon |
| P-182 | RizeGreymon | RizeGreymon |
| P-183 | RizeGreymon (X Antibody) | RizeGreymon (X Antibody) |
| P-184 | RookChessmon | RookChessmon |
| P-185 | Lucemon (Falldown Mode) | Lucemon (Chaos Mode) |
| P-186 | Sagomon | Sagomon |
| P-187 | Sandiramon | Sandiramon |
| P-188 | Sanzomon | Sanzomon |
| P-189 | SaviorHackmon | SaviorHuckmon |
| P-190 | Scorpiomon | SkullScorpiomon |
| P-191 | Shakkoumon | Shakkoumon |
| P-192 | Shawujinmon | Shaujinmon |
| P-193 | Shishimamon | Shishimamon |
| P-194 | Shootmon | Shootmon |
| P-195 | Shoutmon X5 | Shoutmon X5 |
| P-196 | Silphymon | Silphymon |
| P-197 | Sinduramon | Sinduramon |
| P-198 | Sirenmon | Sirenmon |
| P-199 | SkullBaluchimon | SkullBaluchimon |
| P-200 | SkullGreymon | SkullGreymon |
| P-201 | SkullSatamon | SkullSatamon |
| P-202 | Soloogarmon | Soloogarmon |
| P-203 | Splashmon | Splashmon |
| P-204 | Stiffilmon | Stefilmon |
| P-205 | SuperStarmon | SuperStarmon |
| P-206 | Tankdramon | Tankdramon |
| P-207 | Taomon | Taomon |
| P-208 | Tekkamon | Tekkamon |
| P-209 | Tempomon | Tempomon |
| P-210 | Thetismon | Thetismon |
| P-211 | TonosamaGekomon | ShogunGekomon |
| P-212 | Toropiamon | Toropiamon |
| P-213 | Triceramon | Triceramon |
| P-214 | Triceramon (X Antibody) | Triceramon (X Antibody) |
| P-215 | Tyilinmon | Chirinmon |
| P-216 | Vademon | Vademon |
| P-217 | Vajramon | Vajramon |
| P-218 | Valvemon | Bulbmon |
| P-219 | Vamdemon | Myotismon |
| P-220 | Vamdemon (X Antibody) | Myotismon (X Antibody) |
| P-221 | Vermillimon | Vermilimon |
| P-222 | Vespamon | Vespamon |
| P-223 | Vikaralamon | Vikaralamon |
| P-224 | Volcamon | Volcanomon |
| P-225 | Volcdoramon | Volcdramon |
| P-226 | Vulturemon | Vulturemon |
| P-227 | WaruMonzaemon | WaruMonzaemon |
| P-228 | WaruSeadramon | WaruSeadramon |
| P-229 | WereGarurumon | WereGarurumon |
| P-230 | WereGarurumon (Black) | WereGarurumon (Black) |
| P-231 | WereGarurumon (X Antibody) | WereGarurumon (X Antibody) |
| P-232 | Whamon | Whamon |
| P-233 | Wingdramon | Wingdramon |
| P-234 | Wisemon | Wisemon |
| P-235 | Xingtianmon | Xingtianmon |
| P-236 | Yatagaramon | Crowmon |
| P-237 | Yatagaramon (AXCEL) | Crowmon |
| P-238 | Zamielmon | Zamielmon |
| P-239 | Zudomon | Zudomon |
| U-001 | Abbadomon | Abbadomon |
| U-002 | Abbadomon Core | Abbadomon Core |
| U-003 | Achillesmon | Achillesmon |
| U-004 | Aegisdramon | Aegisdramon |
| U-005 | Algomon | Argomon |
| U-006 | Alphamon | Alphamon |
| U-007 | Amaterasumon | Amaterasumon |
| U-008 | Amphimon | Amphimon |
| U-009 | AncientBeatmon | AncientBeetlemon |
| U-010 | AncientGarurumon | AncientGarurumon |
| U-011 | AncientGreymon | AncientGreymon |
| U-012 | AncientIrismon | AncientKazemon |
| U-013 | AncientMegatheriumon | AncientMegatheriummon |
| U-014 | AncientMermaimon | AncientMermaimon |
| U-015 | AncientSphinxmon | AncientSphinxmon |
| U-016 | AncientTroiamon | AncientTroymon |
| U-017 | AncientVolcamon | AncientVolcanomon |
| U-018 | AncientWisemon | AncientWisemon |
| U-019 | Anubimon | Anubismon |
| U-020 | Apoclymon | Apocalymon |
| U-021 | Apollomon | Apollomon |
| U-022 | Arcturusmon | Arcturusmon |
| U-023 | Ariemon | Ariemon |
| U-024 | Armamon | Armamon |
| U-025 | Babamon | Babamon |
| U-026 | Bacchusmon | Bacchusmon |
| U-027 | Bagramon | Bagramon |
| U-028 | Baihumon | Baihumon |
| U-029 | BanchoGolemon | BanchoGolemon |
| U-030 | BanchoLeomon | BanchoLeomon |
| U-031 | BanchoLilimon | BanchoLillymon |
| U-032 | BanchoMamemon | BanchoMamemon |
| U-033 | BanchoStingmon | BanchoStingmon |
| U-034 | Barbamon | Barbamon |
| U-035 | BeelStarmon | BeelStarmon |
| U-036 | BeelStarmon (X Antibody) | BeelStarmon (X Antibody) |
| U-037 | Beelzebumon | Beelzemon |
| U-038 | Beelzebumon (2010) | Beelzemon (2010) |
| U-039 | BelialVamdemon | MaloMyotismon |
| U-040 | Belphemon (Rage Mode) | Belphemon (Rage Mode) |
| U-041 | BigUkkomon | BigUkkomon |
| U-042 | BlackSaintGalgomon | BlackSaintGargomon |
| U-043 | BlackSeraphimon | BlackSeraphimon |
| U-044 | BlackWarGreymon | BlackWarGreymon |
| U-045 | BlackWarGreymon (X Antibody) | BlackWarGreymon (X Antibody) |
| U-046 | Blastmon | Blastmon |
| U-047 | BlitzGreymon | BlitzGreymon |
| U-048 | Bloomlordmon | Bloomlordmon |
| U-049 | Boltmon | Boltmon |
| U-050 | Breakdramon | Breakdramon |
| U-051 | Brigadramon | Brigadramon |
| U-052 | BryweLudramon | BryweLudramon |
| U-053 | Callismon | Callismon |
| U-054 | Cannondramon | Cannondramon |
| U-055 | Cendrillmon | Cendrillmon |
| U-056 | Ceresmon | Ceresmon |
| U-057 | Cernumon | Cernumon |
| U-058 | Chaosdramon (X Antibody) | Chaosdramon (X Antibody) |
| U-059 | ChaosDukemon | ChaosGallantmon |
| U-060 | Cherubimon (Virtue) | Cherubimon (Good) |
| U-061 | Cherubimon (Vice) | Cherubimon (Black) |
| U-062 | Cherubimon (Virtue) (X Antibody) | Cherubimon (Good) (X Antibody) |
| U-063 | Cherubimon (Vice) (X Antibody) | Cherubimon (Black) (X Antibody) |
| U-064 | Chronomon (Destroy Mode) | Chronomon (Destroy Mode) |
| U-065 | Chronomon (Holy Mode) | Chronomon (Holy Mode) |
| U-066 | ClavisAngemon | ClavisAngemon |
| U-067 | Craniummon | Craniamon |
| U-068 | CresGarurumon | CresGarurumon |
| U-069 | Crossmon | Eaglemon |
| U-070 | Cthyllamon | Cthyllamon |
| U-071 | Dalphomon | Dalphomon |
| U-072 | Darkdramon | Darkdramon |
| U-073 | DarkKnightmon (X Antibody) | DarkKnightmon (X Antibody) |
| U-074 | Death-X-DORUgoramon | DexDorugoramon |
| U-075 | Death-X-Mon | DeathXmon |
| U-076 | Deathmon | Ghoulmon |
| U-077 | Deathmon (Black) | Ghoulmon (Black) |
| U-078 | Demon | Creepymon |
| U-079 | Devitamamon | Devitamamon |
| U-080 | Diablomon | Diaboromon |
| U-081 | Dianamon | Dianamon |
| U-082 | Diarbbitmon | Diarbbitmon |
| U-083 | Dijiangmon | Dijiangmon |
| U-084 | Dinomon | Dinomon |
| U-085 | Dinorexmon | Dinorexmon |
| U-086 | Dinotigermon | Dinotigermon |
| U-087 | Dominimon | Dominimon |
| U-088 | DoneDevimon | DoneDevimon |
| U-089 | DORUgoramon | Dorugoramon |
| U-090 | Duftmon | Leopardmon |
| U-091 | Dukemon | Gallantmon |
| U-092 | Dukemon (Crimson Mode) | Gallantmon (Crimson Mode) |
| U-093 | Durandamon | Durandamon |
| U-094 | Dynasmon | Dynasmon |
| U-095 | Ebemon | Ebemon |
| U-096 | Ebemon (X Antibody) | Ebemon (X Antibody) |
| U-097 | Eldoradimon | Eldradimon |
| U-098 | Enmamon | Enmamon |
| U-099 | Eosmon | Eosmon |
| U-100 | Erlangmon | Erlangmon |
| U-101 | Fenriloogamon | Fenriloogamon |
| U-102 | Fenriloogamon (Takemikazuchi) | Fenriloogamon (Takemikazuchi) |
| U-103 | FrosVelgrmon | FrosVelgrmon |
| U-104 | Fujinmon | Fujinmon |
| U-105 | Gaioumon | Gaiomon |
| U-106 | Gaioumon (Itto Mode) | Gaiomon (Itto Mode) |
| U-107 | Gankoomon | Gankoomon |
| U-108 | GigaSeadramon | GigaSeadramon |
| U-109 | Goddramon | Goldramon |
| U-110 | Goddramon (X Antibody) | Goldramon (X Antibody) |
| U-111 | Gokumon | Reapermon |
| U-112 | GrandDracumon | GranDracmon |
| U-113 | GrandisKuwagamon | GrandisKuwagamon |
| U-114 | GrandLocomon | GroundLocomon |
| U-115 | GranKuwagamon | GranKuwagamon |
| U-116 | Griffomon | Gryphonmon |
| U-117 | Gulfmon | Gulfmon |
| U-118 | Gundramon | Gundramon |
| U-119 | HeavyLeomon | HeavyLeomon |
| U-120 | HeavyMetaldramon | HeavyMetaldramon |
| U-121 | HerakleKabuterimon | HerculesKabuterimon |
| U-122 | HerakleKabuterimon (X Antibody) | HerculesKabuterimon (X Antibody) |
| U-123 | Hexeblaumon | Hexeblaumon |
| U-124 | HiAndromon | HiAndromon |
| U-125 | Holydramon | Magnadramon |
| U-126 | Holydramon (X Antibody) | Magnadramon (X Antibody) |
| U-127 | Hououmon | Phoenixmon |
| U-128 | Hououmon (X Antibody) | Phoenixmon (X Antibody) |
| U-129 | Huanglongmon | Fanglongmon |
| U-130 | Huanglongmon (Ruin Mode) | Fanglongmon (Ruin Mode) |
| U-131 | Hydramon | Hydramon |
| U-132 | Imperialdramon (Black) (Dragon Mode) | Imperialdramon (Black) (Dragon Mode) |
| U-133 | Imperialdramon (Dragon Mode) | Imperialdramon (Dragon Mode) |
| U-134 | Imperialdramon (Black) (Fighter Mode) | Imperialdramon (Black) (Fighter Mode) |
| U-135 | Invisimon | Invisimon |
| U-136 | Jesmon | Jesmon |
| U-137 | JetMervamon | JetMervamon |
| U-138 | Jijimon | Jijimon |
| U-139 | Jougamon | Jougamon |
| U-140 | JumboGamemon | JumboGamemon |
| U-141 | Junomon | Junomon |
| U-142 | Jupitermon | Jupitermon |
| U-143 | Justimon (Blitz Arm) | Justimon (Blitz Arm) |
| U-144 | Justimon (X Antibody) | Justimon (X Antibody) |
| U-145 | Kaguyamon | Kaguyamon |
| U-146 | Kazuchimon | Kazuchimon |
| U-147 | KingChessmon | KingChessmon |
| U-148 | KingEtemon | KingEtemon |
| U-149 | Kuzuhamon | Kuzuhamon |
| U-150 | Lampmon | Lampmon |
| U-151 | Leviamon | Leviamon |
| U-152 | Lilithmon | Lilithmon |
| U-153 | LordKnightmon | LordKnightmon |
| U-154 | Lotusmon | Lotosmon |
| U-155 | LovelyAngemon | LovelyAngemon |
| U-156 | Lucemon (Larva) | Lucemon (Larva) |
| U-157 | Lucemon (Satan Mode) | Lucemon (Satan Mode) |
| U-158 | MagnaKidmon | MagnaKidmon |
| U-159 | MarinAngemon | MarineAngemon |
| U-160 | Marsmon | Marsmon |
| U-161 | MedievalDukemon | MedievalGallantmon |
| U-162 | Medusamon | Medusamon |
| U-163 | Megidramon | Megidramon |
| U-164 | Megidramon (X Antibody) | Megidramon (X Antibody) |
| U-165 | Mercurymon | Mercurymon |
| U-166 | Mervamon | Mervamon |
| U-167 | MetalEtemon | MetalEtemon |
| U-168 | MetalGarurumon | MetalGarurumon |
| U-169 | MetalGarurumon (Black) | MetalGarurumon (Black) |
| U-170 | MetalGarurumon (X Antibody) | MetalGarurumon (X Antibody) |
| U-171 | Metallicdramon | Metallicdramon |
| U-172 | MetalPiranimon | MetalPiranimon |
| U-173 | MetalSeadramon | MetalSeadramon |
| U-174 | Millenniumon | Millenniummon |
| U-175 | Minervamon | Minervamon |
| U-176 | MirageGaogamon | MirageGaogamon |
| U-177 | MirageGaogamon (Burst Mode) | MirageGaogamon (Burst Mode) |
| U-178 | Mitamamon | Mitamamon |
| U-179 | MoonMillenniumon | MoonMillenniummon |
| U-180 | Mugendramon | Machinedramon |
| U-181 | Murmukusmon | Murmukusmon |
| U-182 | NeoVamdemon | NeoMyotismon |
| U-183 | Neptunemon | Neptunemon |
| U-184 | Nezhamon | Nezhamon |
| U-185 | Nidhoggmon | Nidhoggmon |
| U-186 | NoblePumpmon | NoblePumpkinmon |
| U-187 | Ofanimon | Ophanimon |
| U-188 | Ofanimon (X Antibody) | Ophanimon (X Antibody) |
| U-189 | Ofanimon (Falldown Mode) | Ophanimon (Falldown Mode) |
| U-190 | Ofanimon (Falldown Mode) (X Antibody) | Ophanimon (Falldown Mode) (X Antibody) |
| U-191 | Olegmon | Olegmon |
| U-192 | Omegamon Alter-B | Omnimon Alter-B |
| U-193 | Omegamon (Merciful Mode) | Omnimon (Merciful Mode) |
| U-194 | Omegamon Zwart | Omnimon Zwart |
| U-195 | Omegamon Zwart D | Omnimon Zwart Defeat |
| U-196 | Ornismon | Ornismon |
| U-197 | Ouryumon | Ouryumon |
| U-198 | Parasimon | Parasimon |
| U-199 | Pharaohmon | Pharaohmon |
| U-200 | Piemon | Piedmon |
| U-201 | PileVolcamon | PileVolcanomon |
| U-202 | Pinochimon | Puppetmon |
| U-203 | PlatinumNumemon | PlatinumNumemon |
| U-204 | Plesiomon | Plesiomon |
| U-205 | Plesiomon (X Antibody) | Plesiomon (X Antibody) |
| U-206 | Plutomon | Plutomon |
| U-207 | PrinceMamemon | PrinceMamemon |
| U-208 | PrinceMamemon (X Antibody) | PrinceMamemon (X Antibody) |
| U-209 | Proximamon | Proximamon |
| U-210 | Pukumon | Pukumon |
| U-211 | Qinglongmon | Azulongmon |
| U-212 | Quantumon | Quantumon |
| U-213 | Quartzmon | Quartzmon |
| U-214 | QueenBeemon | QueenBeemon |
| U-215 | QueenChessmon | QueenChessmon |
| U-216 | Rafflesimon | Rafflesimon |
| U-217 | Ragnamon | Galacticmon |
| U-218 | Raguelmon | Raguelmon |
| U-219 | Raidenmon | Raidenmon |
| U-220 | Raijinmon | Raijinmon |
| U-221 | Rapidmon (X Antibody) | Rapidmon (X Antibody) |
| U-222 | Rasenmon | Rasenmon |
| U-223 | Rasenmon (Fury Mode) | Rasenmon (Fury Mode) |
| U-224 | Rasielmon | Rasielmon |
| U-225 | Ravmon | Ravemon |
| U-226 | Ravmon (Burst Mode) | Ravemon (Burst Mode) |
| U-227 | Regalecusmon | Regalecusmon |
| U-228 | Rosemon | Rosemon |
| U-229 | Rosemon (X Antibody) | Rosemon (X Antibody) |
| U-230 | Rosemon (Burst Mode) | Rosemon (Burst Mode) |
| U-231 | Ryugumon | Ryugumon |
| U-232 | SaberLeomon | SaberLeomon |
| U-233 | SaintGalgomon | MegaGargomon |
| U-234 | Sakuyamon | Sakuyamon |
| U-235 | Sakuyamon (Miko Mode) | Sakuyamon (Maid Mode) |
| U-236 | Sakuyamon (X Antibody) | Sakuyamon (X Antibody) |
| U-237 | SeitenGokuwmon | SeitenGokuumon |
| U-238 | Seraphimon | Seraphimon |
| U-239 | Shagaramon | Shagaramon |
| U-240 | Shakamon | Shakamon |
| U-241 | ShineGreymon | ShineGreymon |
| U-242 | ShineGreymon (Ruin Mode) | ShineGreymon (Ruin Mode) |
| U-243 | ShineGreymon (Burst Mode) | ShineGreymon (Burst Mode) |
| U-244 | ShinMonzaemon | ShinMonzaemon |
| U-245 | Shivamon | Shivamon |
| U-246 | Shoutmon EX6 | Shoutmon EX6 |
| U-247 | Shoutmon DX | Shoutmon DX |
| U-248 | Shoutmon X7 | Shoutmon X7 |
| U-249 | Shoutmon X7 (Superior Mode) | Shoutmon X7 (Superior Mode) |
| U-250 | Shroudmon | Shroudmon |
| U-251 | Siriusmon | Siriusmon |
| U-252 | Skadimon | Skadimon |
| U-253 | SkullMammon | SkullMammothmon |
| U-254 | SkullMammon (X Antibody) | SkullMammothmon (X Antibody) |
| U-255 | SlashAngemon | SlashAngemon |
| U-256 | Slayerdramon | Slayerdramon |
| U-257 | Sleipmon | Kentaurosmon |
| U-258 | Spinomon | Spinomon |
| U-259 | Suijinmon | Suijinmon |
| U-260 | Surfimon | Surfimon |
| U-261 | Susanoomon | Susanomon |
| U-262 | Tactimon | Tactimon |
| U-263 | Takutoumon | Takutoumon |
| U-264 | Tengumon | Tengumon |
| U-265 | TigerVespamon | TigerVespamon |
| U-266 | Titamon | Titamon |
| U-267 | Tlalocmon | Tlalocmon |
| U-268 | TonosamaMamemon | TonosamaMamemon |
| U-269 | TyrantKabuterimon | TyrantKabuterimon |
| U-270 | UlforceV-dramon | UlforceVeedramon |
| U-271 | UltimateBrachiomon | UltimateBrachiomon |
| U-272 | UltimateChaosmon | UltimateChaosmon |
| U-273 | Valdurmon | Varodurumon |
| U-274 | Valkyrimon | Valkyrimon |
| U-275 | VenomVamdemon | VenomMyotismon |
| U-276 | Venusmon | Venusmon |
| U-277 | VictoryGreymon | VictoryGreymon |
| U-278 | Vikemon | Vikemon |
| U-279 | Volcanicdramon | Volcanicdramon |
| U-280 | Vulcanusmon | Vulcanusmon |
| U-281 | WarGreymon | WarGreymon |
| U-282 | WarGreymon (X Antibody) | WarGreymon (X Antibody) |
| U-283 | Xiangpengmon | Xiangpengmon |
| U-284 | Xuanwumon | Ebonwumon |
| U-285 | Zanbamon | Zanbamon |
| U-286 | ZDGarurumon | ZeedGarurumon |
| U-287 | ZeedMillenniumon | ZeedMillenniummon |
| U-288 | ZekeGreymon | ZeigGreymon |
| U-289 | Zephagamon | Zephagamon |
| U-290 | Zhuqiaomon | Zhuqiaomon |
| SU-001 | Agumon (Bond of Bravery) | Agumon (Bond of Bravery) |
| SU-002 | Alphamon (Ouryuken) | Alphamon (Ouryuken) |
| SU-003 | Armagemon | Armageddemon |
| SU-004 | Barbamon (X Antibody) | Barbamon (X Antibody) |
| SU-005 | Beelzebumon (X Antibody) | Beelzemon (X Antibody) |
| SU-006 | Beelzebumon (Blast Mode) | Beelzemon (Blast Mode) |
| SU-007 | Belphemon (X Antibody) | Belphemon (X Antibody) |
| SU-008 | Chaosdramon | Chaosdramon |
| SU-009 | Chaosmon | Chaosmon |
| SU-010 | Craniummon (X Antibody) | Craniamon (X Antibody) |
| SU-011 | DarknessBagramon | DarknessBagramon |
| SU-012 | Demon (X Antibody) | Creepymon (X Antibody) |
| SU-013 | Diablomon (X Antibody) | Diaboromon (X Antibody) |
| SU-014 | Duftmon (X Antibody) | Leopardmon (X Antibody) |
| SU-015 | Dukemon (X Antibody) | Gallantmon (X Antibody) |
| SU-016 | Dynasmon (X Antibody) | Dynasmon (X Antibody) |
| SU-017 | Examon | Examon |
| SU-018 | Examon (X Antibody) | Examon (X Antibody) |
| SU-019 | Gabumon (Bond of Friendship) | Gabumon (Bond of Friendship) |
| SU-020 | Gankoomon (X Antibody) | Gankoomon (X Antibody) |
| SU-021 | GraceNovamon | GraceNovamon |
| SU-022 | Imperialdramon (Fighter Mode) | Imperialdramon (Fighter Mode) |
| SU-023 | Imperialdramon (Paladin Mode) | Imperialdramon (Paladin Mode) |
| SU-024 | Jesmon (X Antibody) | Jesmon (X Antibody) |
| SU-025 | Jesmon GX | Jesmon GX |
| SU-026 | Leviamon (X Antibody) | Leviamon (X Antibody) |
| SU-027 | Lilithmon (X Antibody) | Lilithmon (X Antibody) |
| SU-028 | LordKnightmon (X Antibody) | LordKnightmon (X Antibody) |
| SU-029 | Lucemon (X Antibody) | Lucemon (X Antibody) |
| SU-030 | Magnamon (X Antibody) | Magnamon (X Antibody) |
| SU-031 | Mastemon | Mastemon |
| SU-032 | Minervamon (X Antibody) | Minervamon (X Antibody) |
| SU-033 | Ogudomon | Ogudomon |
| SU-034 | Ogudomon (X Antibody) | Ogudomon (X Antibody) |
| SU-035 | Omegamon | Omnimon |
| SU-036 | Omegamon Alter-S | Omnimon Alter-S |
| SU-037 | Omegamon (X Antibody) | Omnimon (X Antibody) |
| SU-038 | Ordinemon | Ordinemon |
| SU-039 | RagnaLordmon | RagnaLoardmon |
| SU-040 | RustTyranomon | RustTyrannomon |
| SU-041 | Sleipmon (X Antibody) | Kentaurosmon (X Antibody) |
| SU-042 | UlforceV-dramon (X Antibody) | UlforceVeedramon (X Antibody) |
| SU-043 | Voltobautamon | Boltboutamon |

Check out the [Digimon Data List](src/data/generated/digimon-records.generated.ts) for more information
about evolution lines.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

## Attributions

The bundled sprites were derived from the following sources and were later edited and
processed for this project:

- [sundeth/omnipet](https://github.com/sundeth/omnipet/tree/main)
- [Tortoiseshel's Full Color Digimon Dot Sprites post](https://withthewill.net/threads/full-color-digimon-dot-sprites.25843/) on the [With the Will forum](https://withthewill.net/members/tortoiseshel.4767/)
