import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'account_deletion_audit' })
export class AccountDeletionAudit {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuid_generate_v4()' })
  id!: string;

  @Property({ fieldName: 'user_id', columnType: 'uuid' })
  @Index()
  userId!: string;

  @Property({ fieldName: 'user_email', length: 255 })
  userEmail!: string;

  @Property({ fieldName: 'deleted_by', length: 20 })
  @Index()
  deletedBy!: 'self' | 'admin';

  @Property({ fieldName: 'admin_id', columnType: 'uuid', nullable: true })
  @Index()
  adminId?: string;

  @Property({ fieldName: 'deleted_entity_counts', type: 'jsonb' })
  deletedEntityCounts!: {
    tags: number;
    articleScraps: number;
    articleArchives: number;
    articles: number;
    writingStyleExamples: number;
    writingStyles: number;
    scraps: number;
    jobs: number;
    folders: number;
    userOAuths: number;
  };

  @Property({ fieldName: 's3_files_deleted', default: 0 })
  s3FilesDeleted!: number;

  @Property({ fieldName: 'errors', type: 'jsonb', nullable: true })
  errors?: string[];

  @Property({ fieldName: 'deleted_at', onCreate: () => new Date() })
  @Index()
  deletedAt = new Date();
}
