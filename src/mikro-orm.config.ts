import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { config } from 'dotenv';

// .env 파일 로드
config();

export default defineConfig({
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  clientUrl: process.env.DATABASE_URL,
  //   dbName: process.env.DATABASE_NAME,
  schema: 'public',
  debug: true,
  allowGlobalContext: true,
  driverOptions: {
    connection: {
      ssl: { rejectUnauthorized: false },
    },
  },
});
