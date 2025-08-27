import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { config } from 'dotenv';

// .env 파일 로드
config();

import { Article } from './articles/entities/article.entity';
import { ArticleArchive } from './article-archive/entities/article-archive.entity';
import { Scrap } from './scraps/entities/scrap.entity';
import { Tag } from './tags/entities/tag.entity';
import { User } from './users/entities/user.entity';
import { UserOAuth } from './users/entities/user-oauth.entity';
import { WritingStyle } from './writing-styles/entities/writing-style.entity';
import { WritingStyleExample } from './writing-styles/entities/writing-style-example.entity';

export default defineConfig({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  dbName: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  // 명시적으로 엔티티 지정
  entities: [Article, ArticleArchive, Scrap, Tag, User, UserOAuth, WritingStyle, WritingStyleExample],
  schema: 'public',
  debug: true,
  allowGlobalContext: true,
  driverOptions: {
    connection: {
      ssl: { rejectUnauthorized: false },
    },
  },
});
