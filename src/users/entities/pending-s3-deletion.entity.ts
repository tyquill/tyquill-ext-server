import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'pending_s3_deletions' })
export class PendingS3Deletion {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuid_generate_v4()' })
  id!: string;

  @Property({ fieldName: 'user_id', columnType: 'uuid' })
  @Index()
  userId!: string;

  @Property({ fieldName: 's3_key', length: 512 })
  s3Key!: string;

  @Property({ fieldName: 'bucket_name', length: 255 })
  bucketName!: string;

  @Property({ fieldName: 'retry_count', default: 0 })
  retryCount!: number;

  @Property({ fieldName: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  @Index()
  createdAt = new Date();

  @Property({
    fieldName: 'next_retry_at',
    nullable: true,
    onCreate: () => new Date(),
  })
  nextRetryAt?: Date;

  @Property({ fieldName: 'status', length: 20, default: 'pending' })
  @Index()
  status!: 'pending' | 'completed' | 'failed';
}
