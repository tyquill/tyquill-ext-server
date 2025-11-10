import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { User } from '../../users/entities/user.entity';
import { WritingStyleExample } from './writing-style-example.entity';

@Entity({ tableName: 'writing_styles' })
export class WritingStyle {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuid_generate_v4()' })
  id: string;

  @Property({ name: 'legacy_writing_style_id', nullable: true, unique: true })
  legacyWritingStyleId?: number;

  @Property()
  name: string;

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user: User;

  @OneToMany(() => WritingStyleExample, (example) => example.writingStyle, {
    eager: true,
    orphanRemoval: true,
  })
  examples = new Collection<WritingStyleExample>(this);

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();
}
