# CauseTrace frontend

React 19 + Vite single-page app. It talks only to the local CauseTrace backend (default `http://127.0.0.1:8000`); there are no external network requests at runtime.

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173   # development server
npm run lint                                  # oxlint
npm run build                                 # production build into dist/
```

Set `VITE_API_URL` at build/start time to point at a different backend address. The backend only allows CORS from `localhost`/`127.0.0.1` on ports 5173 and 4173.

Graph drawing uses [Cytoscape.js](https://js.cytoscape.org/). See the top-level README for the full system description.
