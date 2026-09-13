import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/api/data', async (_req, res) => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    res.json(JSON.parse(raw));
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({ dataVersion: 1, wrongQuestions: [], tricks: [] });
    } else {
      res.status(500).json({ error: 'read failed' });
    }
  }
});

app.put('/api/data', async (req, res) => {
  const body = req.body;
  if (!body || body.dataVersion !== 1) {
    return res.status(400).json({ error: 'invalid data' });
  }
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(body, null, 2));
    await fs.rename(tmp, DATA_FILE);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'write failed' });
  }
});

const dist = path.join(__dirname, 'dist');
app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(dist, 'index.html'), (err) => { if (err) next(); });
});

app.listen(PORT, () => console.log(`server on :${PORT}`));
