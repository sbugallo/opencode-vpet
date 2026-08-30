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
    <a href="#license">License</a>
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

`@sbugallo/opencode-vpet` is an OpenCode v1 plugin that adds a Digimon virtual pet to your OpenCode TUI 
sidebar. Your Digimon evolves as you use OpenCode, and you can browse your discoveries and 
partner history.

The plugin support multiple concurrent sessions, so every token counts to evolve your partner.

There are more than 600 Digimon to discover, and the plugin is designed to be extensible so that new Digimon can be added in future releases.

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
- OpenCode `>=1.18.10`
- Node `>=20` to run `npx`
- Bun `>=1.3.5` only for local development


1. Register both plugins in your global OpenCode configuration:

   ```sh
   npx @sbugallo/opencode-vpet init
   ```

   You can also do it manually by editing `~/.config/opencode/opencode.json` and 
   `~/.config/opencode/tui.json` to add the following entry:

    ```json
    {
      "plugin": ["@sbugallo/opencode-vpet"]
    }
    ```

2. Restart OpenCode when the command finishes.

3. In OpenCode, run `/vpet-spawn` to hatch a partner.

After that, use `/vpet-dex` to browse discoveries and `/vpet-history` to browse current and retired generations.

---

## Commands

| Command | Description |
| --- | --- |
| `/vpet-spawn` | Spawns a new egg. |
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

The install CLI updates global OpenCode server and TUI configuration, understands OpenCode JSON and JSONC files, preserves unrelated configuration, and replaces an old unscoped `opencode-vpet` registration with `@sbugallo/opencode-vpet`.

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
| 0-001 | Digitama | Digiegg |
| 1-001 | Algomon | Argomon |
| 1-002 | Botamon | Botamon |
| 1-003 | Chicomon | Chibomon |
| 1-004 | Choromon | Choromon |
| 1-005 | Cocomon | Conomon |
| 1-006 | Cotsucomon | Cotsucomon |
| 1-007 | Dodomon | Dodomon |
| 1-008 | Fufumon | Fufumon |
| 1-009 | Kiimon | Keemon |
| 1-010 | Ketomon | Ketomon |
| 1-011 | Kuramon | Kuramon |
| 1-012 | Mokumon | Mokumon |
| 1-013 | Nyokimon | Nyokimon |
| 1-014 | Bubbmon | Pabumon |
| 1-015 | Petitmon | Petitmon |
| 1-016 | Pitchmon | Pichimon |
| 1-017 | Poyomon | Poyomon |
| 1-018 | Punimon | Punimon |
| 1-019 | Pururumon | Pururumon |
| 1-020 | Puttimon | Puttimon |
| 1-021 | Sakumon | Sakumon |
| 1-022 | Tsubumon | Tsubumon |
| 1-023 | Yukimibotamon | YukimiBotamon |
| 1-024 | Yuramon | Yuramon |
| 1-025 | Zerimon | Zerimon |
| 1-026 | Zurumon | Zurumon |
| 1-027 | Chibickmon | Chibickmon |
| 1-028 | Dokimon | Dokimon |
| 1-029 | Jyarimon | Jyarimon |
| 1-030 | Relemon | Relemon |
| 1-031 | Sunamon | Sandmon |
| 2-001 | Algomon | Argomon |
| 2-002 | Babydmon | Bebydomon |
| 2-003 | Budmon | Budmon |
| 2-004 | Pukamon | Bukamon |
| 2-005 | PetiMeramon | DemiMeramon |
| 2-006 | Chibimon | DemiVeemon |
| 2-007 | Dorimon | Dorimon |
| 2-008 | Gummymon | Gummymon |
| 2-009 | Hopmon | Hopmon |
| 2-010 | Kakkinmon | Kakkinmon |
| 2-011 | Capromon | Kapurimon |
| 2-012 | Chocomon | Kokomon |
| 2-013 | Koromon | Koromon |
| 2-014 | Kyokyomon | Kyokyomon |
| 2-015 | Mochimon | Motimon |
| 2-016 | Nyaromon | Nyaromon |
| 2-017 | Pagumon | Pagumon |
| 2-018 | Poromon | Poromon |
| 2-019 | Sakuttomon | Sakuttomon |
| 2-020 | Tanemon | Tanemon |
| 2-021 | Tokomon | Tokomon |
| 2-022 | Tokomon X | Tokomon X |
| 2-023 | Tsumemon | Tsumemon |
| 2-024 | Tunomon | Tsunomon |
| 2-025 | Upamon | Upamon |
| 2-026 | Wanyamon | Wanyamon |
| 2-027 | Yarmon | Yaamon |
| 2-028 | Pyocomon | Yokomon |
| 2-029 | Bibimon | Bibimon |
| 2-030 | Gigimon | Gigimon |
| 2-031 | Goromon | Tumblemon |
| 2-032 | Hiyarimon | Hiyarimon |
| 2-033 | Minomon | Minomon |
| 2-034 | Moonmon | Moonmon |
| 2-035 | Pickmon | Pickmon |
| 2-036 | Pokomon | Viximon |
| 2-037 | Sunmon | Sunmon |
| 3-001 | Agumon | Agumon |
| 3-002 | Agumon (Black) X | Agumon (Black) X |
| 3-003 | Agumon Hakase | Agumon Expert |
| 3-004 | Agumon X | Agumon X |
| 3-005 | Algomon | Argomon |
| 3-006 | Armadimon | Armadillomon |
| 3-007 | Betamon | Betamon |
| 3-008 | Piyomon | Biyomon |
| 3-009 | Blucomon | Bulucomon |
| 3-010 | BushiAgumon | BushiAgumon |
| 3-011 | Candmon | Candlemon |
| 3-012 | Coronamon | Coronamon |
| 3-013 | Ganimon | Crabmon |
| 3-014 | PicoDevimon | DemiDevimon |
| 3-015 | DORUmon | Dorumon |
| 3-016 | Dracomon | Dracomon |
| 3-017 | Dracomon X | Dracomon X |
| 3-018 | Duskmon | Duskmon |
| 3-019 | Elecmon | Elecmon |
| 3-020 | Falcomon | Falcomon |
| 3-021 | Floramon | Floramon |
| 3-022 | Gabumon | Gabumon |
| 3-023 | Gabumon X | Gabumon X |
| 3-024 | Gaomon | Gaomon |
| 3-025 | Tailmon | Gatomon |
| 3-026 | Gazimon | Gazimon |
| 3-027 | Ghostmon | Ghostmon |
| 3-028 | Gizamon | Gizamon |
| 3-029 | Gomamon | Gomamon |
| 3-030 | Gomamon X | Gomamon X |
| 3-031 | Gottsumon | Gotsumon |
| 3-032 | Guilmon | Guilmon |
| 3-033 | Hagurumon | Hagurumon |
| 3-034 | Hawkmon | Hawkmon |
| 3-035 | Herissmon | Herissmon |
| 3-036 | Hackmon | Huckmon |
| 3-037 | Impmon | Impmon |
| 3-038 | Impmon X | Impmon X |
| 3-039 | Jazamon | Jazamon |
| 3-040 | Junkmon | Junkmon |
| 3-041 | Keramon X | Keramon X |
| 3-042 | Kokuwamon | Kokuwamon |
| 3-043 | Kokuwamon X | Kokuwamon X |
| 3-044 | Kunemon | Kunemon |
| 3-045 | Labramon | Labramon |
| 3-046 | Lalamon | Lalamon |
| 3-047 | Lopmon | Lopmon |
| 3-048 | Lopmon X | Lopmon X |
| 3-049 | Ludomon | Ludomon |
| 3-050 | Lunamon | Lunamon |
| 3-051 | Monodramon | Monodramon |
| 3-052 | Morphomon | Morphomon |
| 3-053 | Mushmon | Mushroomon |
| 3-054 | Otamamon | Otamamon |
| 3-055 | Otamamon X | Otamamon X |
| 3-056 | Palmon | Palmon |
| 3-057 | Palmon X | Palmon X |
| 3-058 | Patamon | Patamon |
| 3-059 | Phascomon | Phascomon |
| 3-060 | Pomumon | Pomumon |
| 3-061 | Renamon X | Renamon X |
| 3-062 | Ryudamon | Ryudamon |
| 3-063 | Plotmon | Salamon |
| 3-064 | Plotmon X | Salamon X |
| 3-065 | Sangomon | Sangomon |
| 3-066 | Shoutmon | Shoutmon |
| 3-067 | Sistermon Blanc | Sistermon Blanc |
| 3-068 | Sunarizamon | Sunarizamon |
| 3-069 | Swimmon | Swimmon |
| 3-070 | Shakomon | Syakomon |
| 3-071 | Shakomon X | Syakomon X |
| 3-072 | Bakumon | Tapirmon |
| 3-073 | Tentomon | Tentomon |
| 3-074 | Terriermon | Terriermon |
| 3-075 | Terriermon X | Terriermon X |
| 3-076 | Tinkermon | Tinkermon |
| 3-077 | ToyAgumon | ToyAgumon |
| 3-078 | V-mon | Veemon |
| 3-079 | Vorvomon | Vorvomon |
| 3-080 | Wormmon | Wormmon |
| 3-081 | Zubamon | Zubamon |
| 3-082 | Agumon (Black) | Agumon (Black) |
| 3-083 | Dracumon | Dracmon |
| 3-084 | Pulsemon | Pulsemon |
| 3-085 | Renamon | Renamon |
| 4-001 | Agnimon | Agunimon |
| 4-002 | Airdramon | Airdramon |
| 4-003 | Allomon X | Allomon X |
| 4-004 | Angemon | Angemon |
| 4-005 | Ankylomon | Ankylomon |
| 4-006 | Hanumon | Apemon |
| 4-007 | Aquilamon | Aquilamon |
| 4-008 | Algomon | Argomon |
| 4-009 | Arresterdramon | Arresterdramon |
| 4-010 | Baboongamon | Baboongamon |
| 4-011 | Bakemon | Bakemon |
| 4-012 | Baluchimon | Baluchimon |
| 4-013 | BaoHuckmon | BaoHuckmon |
| 4-014 | Birdramon | Birdramon |
| 4-015 | Centalmon | Centarumon |
| 4-016 | Clockmon | Clockmon |
| 4-017 | Coelamon | Coelamon |
| 4-018 | Coredramon (Blue) | Coredramon (Blue) |
| 4-019 | Coredramon (Green) | Coredramon (Green) |
| 4-020 | Cyclomon | Cyclonemon |
| 4-021 | Damemon | Damemon |
| 4-022 | Darcmon | Darcmon |
| 4-023 | DarkTyranomon | DarkTyrannomon |
| 4-024 | DarkTyranomon X | DarkTyrannomon X |
| 4-025 | Deltamon | Deltamon |
| 4-026 | Revolmon | Deputymon |
| 4-027 | Devidramon | Devidramon |
| 4-028 | Devimon | Devimon |
| 4-029 | Diatrymon | Diatrymon |
| 4-030 | Dobermon | Dobermon |
| 4-031 | Dokugumon | Dokugumon |
| 4-032 | Rukamon | Dolphmon |
| 4-033 | DORUgamon | Dorugamon |
| 4-034 | Drimogemon | Drimogemon |
| 4-035 | Duskmon | Duskmon |
| 4-036 | Ebidramon | Ebidramon |
| 4-037 | Eosmon | Eosmon |
| 4-038 | XV-mon | ExVeemon |
| 4-039 | Filmon | Filmon |
| 4-040 | Firamon | Firamon |
| 4-041 | FlareLizamon | Flarerizamon |
| 4-042 | Flymon | Flymon |
| 4-043 | Yukidarumon | Frigimon |
| 4-044 | Gaogamon | Gaogamon |
| 4-045 | Galgomon | Gargomon |
| 4-046 | Garurumon | Garurumon |
| 4-047 | Tailmon | Gatomon |
| 4-048 | Tailmon X | Gatomon X |
| 4-049 | Gekomon | Gekomon |
| 4-050 | GeoGreymon | GeoGreymon |
| 4-051 | Gesomon | Gesomon |
| 4-052 | Ginryumon | Ginryumon |
| 4-053 | Golemon | Golemon |
| 4-054 | Greymon | Greymon |
| 4-055 | Growmon | Growlmon |
| 4-056 | Growmon X | Growlmon X |
| 4-057 | Guardromon | Guardromon |
| 4-058 | Hookmon | Hookmon |
| 4-059 | Hudiemon | Hudiemon |
| 4-060 | Ikkakumon | Ikkakumon |
| 4-061 | Jazardmon | Jazardmon |
| 4-062 | Kabuterimon | Kabuterimon |
| 4-063 | Kiwimon | Kiwimon |
| 4-064 | Cockatrimon | Kokatorimon |
| 4-065 | Komondomon | Komondomon |
| 4-066 | Kuwagamon | Kuwagamon |
| 4-067 | Kuwagamon X | Kuwagamon X |
| 4-068 | Lavorvomon | Lavorvomon |
| 4-069 | Lekismon | Lekismon |
| 4-070 | Leomon | Leomon |
| 4-071 | Leomon X | Leomon X |
| 4-072 | Wolfmon | Lobomon |
| 4-073 | Machmon | Machmon |
| 4-074 | MadLeomon | MadLeomon |
| 4-075 | Manbomon | Manbomon |
| 4-076 | Mantaraymon X | Mantaraymon X |
| 4-077 | Meicoomon | Meicoomon |
| 4-078 | Mechanorimon | Mekanorimon |
| 4-079 | Meramon | Meramon |
| 4-080 | Meramon X | Meramon X |
| 4-081 | Mimicmon | Mimicmon |
| 4-082 | Minotaurmon | Minotarumon |
| 4-083 | Mojyamon | Mojyamon |
| 4-084 | Monochromon | Monochromon |
| 4-085 | Nanimon | Nanimon |
| 4-086 | Nefertimon X | Nefertimon X |
| 4-087 | Igamon | Ninjamon |
| 4-088 | Numemon | Numemon |
| 4-089 | Numemon X | Numemon X |
| 4-090 | Octmon | Octomon |
| 4-091 | Orgemon | Ogremon |
| 4-092 | Orgemon X | Ogremon X |
| 4-093 | Omekamon | Omekamon |
| 4-094 | Paledramon | Paledramon |
| 4-095 | Parasaurmon | Parasaurmon |
| 4-096 | Peckmon | Peckmon |
| 4-097 | Pegasmon X | Pegasusmon X |
| 4-098 | Petermon | Petermon |
| 4-099 | Porcupamon | Porcupamon |
| 4-100 | Pteranomon X | Pteramon X |
| 4-101 | Raremon | Raremon |
| 4-102 | RedVegimon | RedVegiemon |
| 4-103 | Reppamon | Reppamon |
| 4-104 | Rhinomon X | Rhinomon X |
| 4-105 | Gokimon | Roachmon |
| 4-106 | Sangloupmon | Sangloupmon |
| 4-107 | Seadramon | Seadramon |
| 4-108 | Seadramon X | Seadramon X |
| 4-109 | Siesamon X | Seasarmon X |
| 4-110 | Shadramon | Shadramon |
| 4-111 | Shellmon | Shellmon |
| 4-112 | KaratukiNumemon | ShellNumemon |
| 4-113 | Shoutmon X3 | Shoutmon X3 |
| 4-114 | Sistermon Ciel | Sistermon Ciel |
| 4-115 | Starmon | Starmon |
| 4-116 | Stingmon | Stingmon |
| 4-117 | Strikedramon | Strikedramon |
| 4-118 | Submarimon | Submarimon |
| 4-119 | Scumon | Sukamon |
| 4-120 | Sunflowmon | Sunflowmon |
| 4-121 | Tankmon | Tankmon |
| 4-122 | Targetmon | Targetmon |
| 4-123 | Thunderballmon | Thundermon |
| 4-124 | TiaLudomon | TiaLudomon |
| 4-125 | Tobiumon | Tobiumon |
| 4-126 | Tobucatmon | TobuCatmon |
| 4-127 | Togemon | Togemon |
| 4-128 | Togemon X | Togemon X |
| 4-129 | Tortamon | Tortomon |
| 4-130 | Troopmon | Troopmon |
| 4-131 | Turuiemon | Turuiemon |
| 4-132 | Tuskmon | Tuskmon |
| 4-133 | Tylomon | Tylomon |
| 4-134 | Tylomon X | Tylomon X |
| 4-135 | Tyranomon | Tyrannomon |
| 4-136 | Tyranomon X | Tyrannomon X |
| 4-137 | Unimon | Unimon |
| 4-138 | V-dramon | Veedramon |
| 4-139 | Vegimon | Vegiemon |
| 4-140 | Velgrmon | Velgrmon |
| 4-141 | Whamon | Whamon |
| 4-142 | Witchmon | Witchmon |
| 4-143 | Wizarmon | Wizardmon |
| 4-144 | Wizarmon X | Wizardmon X |
| 4-145 | Woodmon | Woodmon |
| 4-146 | Zubaeagermon | ZubaEagermon |
| 4-147 | Bulkmon | Bulkmon |
| 4-148 | Fugamon | Fugamon |
| 4-149 | Hyougamon | Hyogamon |
| 4-150 | Pidmon | Piddomon |
| 4-151 | Rhinomon | Rhinomon |
| 4-152 | Saberdramon | Saberdramon |
| 5-001 | AeroV-dramon | AeroVeedramon |
| 5-002 | Aldamon | Aldamon |
| 5-003 | Andromon | Andromon |
| 5-004 | Angewomon | Angewomon |
| 5-005 | Angewomon X | Angewomon X |
| 5-006 | Andiramon | Antylamon |
| 5-007 | Algomon | Argomon |
| 5-008 | Archnemon | Arukenimon |
| 5-009 | Astamon | Astamon |
| 5-010 | Asuramon | Asuramon |
| 5-011 | Baalmon | Baalmon |
| 5-012 | Beowolfmon | Beowolfmon |
| 5-013 | BigMamemon | BigMamemon |
| 5-014 | Blossomon | Blossomon |
| 5-015 | Valvemon | Bulbmon |
| 5-016 | Vritramon | BurningGreymon |
| 5-017 | CannonBeemon | CannonBeemon |
| 5-018 | Cerberumon | Cerberusmon |
| 5-019 | Cerberumon X | Cerberusmon X |
| 5-020 | Jyureimon | Cherrymon |
| 5-021 | Cho-Hakkaimon | Cho-Hakkaimon |
| 5-022 | Crescemon | Crescemon |
| 5-023 | Yatagaramon | Crowmon |
| 5-024 | CrysPaledramon | CrysPaledramon |
| 5-025 | Cyberdramon | Cyberdramon |
| 5-026 | Cyberdramon X | Cyberdramon X |
| 5-027 | DarkKnightmon | DarkKnightmon |
| 5-028 | Nanomon | Datamon |
| 5-029 | Delumon | Deramon |
| 5-030 | Digitamamon | Digitamamon |
| 5-031 | Dinobeemon | Dinobeemon |
| 5-032 | Hangyomon | Divermon |
| 5-033 | NeoDevimon | DoneDevimon |
| 5-034 | DORUguremon | DoruGreymon |
| 5-035 | Dagomon | Dragomon |
| 5-036 | Duramon | Duramon |
| 5-037 | Entmon | Entmon |
| 5-038 | Eosmon | Eosmon |
| 5-039 | Etemon | Etemon |
| 5-040 | Ex-Tyranomon | ExTyrannomon |
| 5-041 | Flaremon | Flaremon |
| 5-042 | Gerbemon | Garbagemon |
| 5-043 | Garudamon | Garudamon |
| 5-044 | Garudamon X | Garudamon X |
| 5-045 | Giromon | Giromon |
| 5-046 | Gogmamon | Gogmamon |
| 5-047 | Grademon | Grademon |
| 5-048 | Groundramon | Groundramon |
| 5-049 | Gusokumon | Gusokumon |
| 5-050 | Hippogriffomon | HippoGryphonmon |
| 5-051 | Hisyaryumon | Hisyaryumon |
| 5-052 | Jyagamon | Jagamon |
| 5-053 | KaiserLeomon | JagerLoweemon |
| 5-054 | Jazarichmon | Jazarichmon |
| 5-055 | Jewelbeemon | JewelBeemon |
| 5-056 | Garummon | KendoGarurumon |
| 5-057 | Chimairamon | Kimeramon |
| 5-058 | Knightmon | Knightmon |
| 5-059 | LadyDevimon | LadyDevimon |
| 5-060 | LadyDevimon X | LadyDevimon X |
| 5-061 | Lavogaritamon | Lavogaritamon |
| 5-062 | Lilamon | Lilamon |
| 5-063 | Lilimon | Lillymon |
| 5-064 | Lilimon X | Lillymon X |
| 5-065 | LoaderLeomon | LoaderLeomon |
| 5-066 | Locomon | Locomon |
| 5-067 | Lucemon: Falldown Mode | Lucemon: Chaos Mode |
| 5-068 | MachGaogamon | MachGaogamon |
| 5-069 | HolyAngemon | MagnaAngemon |
| 5-070 | Mamemon | Mamemon |
| 5-071 | Mamemon X | Mamemon X |
| 5-072 | Mametyramon | Mametyramon |
| 5-073 | Mammon | Mammothmon |
| 5-074 | Mammon X | Mammothmon X |
| 5-075 | Manticoremon | Manticoremon |
| 5-076 | MarinChimairamon | MarineChimairamon |
| 5-077 | MarinDevimon | MarineDevimon |
| 5-078 | Meicrackmon | Maycrackmon |
| 5-079 | Meicrackmon: Vicious Mode | Maycrackmon: Vicious Mode |
| 5-080 | Megadramon | Megadramon |
| 5-081 | AtlurKabuterimon | MegaKabuterimon (Red) |
| 5-082 | MegaSeadramon | MegaSeadramon |
| 5-083 | MegaSeadramon X | MegaSeadramon X |
| 5-084 | Mephismon X | Mephistomon X |
| 5-085 | Mermaimon | Mermaimon |
| 5-086 | MetalGreymon | MetalGreymon |
| 5-087 | MetalGreymon (Vaccine) | MetalGreymon (Vaccine) |
| 5-088 | MetalGreymon (Virus) | MetalGreymon (Virus) |
| 5-089 | MetalGreymon (Virus) X | MetalGreymon (Virus) X |
| 5-090 | MetalGreymon X | MetalGreymon X |
| 5-091 | MetalMamemon | MetalMamemon |
| 5-092 | MetalFantomon | MetalPhantomon |
| 5-093 | MetalTyranomon | MetalTyrannomon |
| 5-094 | MetalTyranomon X | MetalTyrannomon X |
| 5-095 | Monzaemon | Monzaemon |
| 5-096 | Monzaemon X | Monzaemon X |
| 5-097 | Mummymon | Mummymon |
| 5-098 | Vamdemon | Myotismon |
| 5-099 | Vamdemon X | Myotismon X |
| 5-100 | NeoDevimon | NeoDevimon |
| 5-101 | Okuwamon | Okuwamon |
| 5-102 | Okuwamon X | Okuwamon X |
| 5-103 | OmegaShoutmon X | OmniShoutmon X |
| 5-104 | Orochimon | Orochimon |
| 5-105 | Paildramon | Paildramon |
| 5-106 | Parrotmon | Parrotmon |
| 5-107 | Fantomon | Phantomon |
| 5-108 | Piranimon | Piranimon |
| 5-109 | Piccolomon | Piximon |
| 5-110 | Pumpmon | Pumpkinmon |
| 5-111 | RaijiLudomon | RaijiLudomon |
| 5-112 | Rapidmon | Rapidmon |
| 5-113 | Rebellimon | Rebellimon |
| 5-114 | Raihimon | Rhihimon |
| 5-115 | RizeGreymon | RizeGreymon |
| 5-116 | RizeGreymon X | RizeGreymon X |
| 5-117 | SaviorHackmon | SaviorHuckmon |
| 5-118 | Anomalocarimon | Scorpiomon |
| 5-119 | Anomalocarimon X | Scorpiomon X |
| 5-120 | Shakkoumon | Shakkoumon |
| 5-121 | TonosamaGekomon | ShogunGekomon |
| 5-122 | Shoutmon X5 | Shoutmon X5 |
| 5-123 | Silphymon | Silphymon |
| 5-124 | Sirenmon | Sirenmon |
| 5-125 | SkullBaluchimon | SkullBaluchimon |
| 5-126 | SkullGreymon | SkullGreymon |
| 5-127 | DeathMeramon | SkullMeramon |
| 5-128 | Stiffilmon | Stefilmon |
| 5-129 | Tekkamon | Tekkamon |
| 5-130 | Toropiamon | Toropiamon |
| 5-131 | Triceramon | Triceramon |
| 5-132 | Triceramon X | Triceramon X |
| 5-133 | Vademon | Vademon |
| 5-134 | Velgrmon | Velgrmon |
| 5-135 | MegaloGrowmon | WarGrowlmon |
| 5-136 | MegaloGrowmon X | WarGrowlmon X |
| 5-137 | WaruMonzaemon | WaruMonzaemon |
| 5-138 | WaruSeadramon | WaruSeadramon |
| 5-139 | WereGarurumon | WereGarurumon |
| 5-140 | WereGarurumon X | WereGarurumon X |
| 5-141 | Whamon | Whamon |
| 5-142 | Wingdramon | Wingdramon |
| 5-143 | Zudomon | Zudomon |
| 5-144 | Boutmon | Boutmon |
| 5-145 | DarkSuperStarmon | DarkSuperStarmon |
| 5-146 | DORUguremon | Doruguremon |
| 5-147 | Pandamon | Pandamon |
| 5-148 | Scorpiomon | SkullScorpiomon |
| 5-149 | SuperStarmon | SuperStarmon |
| 6-001 | Aegisdramon | Aegisdramon |
| 6-002 | Alphamon | Alphamon |
| 6-003 | AncientBeatmon | AncientBeetlemon |
| 6-004 | AncientGarurumon | AncientGarurumon |
| 6-005 | AncientGreymon | AncientGreymon |
| 6-006 | AncientIrismon | AncientKazemon |
| 6-007 | AncientMegatheriumon | AncientMegatheriummon |
| 6-008 | AncientMermaimon | AncientMermaimon |
| 6-009 | AncientSphinxmon | AncientSphinxmon |
| 6-010 | AncientTroiamon | AncientTroymon |
| 6-011 | AncientVolcamon | AncientVolcanomon |
| 6-012 | AncientWisemon | AncientWisemon |
| 6-013 | Anubimon | Anubismon |
| 6-014 | Apoclymon | Apocalymon |
| 6-015 | Apollomon | Apollomon |
| 6-016 | Algomon | Argomon |
| 6-017 | Armagemon | Armageddemon |
| 6-018 | Qinglongmon | Azulongmon |
| 6-019 | Bagramon | Bagramon |
| 6-020 | Baihumon | Baihumon |
| 6-021 | BanchoLeomon | BanchoLeomon |
| 6-022 | BanchoMamemon | BanchoMamemon |
| 6-023 | Barbamon | Barbamon |
| 6-024 | BeelStarmon X | BeelStarmon X |
| 6-025 | Beelzebumon | Beelzemon |
| 6-026 | Belphemon: Rage Mode | Belphemon: Rage Mode |
| 6-027 | BlackWarGreymon X | BlackWarGreymon X |
| 6-028 | BlitzGreymon | BlitzGreymon |
| 6-029 | Boltmon | Boltmon |
| 6-030 | Breakdramon | Breakdramon |
| 6-031 | BryweLudramon | BryweLudramon |
| 6-032 | Chaosdramon X | Chaosdramon X |
| 6-033 | Cherubimon (Virtue) | Cherubimon (Virtue) |
| 6-034 | Cherubimon (Virtue) X | Cherubimon (Virtue) X |
| 6-035 | Cherubimon (Vice) X | Cherubimon (Vice) X |
| 6-036 | Craniummon | Craniamon |
| 6-037 | Demon | Creepymon |
| 6-038 | CresGarurumon | CresGarurumon |
| 6-039 | Darkdramon | Darkdramon |
| 6-040 | DarkKnightmon X | DarkKnightmon X |
| 6-041 | Dianamon | Dianamon |
| 6-042 | Dinorexmon | Dinorexmon |
| 6-043 | Dinotigermon | Dinotigermon |
| 6-044 | Durandamon | Durandamon |
| 6-045 | Dynasmon | Dynasmon |
| 6-046 | Ebemon X | Ebemon X |
| 6-047 | Xuanwumon | Ebonwumon |
| 6-048 | KaiserGreymon | EmperorGreymon |
| 6-049 | Eosmon | Eosmon |
| 6-050 | Huanglongmon | Fanglongmon |
| 6-051 | Gaioumon | Gaiomon |
| 6-052 | Dukemon | Gallantmon |
| 6-053 | Dukemon X | Gallantmon X |
| 6-054 | Gankoomon | Gankoomon |
| 6-055 | Deathmon | Ghoulmon |
| 6-056 | GigaSeadramon | GigaSeadramon |
| 6-057 | Goddramon | Goldramon |
| 6-058 | Goddramon X | Goldramon X |
| 6-059 | GrandisKuwagamon | GrandisKuwagamon |
| 6-060 | GrandDracumon | GranDracmon |
| 6-061 | GranKuwagamon | GranKuwagamon |
| 6-062 | GrandLocomon | GroundLocomon |
| 6-063 | Griffomon | Gryphonmon |
| 6-064 | Gundramon | Gundramon |
| 6-065 | HeavyLeomon | HeavyLeomon |
| 6-066 | HerakleKabuterimon | HerculesKabuterimon |
| 6-067 | Hexeblaumon | Hexeblaumon |
| 6-068 | HiAndromon | HiAndromon |
| 6-069 | Jesmon | Jesmon |
| 6-070 | Justimon X | Justimon X |
| 6-071 | Justimon: Blitz Arm | Justimon: Blitz Arm |
| 6-072 | Sleipmon | Kentaurosmon |
| 6-073 | KingEtemon | KingEtemon |
| 6-074 | Duftmon | Leopardmon |
| 6-075 | Leviamon | Leviamon |
| 6-076 | Lilithmon | Lilithmon |
| 6-077 | LordKnightmon | LordKnightmon |
| 6-078 | Lotusmon | Lotosmon |
| 6-079 | Lucemon: Satan Mode | Lucemon: Satan Mode |
| 6-080 | Mugendramon | Machinedramon |
| 6-081 | Holydramon | Magnadramon |
| 6-082 | Holydramon X | Magnadramon X |
| 6-083 | MagnaGarurumon | MagnaGarurumon |
| 6-084 | Magnamon | Magnamon |
| 6-085 | BelialVamdemon | MaloMyotismon |
| 6-086 | MarinAngemon | MarineAngemon |
| 6-087 | SaintGalgomon | MegaGargomon |
| 6-088 | Megidramon | Megidramon |
| 6-089 | Megidramon X | Megidramon X |
| 6-090 | MetalEtemon | MetalEtemon |
| 6-091 | MetalGarurumon | MetalGarurumon |
| 6-092 | MetalGarurumon X | MetalGarurumon X |
| 6-093 | Metallicdramon | Metallicdramon |
| 6-094 | MetalPiranimon | MetalPiranimon |
| 6-095 | MetalSeadramon | MetalSeadramon |
| 6-096 | MirageGaogamon | MirageGaogamon |
| 6-097 | Murmukusmon | Murmukusmon |
| 6-098 | Nidhoggmon | Nidhoggmon |
| 6-099 | NoblePumpmon | NoblePumpkinmon |
| 6-100 | Ofanimon | Ophanimon |
| 6-101 | Ofanimon X | Ophanimon X |
| 6-102 | Ofanimon: Falldown Mode X | Ophanimon: Falldown Mode X |
| 6-103 | Ornismon | Ornismon |
| 6-104 | Ouryumon | Ouryumon |
| 6-105 | Hououmon | Phoenixmon |
| 6-106 | Hououmon X | Phoenixmon X |
| 6-107 | Piemon | Piedmon |
| 6-108 | PlatinumNumemon | PlatinumNumemon |
| 6-109 | Plesiomon | Plesiomon |
| 6-110 | Plesiomon X | Plesiomon X |
| 6-111 | PrinceMamemon X | PrinceMamemon X |
| 6-112 | Pukumon | Pukumon |
| 6-113 | Pinochimon | Puppetmon |
| 6-114 | Rafflesimon | Rafflesimon |
| 6-115 | Raguelmon | Raguelmon |
| 6-116 | Rapidmon X | Rapidmon X |
| 6-117 | Rasenmon | Rasenmon |
| 6-118 | Rasenmon: Fury Mode | Rasenmon: Fury Mode |
| 6-119 | Rasielmon | Rasielmon |
| 6-120 | Ravmon | Ravemon |
| 6-121 | Regalecusmon | Regalecusmon |
| 6-122 | Raihimon | Rhihimon |
| 6-123 | Rosemon | Rosemon |
| 6-124 | Rosemon X | Rosemon X |
| 6-125 | RustTyranomon | RustTyrannomon |
| 6-126 | SaberLeomon | SaberLeomon |
| 6-127 | Sakuyamon X | Sakuyamon X |
| 6-128 | Seraphimon | Seraphimon |
| 6-129 | ShineGreymon | ShineGreymon |
| 6-130 | SkullMammon | SkullMammothmon |
| 6-131 | SkullMammon X | SkullMammothmon X |
| 6-132 | SlashAngemon | SlashAngemon |
| 6-133 | Slayerdramon | Slayerdramon |
| 6-134 | Susanoomon | Susanomon |
| 6-135 | TigerVespamon | TigerVespamon |
| 6-136 | Titamon | Titamon |
| 6-137 | UlforceV-dramon | UlforceVeedramon |
| 6-138 | UltimateBrachiomon | UltimateBrachiomon |
| 6-139 | Valkyrimon | Valkyrimon |
| 6-140 | Valdurmon | Varodurumon |
| 6-141 | VenomVamdemon | VenomMyotismon |
| 6-142 | Volcanicdramon | Volcanicdramon |
| 6-143 | WarGreymon | WarGreymon |
| 6-144 | WarGreymon X | WarGreymon X |
| 6-145 | Zhuqiaomon | Zhuqiaomon |
| 6-146 | Vikemon | Vikemon |
| 6-147 | ShinMonzaemon | ShinMonzaemon |
| 6-148 | Kazuchimon | Kazuchimon |
| 6-149 | BanchoLilimon | BanchoLillymon |
| 6-150 | DORUgoramon | Dorugoramon |
| 7-001 | Alphamon: Ouryuken | Alphamon: Ouryuken |
| 7-002 | Armagemon | Armageddemon |
| 7-003 | Barbamon X | Barbamon X |
| 7-004 | Beelzebumon X | Beelzemon X |
| 7-005 | Beelzebumon: Blast Mode | Beelzemon: Blast Mode |
| 7-006 | Belphemon X | Belphemon X |
| 7-007 | Voltobautamon | Boltboutamon |
| 7-008 | Chaosmon | Chaosmon |
| 7-009 | Craniummon X | Craniamon X |
| 7-010 | Demon X | Creepymon X |
| 7-011 | DarknessBagramon | DarknessBagramon |
| 7-012 | Diablomon X | Diaboromon X |
| 7-013 | Dynasmon X | Dynasmon X |
| 7-014 | Examon | Examon |
| 7-015 | Examon X | Examon X |
| 7-016 | Dukemon X | Gallantmon X |
| 7-017 | Gankoomon X | Gankoomon X |
| 7-018 | GraceNovamon | GraceNovamon |
| 7-019 | Imperialdramon: Fighter Mode | Imperialdramon: Fighter Mode |
| 7-020 | Imperialdramon: Paladin Mode | Imperialdramon: Paladin Mode |
| 7-021 | Jesmon X | Jesmon X |
| 7-022 | Sleipmon X | Kentaurosmon X |
| 7-023 | Duftmon X | Leopardmon X |
| 7-024 | Leviamon X | Leviamon X |
| 7-025 | Lilithmon X | Lilithmon X |
| 7-026 | LordKnightmon X | LordKnightmon X |
| 7-027 | Lucemon X | Lucemon X |
| 7-028 | Magnamon X | Magnamon X |
| 7-029 | Mastemon | Mastemon |
| 7-030 | Minervamon X | Minervamon X |
| 7-031 | Ogudomon | Ogudomon |
| 7-032 | Omegamon | Omnimon |
| 7-033 | Omegamon Alter-S | Omnimon Alter-S |
| 7-034 | Omegamon X | Omnimon X |
| 7-035 | Ordinemon | Ordinemon |
| 7-036 | Rafflesimon | Rafflesimon |
| 7-037 | RagnaLordmon | RagnaLoardmon |
| 7-038 | Rasenmon | Rasenmon |
| 7-039 | RustTyranomon | RustTyrannomon |
| 7-040 | UlforceV-dramon X | UlforceVeedramon X |
| 7-041 | Agumon (Bond of Bravery) | Agumon (Bond of Bravery) |
| 7-042 | Gabumon (Bond of Friendship) | Gabumon (Bond of Friendship) |
| 7-043 | Jesmon GX | Jesmon GX |
| 7-044 | Ogudomon X | Ogudomon X |
| 7-045 | Chaosdramon | Chaosdramon |

Check out the [Digimon Data List](src/data/digimon-data.ts) for more information about evolution
lines.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
