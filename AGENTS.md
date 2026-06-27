# Agent Instructions

Always start in plan mode.

## Project Overview

This is `crush`, a SvelteKit app created with `vp create svelte` and managed by Vite+.

- Runtime/build toolchain: Vite+ via the global `vp` CLI.
- Framework: SvelteKit with Svelte 5.
- Language: TypeScript.
- Adapter: `@sveltejs/adapter-auto`.
- Source routes live in `src/routes`.
- Shared app code should live under `src/lib`, imported with `$lib`.
- The project forces Svelte runes mode for app code in `vite.config.ts`.

## Vite+ Workflow

Use Vite+ commands as the default interface for development, builds, installs, formatting,
linting, and checks. Do not replace this workflow with raw Vite, npm, pnpm, or yarn commands
unless there is a specific reason and you call that out.

Common commands:

- `vp install` installs and syncs dependencies.
- `vp dev` starts the development server.
- `vp build` builds the app.
- `vp preview` previews the production build.
- `vp check` runs the project checks configured through Vite+.
- `vp test` runs tests when tests are present/configured.
- `vp run <script>` runs package scripts when a project script is the right entry point.

The `package.json` scripts mirror the Vite+ workflow:

- `dev`: `vp dev`
- `build`: `vp build`
- `preview`: `vp preview`
- `prepare`: `vp config && svelte-kit sync || echo ''`
- `check`: `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json`
- `lint`: `vp fmt --check .`
- `format`: `vp fmt .`

Local Vite+ docs are available at `node_modules/vite-plus/docs` after dependencies are installed.
Online docs are at <https://viteplus.dev/guide/>.

## Dev Server and Builds

Assume the development server is usually already running in another terminal tab.

- Do not start a second `vp dev` server unless the user asks for it or you have verified no server
  is running.
- Prefer checking the existing local server in the browser or with HTTP requests when validating UI
  behavior.
- Be careful with `vp build` and other build-like commands because they can sometimes disrupt the
  running dev server in this project.
- Run `vp build` only when a production build is specifically needed, the user asks for it, or the
  change has enough build-time risk to justify it. Mention when you skip it for this reason.

## Code Style

Follow the formatting options in `vite.config.ts`:

- Use tabs for indentation.
- Use single quotes.
- Do not add trailing commas.
- Keep lines at or under 100 columns where practical.
- Keep `package.json` ordering stable; Vite+ formatting is configured not to sort it.

Svelte guidance:

- Prefer Svelte 5 runes APIs for new component state and props.
- Use `<script lang="ts">` for typed component scripts.
- Keep route UI in `src/routes` and reusable components/utilities in `src/lib`.
- Preserve SvelteKit file conventions such as `+page.svelte`, `+layout.svelte`,
  `+page.ts`, and `+server.ts`.
- Use `$lib` imports for shared code instead of fragile deep relative paths.

## Validation Checklist

Before making changes:

- Check the working tree with `git status --short`.
- Run `vp install` after pulling remote changes or when dependencies/config look stale.

After making code changes:

- Run `vp check`.
- Run `vp test` when tests exist or when you add test coverage.
- Run relevant package scripts with `vp run <script>` if `package.json` or `vite.config.ts`
  defines a more specific validation path.

For docs-only edits, at minimum review the diff and state if runtime checks were not run.

If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its
output when asking for help.

## Editing Boundaries

- Keep changes focused on the requested task.
- Do not revert unrelated user changes.
- Do not edit generated SvelteKit output such as `.svelte-kit` directly.
- Do not introduce a different package manager workflow; this project is managed by Vite+.
