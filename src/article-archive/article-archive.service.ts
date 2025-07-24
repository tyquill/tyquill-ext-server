import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleArchiveDto } from '../api/article-archive/dto/create-article-archive.dto';
import { UpdateArticleArchiveDto } from '../api/article-archive/dto/update-article-archive.dto';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { ArticleArchive } from './entities/article-archive.entity';
import { Article } from '../articles/entities/article.entity';
import { InjectRepository } from '@mikro-orm/nestjs';

@Injectable()
export class ArticleArchiveService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(ArticleArchive)
    private readonly articleArchiveRepository: EntityRepository<ArticleArchive>,
    @InjectRepository(Article)
    private readonly articleRepository: EntityRepository<Article>,
  ) {}

  async create(createArticleArchiveDto: CreateArticleArchiveDto) {
    const articleArchive = new ArticleArchive();
    Object.assign(articleArchive, createArticleArchiveDto);
    await this.em.persistAndFlush(articleArchive);
    return articleArchive;
  }

  /**
   * 특정 아티클의 새로운 버전을 생성합니다
   */
  async createVersion(articleId: number, title: string, content: string): Promise<ArticleArchive> {
    const article = await this.articleRepository.findOne({ articleId }, {
      filters: { isDeleted: false }
    });
    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다');
    }

    // 현재 최대 버전 번호 조회
    const maxVersionArchive = await this.articleArchiveRepository.findOne(
      { article },
      { orderBy: { versionNumber: 'DESC' }, filters: { isDeleted: false } }
    );

    const newVersionNumber = maxVersionArchive ? (maxVersionArchive.versionNumber || 0) + 1 : 1;

    const archive = new ArticleArchive();
    archive.title = title;
    archive.content = content;
    archive.versionNumber = newVersionNumber;
    archive.article = article;

    await this.em.persistAndFlush(archive);
    return archive;
  }

  /**
   * 특정 아티클의 모든 버전을 조회합니다
   */
  async findVersionsByArticle(articleId: number): Promise<ArticleArchive[]> {
    const article = await this.articleRepository.findOne({ articleId });
    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다');
    }

    return await this.articleArchiveRepository.find(
      { article },
      { orderBy: { versionNumber: 'DESC' }, filters: { isDeleted: false } }
    );
  }

  /**
   * 특정 버전의 아카이브를 조회합니다
   */
  async findSpecificVersion(articleId: number, versionNumber: number): Promise<ArticleArchive | null> {
    const article = await this.articleRepository.findOne({ articleId });
    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다');
    }

    return await this.articleArchiveRepository.findOne({
      article,
      versionNumber,
      isDeleted: false
    });
  }

  /**
   * 최신 버전을 조회합니다
   */
  async findLatestVersion(articleId: number): Promise<ArticleArchive | null> {
    const article = await this.articleRepository.findOne({ articleId });
    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다');
    }

    return await this.articleArchiveRepository.findOne(
      { article },
      { orderBy: { versionNumber: 'DESC' }, filters: { isDeleted: false } }
    );
  }

  /**
   * 버전 간 비교를 위한 데이터를 반환합니다
   */
  async compareVersions(articleId: number, version1: number, version2: number): Promise<{
    version1: ArticleArchive | null;
    version2: ArticleArchive | null;
  }> {
    const [v1, v2] = await Promise.all([
      this.findSpecificVersion(articleId, version1),
      this.findSpecificVersion(articleId, version2),
    ]);

    return {
      version1: v1,
      version2: v2,
    };
  }

  async findAll() {
    const articleArchives = await this.articleArchiveRepository.findAll({
      populate: ['article'],
      filters: { isDeleted: false }
    });
    return articleArchives;
  }

  async findOne(id: number) {
    const articleArchive = await this.articleArchiveRepository.findOne(
      { articleArchiveId: id },
      { populate: ['article'], filters: { isDeleted: false } }
    );
    if (!articleArchive) {
      return null;
    }
    return articleArchive;
  }

  async update(id: number, updateArticleArchiveDto: UpdateArticleArchiveDto) {
    const articleArchive = await this.articleArchiveRepository.findOne({ articleArchiveId: id, isDeleted: false });
    if (!articleArchive) {
      return null;
    }
    Object.assign(articleArchive, updateArticleArchiveDto);
    await this.em.persistAndFlush(articleArchive);
    return articleArchive;
  }

  async remove(id: number) {
    const articleArchive = await this.articleArchiveRepository.findOne({ articleArchiveId: id, isDeleted: false });
    if (articleArchive) {
      articleArchive.isDeleted = true;
      await this.em.persistAndFlush(articleArchive);
    }
  }
}
