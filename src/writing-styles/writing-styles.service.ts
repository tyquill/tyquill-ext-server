import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateWritingStyleDto } from '../api/writing-styles/dto/create-writing-style.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { WritingStyle } from './entities/writing-style.entity';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { User } from '../users/entities/user.entity';
import { WritingStyleExample } from './entities/writing-style-example.entity';
import axios from 'axios';
import {
  UserIdentifierLike,
  buildUserFilterFromInput,
} from '../users/utils/user-identifier.util';
import {
  WritingStyleIdentifierLike,
  buildWritingStyleWhereClause,
  normalizeWritingStyleId,
} from './utils/writing-style-identifier.util';
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

  /**
   * Resolve canonical UUID for a writing style ID (supports both UUID and legacy integer)
   *
   * @param id - Writing style identifier (UUID or legacy integer)
   * @returns Canonical UUID string
   * @throws NotFoundException if writing style not found
   */
  async resolveCanonicalWritingStyleId(
    id: WritingStyleIdentifierLike,
  ): Promise<string> {
    const normalizedId = normalizeWritingStyleId(id);
    const whereClause = buildWritingStyleWhereClause(normalizedId);

    const writingStyle = await this.writingStyleRepository.findOne(whereClause);

    if (!writingStyle) {
      throw new NotFoundException(
        `Writing style with ID ${normalizedId} not found`,
      );
    }

    return writingStyle.id; // Always return UUID
  }

  async create(
    createWritingStyleDto: CreateWritingStyleDto,
    userId: UserIdentifierLike,
  ): Promise<WritingStyle> {
    const { name, examples: scrapedExamples } = createWritingStyleDto;

    const writingStyle = new WritingStyle();
    writingStyle.name = name;
    const user = await this.userRepository.findOne(
      buildUserFilterFromInput(userId),
    );
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

  async findAll(userId: UserIdentifierLike) {
    const user = await this.userRepository.findOne(
      buildUserFilterFromInput(userId),
    );
    if (!user) {
      throw new Error('User not found');
    }
    return this.writingStyleRepository.find({ user: user });
  }

  async findOne(
    id: WritingStyleIdentifierLike,
    userId: UserIdentifierLike,
  ): Promise<WritingStyle> {
    const user = await this.userRepository.findOne(
      buildUserFilterFromInput(userId),
    );
    if (!user) {
      throw new Error('User not found');
    }

    const normalizedId = normalizeWritingStyleId(id);
    const whereClause = buildWritingStyleWhereClause(normalizedId);

    const style = await this.writingStyleRepository.findOne({
      ...(whereClause as any),
      user: user,
    });

    if (!style) {
      throw new NotFoundException(
        `WritingStyle with ID ${normalizedId} not found.`,
      );
    }
    return style;
  }

  async remove(
    id: WritingStyleIdentifierLike,
    userId: UserIdentifierLike,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne(
      buildUserFilterFromInput(userId),
    );
    if (!user) {
      throw new Error('User not found');
    }

    const normalizedId = normalizeWritingStyleId(id);
    const whereClause = buildWritingStyleWhereClause(normalizedId);

    const style = await this.writingStyleRepository.findOne({
      ...(whereClause as any),
      user: user,
    });

    if (!style) {
      throw new NotFoundException(
        `WritingStyle with ID ${normalizedId} not found.`,
      );
    }

    await this.em.removeAndFlush(style);
    return {
      message: `WritingStyle with ID ${normalizedId} deleted successfully.`,
    };
  }
}
