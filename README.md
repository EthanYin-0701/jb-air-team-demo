# PawGroove - Pet Dance Video Generator

PawGroove is a Next.js application that allows users to generate amazing dance videos of their pets using AI models via OpenRouter.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Create a `.env.local` file in the root directory and add your OpenRouter API key:
   ```bash
   OPENROUTER_API_KEY=your_actual_key_here
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Testing

Run the unit tests:
```bash
npm test
```

## Simplifications vs. Design Docs

This MVP includes several architectural simplifications compared to the full design in `plans/04-architecture.md`:

- **Database**: Replaced PostgreSQL with a simple file-backed JSON store (`db.json`). Data is persistent but managed in a single-process manner.
- **Storage**: Replaced S3 with local filesystem storage under the `storage/` directory. Assets are served via a Next.js route (`/api/storage/[filename]`) which simulates "private" access using an opaque token.
- **Queue & Worker**: Replaced the persistent task queue and separate Worker process with in-process async processing. Jobs are processed by a background function in the same Node.js process.
- **Authentication**: Skipped the email OTP / auth flow. The app uses a single implicit "local-user" for all actions. The data model still supports multi-user attributes for future expansion.
- **Frame Extraction**: Frame extraction from pet videos is currently a stub that records the timestamp, as `ffmpeg` might not be available in all environments.
- **SSRF Guard**: Implemented a robust SSRF guard for URL imports that checks for private/loopback IP addresses after DNS resolution.
- **Fonts**: Removed Google Fonts dependency to allow building in restricted network environments.

## Architecture

- **Frontend**: Next.js App Router, TypeScript, Tailwind CSS.
- **API**: Next.js Route Handlers.
- **Models**: Fetched and merged from OpenRouter's text and video catalogs.
- **Job Pipeline**: Queued -> Analyzing -> Submitting -> Provider_queued -> Generating -> Processing -> Succeeded/Failed.
- **Usage Panel**: Provides real-time token and credit consumption details from OpenRouter.
