export default {
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  dbName: process.env.DB_NAME,
  type: 'postgresql',
  host: process.env.DATABASE_URL,
  port: 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  debug: true,
};
