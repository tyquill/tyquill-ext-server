import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { WritingStyle } from './writing-style.entity';

@Entity({ tableName: 'writing_style_examples' })
export class WritingStyleExample {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuid_generate_v4()' })
  id: string;

  @Property({ name: 'legacy_example_id', nullable: true, unique: true })
  legacyExampleId?: number;

  @ManyToOne(() => WritingStyle, { fieldName: 'writing_style_id' })
  writingStyle: WritingStyle;

  @Property({ type: 'text' })
  content: string;

  @Property({ default: 0 })
  order: number; // 예시 순서를 위한 필드

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();
}
