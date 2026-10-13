# Laiba Khawar, AI Engineer: portfolio

Personal portfolio built with Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS v4, Motion, React Three Fiber, and React Flow.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Tests for the demo algorithms use Node's built-in runner (Node 20.9+, 24 recommended):

```bash
npm test
```

## Deployment

The site is hosted on Vercel at [www.laibakhawar.com](https://www.laibakhawar.com). Every push to `main` deploys to production automatically; pushes to other branches get preview deployments.

## What is where

| Path | Purpose |
| --- | --- |
| `src/content/profile.ts` | Resume facts: role, experience, skills, education, certifications. Update this when the resume changes, and replace `public/Laiba_Khawar_Resume.pdf`. |
| `src/content/projects.ts` | Curated metadata for every project: tier, categories, stack, case-study text, recorded results with sources, architecture graph, and demo key. |
| `src/components/demos/<key>/` | In-browser demos. Each has `logic.ts` (pure algorithm), `logic.test.ts`, and `index.tsx`. Registered in `registry.tsx`. |
| `src/app/projects/` | The Projects page: every project explained in its own section (`/projects#<slug>`). Every project link on the site points there; old `/work/<slug>` and `/lab` addresses redirect to it. |
| `src/components/flow/` | The page transition: a WebGL fragment shader that expands from the clicked card, covers the screen, and reveals the next page. |
| `src/components/hero/` | The 3D pipeline network in the hero (React Three Fiber). |
| `src/vendor/liquid-glass/` | Refraction shader adapted from liquid-glass-js (MIT). Used by `components/glass/LiquidGlass.tsx`. |
| `public/demos/` | Data used by demos, extracted from the original repositories. |
| `public/projects/` | Project images: notebook outputs and screenshots of the live demos. |

## Adding a project

1. Append an entry to `projects` in `src/content/projects.ts`.
   - `tier: "case-study"` and `tier: "card"` get a full section on the Projects page and a page in the home carousel; case studies with an `architecture` also appear in the systems explorer.
   - `tier: "archive"` appears in the coursework list at the end of the Projects page.
   - Only add `results` that are recorded in a README or notebook output, and say where in `source`.
   - Only set `liveUrl` for a deployment that responds.
2. Optional: add an image to `public/projects/` and set `cover`. The projects carousel loads a compact copy from `public/projects/thumbs/<name>.jpg`; create it with `ffmpeg -i public/projects/<file> -vf "scale='min(640,iw)':-2" -q:v 4 public/projects/thumbs/<name>.jpg`.
3. Optional: build a demo in `src/components/demos/<key>/`, add the key to `DemoKey`, and register it in `registry.tsx`.

The carousel, Projects page, and skills explorer pick the entry up automatically.

## Accessibility and motion

- `prefers-reduced-motion`: page transitions, smooth scrolling, the custom cursor, and hero animation are turned off or reduced to a still frame.
- No WebGL: the projects carousel becomes a plain list, the transition falls back to a CSS clip-path, and glass falls back to a CSS backdrop filter.
- `prefers-reduced-transparency`: glass surfaces become solid.

## Credits

- Refraction shader adapted from [liquid-glass-js](https://github.com/dashersw/liquid-glass-js) by Armagan Amcalar (MIT).
- Design rules followed during the build: [TasteSkill](https://www.tasteskill.dev/docs).
