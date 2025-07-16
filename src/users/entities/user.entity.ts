import { Entity, OneToMany, PrimaryKey, Property, Collection } from '@mikro-orm/core';
import { Scrap } from '../../scraps/entities/scrap.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { UserOAuth } from './user-oauth.entity';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ name: 'user_id' })
  userId: number;

  @Property({ name: 'email', unique: true })
  email: string;

  @Property({ name: 'name' })
  name: string;

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();

  @Property({ name: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => Scrap, scrap => scrap.user)
  scraps: Collection<Scrap> = new Collection<Scrap>(this);

  @OneToMany(() => Tag, tag => tag.user)
  tags: Collection<Tag> = new Collection<Tag>(this);

  @OneToMany(() => UserOAuth, oauth => oauth.user)
  oauthAccounts: Collection<UserOAuth> = new Collection<UserOAuth>(this);
} 