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

export default defineConfig({
  // 명시적으로 엔티티 지정
  entities: [Article, ArticleArchive, Scrap, Tag, User, UserOAuth],
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
