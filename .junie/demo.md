vm: template-vm

## Running inside the VM

PawGroove is a Next.js (App Router, TypeScript) app. Build and start the production server, bound to all interfaces so it's reachable outside the VM:

    cd /workspace
    npm install
    npm run build
    npx next start -H 0.0.0.0 -p 3000 &
    # ready when http://localhost:3000 responds 200

## Known quirks

- No `OPENROUTER_API_KEY` is configured for this demo. The creation studio UI, routing, and pages render normally, but the model dropdowns (populated from the OpenRouter catalog) and actual job generation will fail or stay empty. Scope the demo to UI/navigation, not end-to-end video generation.
- There is no database or external service dependency — the app uses a local file-backed JSON store (`db.json`) and local `storage/` directory, both created automatically on first use.
