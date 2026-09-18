import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

const app = express();
app.use(express.static(distPath));

// Client-side view state (not URL routing), but a catch-all keeps deep
// links like /?join=<id>&t=<id> and any unexpected path working.
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Cloud Run (Firebase App Hosting) injects PORT and requires the server to
// bind 0.0.0.0 - binding to the default localhost makes its health check
// unreachable and the rollout times out.
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`Kickivo listening on port ${port}`);
});
