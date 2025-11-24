import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { config } from 'dotenv';

// .env 파일 로드
config();

import { Article } from './articles/entities/article.entity';
import { ArticleArchive } from './article-archive/entities/article-archive.entity';
import { ArticleScrap } from './articles/entities/article-scrap.entity';
import { Scrap } from './scraps/entities/scrap.entity';
import { Tag } from './tags/entities/tag.entity';
import { User } from './users/entities/user.entity';
import { UserOAuth } from './users/entities/user-oauth.entity';
import { WritingStyle } from './writing-styles/entities/writing-style.entity';
import { WritingStyleExample } from './writing-styles/entities/writing-style-example.entity';
import { Job } from './queue/entities/job-status.entity';
import { Folder } from './folders/entities/folder.entity';
import { AccountDeletionAudit } from './users/entities/account-deletion-audit.entity';
import { PendingS3Deletion } from './users/entities/pending-s3-deletion.entity';
import { ArticleChatSession } from './article-chat/entities/article-chat-session.entity';
import { ArticleChatMessage } from './article-chat/entities/article-chat-message.entity';
import { RepurposedContent } from './repurpose/entities/repurposed-content.entity';
import { FormatTemplate } from './repurpose/entities/format-template.entity';
import { RepurposingJob } from './repurpose/entities/repurposing-job.entity';
import { ExportHistory } from './repurpose/entities/export-history.entity';
import { FormatRule } from './repurpose/entities/format-rule.entity';

export default defineConfig({
  clientUrl: process.env.DATABASE_URL,
  // 명시적으로 엔티티 지정
  entities: [
    Article,
    ArticleArchive,
    ArticleScrap,
    Scrap,
    Tag,
    User,
    UserOAuth,
    WritingStyle,
    WritingStyleExample,
    Job,
    Folder,
    AccountDeletionAudit,
    PendingS3Deletion,
    ArticleChatSession,
    ArticleChatMessage,
    RepurposedContent,
    FormatTemplate,
    RepurposingJob,
    ExportHistory,
    FormatRule,
  ],
  schema: 'public',
  debug: true,
  allowGlobalContext: true,
  migrations: {
    path: './src/migrations',
    pathTs: './src/migrations',
  },
  driverOptions: {
    connection: {
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    },
  },
});
