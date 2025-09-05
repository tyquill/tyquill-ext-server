import { Entity, PrimaryKey, Property, Enum } from '@mikro-orm/core';

export enum JobType {
  FILE_ANALYSIS = 'FILE_ANALYSIS',
}

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

@Entity({ tableName: 'jobs' })
export class Job {
  @PrimaryKey()
  jobId!: number;

  @Property()
  jobUuid!: string; // Unique identifier for tracking

  @Enum(() => JobType)
  jobType!: JobType;

  @Enum(() => JobStatus)
  status: JobStatus = JobStatus.PENDING;

  @Property()
  userId!: number;

  @Property({ type: 'json', nullable: true })
  payload?: any; // Job-specific data

  @Property({ type: 'json', nullable: true })
  result?: any; // Job result

  @Property({ nullable: true })
  errorMessage?: string;

  @Property()
  retryCount: number = 0;

  @Property()
  maxRetries: number = 3;

  @Property({ nullable: true })
  sqsMessageId?: string;

  @Property({ nullable: true })
  queueName?: string;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ nullable: true })
  startedAt?: Date;

  @Property({ nullable: true })
  completedAt?: Date;
}
