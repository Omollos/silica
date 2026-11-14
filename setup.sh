#!/usr/bin/env bash
set -euo pipefail

echo "1/4 Initializing npm project..."
npm init -y >/dev/null

# Set ESM + project scripts in package.json
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.name = "silica-station-template";
pkg.private = true;
pkg.type = "module";
pkg.scripts = {
  dev: "tsx server.ts",
  start: "NODE_ENV=production node server.ts",
  build: "vite build",
  preview: "vite preview",
  lint: "tsc --noEmit",
  test: "vitest run"
};
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
'

echo "2/4 Creating folder and empty file structure..."
mkdir -p public/assets
mkdir -p src/{audio,content,engine/__tests__,store,three,ui,screens/{title,round,end}}

# Create empty placeholder files for all 6 developer modules
touch \
  src/types.ts \
  src/content/scenario.json \
  src/content/facts.json \
  src/engine/index.ts \
  src/engine/rules.ts \
  src/engine/queue.ts \
  src/engine/events.ts \
  src/engine/report.ts \
  src/engine/rng.ts \
  src/engine/__tests__/engine.test.ts \
  src/store/gameStore.ts \
  src/store/nasaDataStore.ts \
  src/store/settingsStore.ts \
  src/three/MoonGlobe.tsx \
  src/three/CommandBay3D.tsx \
  src/screens/title/TitleScreen.tsx \
  src/screens/round/RoundScreen.tsx \
  src/screens/round/StationScene.tsx \
  src/screens/round/ChoiceButton.tsx \
  src/screens/round/CrewComms.tsx \
  src/screens/round/EventBanner.tsx \
  src/screens/round/ResultLine.tsx \
  src/screens/round/MissionOutcomeModal.tsx \
  src/screens/end/WinScreen.tsx \
  src/screens/end/MissionReport.tsx \
  src/screens/end/ReportChain.tsx \
  src/screens/end/RetryButtons.tsx \
  src/ui/Bar.tsx \
  src/ui/AstronautFace.tsx \
  src/ui/DetailTap.tsx \
  src/ui/ScienceLibraryModal.tsx \
  src/ui/SpeakerButton.tsx \
  src/ui/icons.tsx \
  src/audio/sfx.ts \
  src/audio/speak.ts

# Initialize valid empty JSON placeholders so imports don't fail parsing
echo "{}" > src/content/scenario.json
echo "[]" > src/content/facts.json

echo "3/4 Writing starter configuration & entry files..."

cat <<'EOF' > .gitignore
node_modules
dist
.env
*.log
EOF

cat <<'EOF' > .env.example
PORT=3000
NASA_API_KEY=DEMO_KEY
EOF

cat <<'EOF' > tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true
  },
  "exclude": ["dist"]
}
EOF

cat <<'EOF' > vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
});
EOF

cat <<'EOF' > index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>3D Survival Mission App</title>
  </head>
  <body class="bg-[#050914] text-slate-100 antialiased overflow-x-hidden">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

cat <<'EOF' > src/index.css
@import "tailwindcss";
EOF

cat <<'EOF' > src/App.tsx
import React from 'react';

export function App() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050914] text-slate-100 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Project Scaffold Ready</h1>
        <p className="text-sm text-slate-400">
          React, Tailwind CSS v4, Three.js, Zustand, Express, and Vitest are installed.
        </p>
      </div>
    </main>
  );
}

export default App;
EOF

cat <<'EOF' > src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
EOF

cat <<'EOF' > server.ts
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Example API route
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
EOF

echo "4/4 Installing runtime and dev dependencies..."
npm install \
  react \
  react-dom \
  three \
  zustand \
  express \
  dotenv \
  lucide-react \
  motion

npm install -D \
  typescript \
  vite \
  @vitejs/plugin-react \
  tailwindcss \
  @tailwindcss/vite \
  vitest \
  tsx \
  @types/node \
  @types/react \
  @types/react-dom \
  @types/three \
  @types/express

echo ""
echo "Setup complete! Run:"
echo "  npm run dev    # Start Express + Vite dev server on http://localhost:3000"
echo "  npm run lint   # Type-check with TypeScript"
echo "  npm test       # Run Vitest unit tests"
echo "  npm run build  # Build production bundle into dist/"