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
  @PrimaryKey()
  id: number;

  @Property()
  name: string;

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user: User;

  @OneToMany(
    () => WritingStyleExample,
    (example) => example.writingStyle, 
    {
      eager: true,
      orphanRemoval: true,
    }
  )
  examples = new Collection<WritingStyleExample>(this);

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();
}

