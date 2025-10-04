import express from 'express';
import dotenv from 'dotenv';
import scheduleRoutes from './routes/schedule.js';
import cors from 'cors'; // migh wanna test from dumb frontend html page
import statusRoutes from './routes/status.js'; // to get the status of task

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// route for schedule a job
app.use('/api/v1/schedule', scheduleRoutes);

//route to get status of already scheduled job
app.use('/api/v1/status', statusRoutes);

// Simple health check endpoint
app.get('/ping', (req, res) => {
  res.status(200).json({ status: 'i am oik' });
});

app.listen(PORT, () => {
  console.log(`ok API started on  http://localhost:${PORT}`);
});
