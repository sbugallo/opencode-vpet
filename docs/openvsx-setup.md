# Guía: cuenta en Open VSX y secret `OVSX_PAT`

Esta guía es para el **propietario del repositorio** (`sbugallo`), que debe tener permisos de administrador en GitHub para añadir secrets.

El workflow de CD publica automáticamente la extensión **Cursor VPet** en Open VSX cuando existe el secret `OVSX_PAT`. Sin ese secret, el release sigue funcionando (GitHub Release, npm, etc.), pero **no** se publica en Open VSX.

## Resumen de lo que necesitas

| Elemento | Valor en este repo |
|---|---|
| Publisher / namespace | `sbugallo` (definido en `packages/cursor-vpet/package.json`) |
| Secret en GitHub | `OVSX_PAT` |
| URL final de la extensión | https://open-vsx.org/extension/sbugallo/cursor-vpet |

## Paso 1: Crear cuenta en Eclipse Foundation

Open VSX exige una cuenta de Eclipse Foundation (no basta con GitHub).

1. Ve a https://accounts.eclipse.org/user/register
2. Completa el registro.
3. **Importante:** en el perfil de Eclipse, indica tu **GitHub username** (`sbugallo`) y usa **el mismo GitHub** con el que iniciarás sesión en Open VSX.

## Paso 2: Iniciar sesión en Open VSX con GitHub

1. Abre https://open-vsx.org
2. Inicia sesión con tu cuenta de **GitHub** (`sbugallo`).

## Paso 3: Vincular la cuenta de Eclipse

1. Ve a tu perfil: https://open-vsx.org/user-settings/profile
2. Haz clic en **“Log in with Eclipse”** (o similar).
3. Autoriza la vinculación entre Eclipse y Open VSX.

Si no ves la opción o falla el enlace, revisa que el GitHub username en Eclipse coincida exactamente con el de Open VSX.

## Paso 4: Firmar el Publisher Agreement

Sin esto **no podrás publicar** (verás errores del tipo *“You must log in with an Eclipse Foundation account and sign a Publisher Agreement”*).

1. En https://open-vsx.org/user-settings/profile
2. Haz clic en **“Show Publisher Agreement”**
3. Lee y acepta el acuerdo (**Agree**)

> No confundir con el Eclipse Contributor Agreement (ECA): para publicar extensiones solo hace falta el **Publisher Agreement**.

## Paso 5: Generar el Personal Access Token (PAT)

1. Ve a https://open-vsx.org/user-settings/tokens
2. Clic en **“Generate New Token”**
3. Pon una descripción clara, por ejemplo: `opencode-vpet-github-actions`
4. Genera el token y **cópialo de inmediato** — solo se muestra una vez.

Guárdalo en un gestor de contraseñas hasta el paso siguiente.

## Paso 6: Añadir el secret en GitHub

1. Abre el repositorio: https://github.com/sbugallo/opencode-vpet
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret**
4. Configura:
   - **Name:** `OVSX_PAT`
   - **Secret:** el token del paso 5
5. Guarda.

El workflow de CD (`.github/workflows/cd.yml`) usa este secret para:

- Crear el namespace `sbugallo` (si no existe)
- Publicar el `.vsix` en Open VSX

No hace falta crear el namespace manualmente: el CD lo crea en el primer release.

## Paso 7: Verificar que todo encaja

Checklist antes del primer release:

- [ ] Cuenta Eclipse creada con GitHub username `sbugallo`
- [ ] Sesión en Open VSX con GitHub (`sbugallo`)
- [ ] Cuenta Eclipse vinculada en el perfil de Open VSX
- [ ] Publisher Agreement firmado
- [ ] Token generado en Open VSX
- [ ] Secret `OVSX_PAT` añadido en GitHub Actions
- [ ] Publisher en `package.json` es `sbugallo` (ya lo es en este repo)

## Paso 8: Probar con un release

1. En GitHub: **Actions** → workflow **CD** → **Run workflow**
2. Elige el tipo de bump (`patch`, `minor` o `major`)
3. Ejecuta desde `main`

Si `OVSX_PAT` está configurado, en el job verás los pasos **“Create Open VSX namespace”** y **“Publish release (Open VSX)”**.

Tras un release correcto, la extensión debería aparecer en:

**https://open-vsx.org/extension/sbugallo/cursor-vpet**

## Publicación manual (opcional)

Si quieres probar antes del CD:

```bash
cd packages/cursor-vpet
bun run build
bun run package
export OVSX_PAT="tu-token-aqui"
npx ovsx create-namespace sbugallo -p "$OVSX_PAT"
npx ovsx publish *.vsix -p "$OVSX_PAT"
```

## Problemas habituales

| Error | Qué revisar |
|---|---|
| *Must log in with Eclipse Foundation account* | Cuenta Eclipse vinculada y Publisher Agreement firmado |
| *Namespace not found* / permisos | El namespace debe ser `sbugallo`; el token debe ser del mismo usuario |
| El paso de Open VSX no aparece en Actions | Falta el secret `OVSX_PAT` o está vacío |
| Token inválido | Genera uno nuevo y actualiza el secret en GitHub |

## Nota sobre VS Code Marketplace

El secret `VSCE_PAT` es **opcional** y solo afecta a la publicación en el Marketplace de Microsoft. Para Open VSX solo necesitas `OVSX_PAT`.
