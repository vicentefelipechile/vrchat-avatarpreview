# AGENTS.md — VRCStorage Avatar Preview

Context guide for AI agents working in this repository.
Read this file before touching any code.

---

## What this project is

A Windows desktop application (**Tauri v2 + Rust + Three.js**) that lets users preview
VRChat avatars in 3D without installing Unity.

The user opens a `.unitypackage` file (Unity's asset distribution format), the app
extracts the internal assets, resolves the cross-references between them, and renders
the 3D model with textures applied, interactive orbit controls, and side panels.

**Core motivation:** VRChat avatar packages are sold on platforms like Booth.pm and
Gumroad. Buyers have no way to preview the avatar without opening Unity, which requires
gigabytes of software and project setup. This app removes that barrier entirely.

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Desktop shell | Tauri v2 | Rust backend, WebView frontend, small binary |
| Backend | Rust | Safe file parsing, no Unity dependency |
| Archive extraction | `flate2` + `tar` | `.unitypackage` is a standard tar.gz |
| YAML parsing | `serde_yaml 0.9` | Parses Unity `.mat` / `.prefab` after stripping non-standard headers |
| Serialization | `serde` + `serde_json` | Tauri command data contract |
| Error handling | `anyhow` (app) + `thiserror` (library surfaces) | Standard Rust error pattern |
| 3D rendering | Three.js (in Tauri WebView) | Mature FBXLoader, morph target support |
| UI | Vanilla TypeScript + HTML templates | No framework overhead |
| Routing | Custom hash router (`#welcome`, `#viewer`) | SPA without a framework |
| Icons | Lucide (inline SVG) | Consistent icon set, no runtime dependency |
| Regex | `regex` crate | Variant group detection by name pattern |
| Session IDs | `uuid` crate | Unique temp directories per session |

---

## File map

```
vrcstorage-avatarpreview/
├── AGENTS.md                        ← This file
│
├── src-tauri/src/
│   ├── lib.rs                       ← Tauri entry point, plugin and command registration
│   ├── main.rs                      ← Binary entry (do not touch)
│   │
│   ├── extractor/mod.rs             ← Gunzip + untar → session dir + GuidMap
│   ├── parser/
│   │   ├── mod.rs
│   │   ├── guid_map.rs              ← Guid, AssetEntry, GuidMap types
│   │   ├── classifier.rs            ← AssetKind enum, classify_by_extension()
│   │   ├── prefab.rs                ← Unity YAML multi-doc splitter → PrefabData
│   │   ├── material.rs              ← .mat YAML parser → RawMaterial (color, emission, floats, textures)
│   │   └── shader_compat.rs         ← detect_shader_family() → ShaderFamily
│   ├── resolver/mod.rs              ← GuidMap + parsed assets → full SceneGraph
│   ├── scene/mod.rs                 ← Public serializable structs (SceneGraph, etc.)
│   └── commands/mod.rs              ← Tauri commands: open_file_dialog, load_package, cleanup_session_cmd
│
├── src/
│   ├── main.ts                      ← Boot: initializes the router
│   ├── router.ts                    ← Hash router: #welcome ↔ #viewer
│   ├── types/scene.ts               ← TypeScript mirrors of Rust structs
│   ├── store/scene.ts               ← Global app state (AppState, getState, setState)
│   │
│   ├── views/
│   │   ├── welcome.ts               ← Initial screen, "Open Package" button
│   │   └── viewer.ts                ← Viewer layout: canvas + tab bar + panels
│   │
│   ├── viewer/
│   │   ├── scene.ts                 ← Three.js: renderer, camera, lights, render loop
│   │   ├── loader.ts                ← FBXLoader, material replacement, node/mesh-by-slot registry
│   │   ├── material-mapper.ts       ← ResolvedMaterial → MeshStandardMaterial or MeshToonMaterial
│   │   │                              Texture cache + material instance cache + live update API
│   │   └── blend-shapes.ts          ← Morph target collection and categorization
│   │
│   ├── panels/
│   │   ├── object-panel.ts          ← Tab "Objects": visibility toggles + variant groups
│   │   ├── blend-shape-panel.ts     ← Tab "Shapes": sliders by category (Body/Clothing/Other)
│   │   ├── shader-panel.ts          ← Tab "Materials": badge + thumbnail + live shader editor
│   │   ├── warnings-panel.ts        ← Tab "Warnings": collapsible list
│   │   └── stats-bar.ts             ← Always visible: triangle/bone/material/shape counts
│   │
│   └── styles/
│       ├── main.css                 ← Entry point: @imports all modules in order
│       ├── tokens.css               ← CSS custom properties (colors, sizes)
│       ├── reset.css                ← Reset + shared global helpers
│       ├── welcome.css              ← Welcome screen styles
│       ├── viewer-layout.css        ← Canvas container, side panel, tab bar
│       └── panels.css               ← All panels (objects, shapes, materials, warnings, stats)
│
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/default.json
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Processing pipeline

```
User opens .unitypackage
        │
        ▼
PHASE 1 — EXTRACTION  (extractor/mod.rs)
  flate2 gunzip → tar unpack → %TEMP%/avatarpreview/{uuid}/
  Builds GuidMap: HashMap<Guid, AssetEntry { pathname, asset_path }>

        │
        ▼
PHASE 2 — CLASSIFICATION  (parser/classifier.rs)
  By pathname extension: Mesh | Material | Texture | Prefab | ShaderSource | Ignored

        │
        ▼
PHASE 3 — PARSING  (parser/prefab.rs, parser/material.rs)
  Prefabs:   split by "--- !u!XX &YYYY", parse GameObject (type 1) and SkinnedMeshRenderer (type 137)
  Materials: strip Unity YAML headers, extract shader GUID, _Color, _EmissionColor,
             _MainTex, _BumpMap, _EmissionMap, m_Floats (_Metallic, _Glossiness, etc.)

        │
        ▼
PHASE 4 — RESOLUTION  (resolver/mod.rs)
  mesh GUID    → FBX file path
  material GUID → RawMaterial → texture GUIDs → albedo/normal/emission PNG/TGA paths
  shader GUID  → shader pathname → ShaderFamily detection
  floats       → metallic, smoothness values
  name regex   → VariantGroup detection

        │
        ▼
PHASE 5 — EMIT  (commands/mod.rs)
  SceneGraph serialized to JSON via load_package() Tauri command

        │
        ▼
PHASE 6 — RENDER  (src/viewer/)
  FBXLoader.loadAsync(convertFileSrc(fbx_path))
  traverse() → buildMaterial() → MeshStandardMaterial (Standard/URP) or MeshToonMaterial (Poiyomi/LilToon/XSToon/Unknown)
  Applies albedo, normal map, emission map automatically from ResolvedMaterial
  OrbitControls, studio lighting, fit camera to bounding box
```

---

## Data contract (Rust → Frontend)

The contract lives in two places that **must stay in sync**:

- **Rust:** [src-tauri/src/scene/mod.rs](src-tauri/src/scene/mod.rs)
- **TypeScript:** [src/types/scene.ts](src/types/scene.ts)

If you change a struct in Rust, update the TypeScript type and vice versa.

```
SceneGraph
├── nodes: SceneNode[]            ← fbx_path (absolute), active_by_default, material_slots
├── materials: ResolvedMaterial[] ← shader_family, albedo/normal/emission paths,
│                                    color, emission_color [f32; 4], metallic, smoothness
├── variant_groups: VariantGroup[]
├── stats: AvatarStats
└── warnings: string[]
```

---

## Material rendering strategy

`buildMaterial()` in `material-mapper.ts` selects the Three.js material type based on shader family:

| ShaderFamily | Three.js material | Reasoning |
|---|---|---|
| `Standard`, `URP` | `MeshStandardMaterial` | PBR shader — metallic/roughness workflow |
| `Poiyomi`, `LilToon`, `XSToon`, `Unknown` | `MeshToonMaterial` | Anime/toon shaders — flat cel shading |

All material types receive albedo, normal map, and emission map automatically if the
package contains them. The user can override the render mode and adjust parameters live
from the Materials tab shader editor.

Material instances are **cached by slot index** in `materialInstances` (in `material-mapper.ts`).
All meshes that reference the same slot share the same `THREE.Material` instance.
Call `clearMaterialInstances()` before loading a new package.

---

## Asset protocol in the WebView

FBX files and textures live in a session temp directory on disk.
For Three.js to load them from inside the Tauri WebView, the asset protocol is used:

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';
const url = convertFileSrc(absoluteWindowsPath);
// → "asset://localhost/C:/Users/.../AppData/Local/Temp/avatarpreview/{uuid}/file.fbx"
```

This requires three things, all already active:
- `"protocol-asset"` feature in `Cargo.toml`
- `assetProtocol.enable: true` + `scope: ["**"]` in `tauri.conf.json`
- CSP disabled (`"csp": null`) in `tauri.conf.json`

---

## Unity YAML quirks — read carefully

1. **Non-standard header:** `.mat` and `.prefab` files start with `%YAML 1.1` and `%TAG !u!`
   followed by `--- !u!XX &YYYYYY` block separators. Standard YAML parsers fail on these.
   **Fix:** `split_unity_documents()` in `prefab.rs` splits on these markers before parsing each block.

2. **Binary format:** if a `.mat` or `.prefab` does not start with `%YAML`, it is in binary format
   and cannot be parsed as text. `is_binary()` in `extractor/mod.rs` detects this.
   The resolver emits a warning and skips the file.

3. **Zero GUIDs:** `{fileID: 0, guid: "00000000000000000000000000000000", type: 3}` means a null
   reference. Always filter with `.filter(|s| !s.chars().all(|c| c == '0'))`.

4. **Single-key sequences:** Unity YAML uses `m_Colors: [{ _Color: {r:1,...} }]` — a sequence of
   single-entry mappings. Iterate over `Value::Sequence` of `Value::Mapping` entries.
   The same pattern applies to `m_Floats` and `m_TexEnvs`.

---

## Development rules

### Rust
- **Zero warnings:** the project compiles clean. Keep it that way.
- Use `anyhow::Result` in internal functions; `Result<T, String>` only in `#[tauri::command]`.
- Tauri commands convert errors with `.map_err(|e| e.to_string())`.
- The session temp dir is cleaned up on: (1) opening a new file, (2) window close.

### TypeScript / Frontend
- **No framework** — vanilla TS + DOM only. Do not introduce React, Vue, Svelte, etc.
- **No comments** — code must be self-explanatory through naming.
- Every panel exports a `render(container, data)` function and writes directly to the DOM.
- The Three.js canvas **is never unmounted** once initialized — only cleared via `clearMeshes()`.
  **Never call `disposeScene()` on back-navigation.** It nulls the renderer/scene/camera and
  cannot be reinitialized (initScene is only called once from initLayout). On Back: call
  `clearMaterialInstances()` then `clearMeshes()`.
- `buildMaterial()` in `material-mapper.ts` is the single place materials are constructed.
  Never build `MeshStandardMaterial` or `MeshToonMaterial` inline in any other module.
  It returns `THREE.Material` (not a specific subtype) — callers must not assume the subtype.
- **Icons are always inline Lucide SVGs.** The project uses Lucide throughout — use it.
  Never use emoji characters as icons or decorative elements in the UI. Ever.

### CSS
- All styles live under `src/styles/`. The entry point is `main.css`.
- Design tokens (colors, sizes) are defined only in `tokens.css`.
- No `!important`. No inline styles except for dynamic runtime values (material colors).

---

## Running the project

```bash
# Install frontend dependencies
npm install

# Development mode (Vite + Tauri with hot reload)
npm run tauri dev

# Production build
npm run tauri build
```

Requirements: Rust stable, Node.js 18+, WebView2 (bundled with Windows 10/11).
