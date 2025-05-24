import express from 'express';
import cors from 'cors';
import { register } from '../utils/metrics.js';
import logger from '../utils/logger.js';

const app = express();
const PORT = 9090;

app.use(cors());

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error('Error while getting metrics:', err);
    res.status(500).end(err);
  }
});

app.listen(PORT, () => {
  logger.info(`Metrics server listening at http://localhost:${PORT}`);
});

export default app; 