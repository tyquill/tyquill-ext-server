import { Injectable } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { User } from './entities/user.entity';
import { InjectRepository } from '@mikro-orm/nestjs';

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {}

  async findOne(id: number): Promise<User | null> {
    return await this.userRepository.findOne({ userId: id });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ email });
  }

  async create(userData: { email: string; name: string }): Promise<User> {
    const user = new User();
    Object.assign(user, userData);
    await this.em.persistAndFlush(user);
    return user;
  }
} 