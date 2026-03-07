# hover-fixture-debug

Canonical React + Vite fixture app for manual and automated hover preview debugging.

## Why this exists

This fixture gives us a stable local app to validate:

- dev server detection and workspace targeting
- element matching from TSX file + line + column
- hover screenshot generation and rendering in markdown

## Run locally

From the repository root:

```sh
npm run fixture:hover:install
npm run fixture:hover:dev
```

The app will run on `http://127.0.0.1:5173`.

## Use with the extension

1. Open this repo in VS Code.
2. Launch the extension in debug mode (`F5`).
3. In the Extension Development Host, open a file under:
   - `fixtures/hover-fixture-debug/src`
4. Hover over JSX in the fixture while the fixture dev server is running.

If detection is ambiguous, set:

- `component-preview.devServerUrl = http://127.0.0.1:5173`

## Notes

- `node_modules` and `dist` are not stored in this repo fixture.
- Install dependencies with `npm` inside this fixture.
