import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateWritingStyleDto } from '../api/writing-styles/dto/create-writing-style.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { WritingStyle } from './entities/writing-style.entity';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { User } from '../users/entities/user.entity';
import { WritingStyleExample } from './entities/writing-style-example.entity';
import axios from 'axios';
import TurndownService = require('turndown');

@Injectable()
export class WritingStylesService {
  private readonly turndownService: TurndownService;

  constructor(
    @InjectRepository(WritingStyle)
    private readonly writingStyleRepository: EntityRepository<WritingStyle>,
    @InjectRepository(WritingStyleExample)
    private readonly exampleRepository: EntityRepository<WritingStyleExample>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager,
  ) {
    this.turndownService = new TurndownService();
  }

  async create(createWritingStyleDto: CreateWritingStyleDto, userId: number): Promise<WritingStyle> {
    const { name, examples: scrapedExamples } = createWritingStyleDto;

    const writingStyle = new WritingStyle();
    writingStyle.name = name;
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }
    writingStyle.user = user;

    // 스크랩된 예시들을 직접 저장
    const examples = scrapedExamples.map((scrapedExample, index) => {
      const example = new WritingStyleExample();
      example.writingStyle = writingStyle;
      example.content = scrapedExample.content; // 이미 마크다운 형식
      example.order = index;

      return this.exampleRepository.create(example);
    });
    
    if (examples.length === 0) {
      throw new Error('예시가 제공되지 않았습니다.');
    }

    writingStyle.examples.set(examples);

    await this.em.persistAndFlush(writingStyle);

    return writingStyle;
  }

  async findAll(userId: number) {
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }
    return this.writingStyleRepository.find({ user: user });
  }

  async findOne(id: number, userId: number) {
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }
    const style = await this.writingStyleRepository.findOne({ id, user: user });
    if (!style) {
      throw new NotFoundException(`WritingStyle with ID ${id} not found.`);
    }
    return style;
  }

  async remove(id: number, userId: number) {
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }
    const style = await this.writingStyleRepository.findOne({ id, user: user });
    if (!style) {
      throw new NotFoundException(`WritingStyle with ID ${id} not found.`);
    }
    await this.em.removeAndFlush(style);
    return { message: `WritingStyle with ID ${id} deleted successfully.` };
  }
}
