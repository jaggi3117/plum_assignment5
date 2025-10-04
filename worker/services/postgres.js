import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const dbPool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT, 10),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

dbPool.on('connect', () => {
  console.log('PostgreSQL connected successfully.');
});

dbPool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});
