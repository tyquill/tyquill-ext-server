import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { WritingStyle } from './writing-style.entity';

@Entity({ tableName: 'writing_style_examples' })
export class WritingStyleExample {
  @PrimaryKey()
  id: number;

  @ManyToOne(() => WritingStyle)
  writingStyle: WritingStyle;

  @Property({ type: 'text' })
  content: string;

  @Property({ default: 0 })
  order: number; // 예시 순서를 위한 필드

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();
}

