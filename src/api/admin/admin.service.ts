import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { User } from '../../users/entities/user.entity';
import { Article } from '../../articles/entities/article.entity';

@Injectable()
export class AdminService {
  constructor(private readonly em: EntityManager) {}

  /**
   * 유저 대시보드 - 사용자별 스크랩 수, 생성한 아티클 수, 미활동일 수
   */
  async getUserDashboard() {
    const query = `
      SELECT 
        u.user_id as "userId",
        u.email,
        u.name,
        COUNT(DISTINCT s.scrap_id) as "scrapCount",
        COUNT(DISTINCT a.article_id) as "articleCount",
        COALESCE(
          EXTRACT(DAY FROM NOW() - MAX(GREATEST(s.updated_at, a.updated_at))),
          EXTRACT(DAY FROM NOW() - u.created_at)
        ) as "inactiveDays"
      FROM users u
      LEFT JOIN scraps s ON u.user_id = s.user_id AND s.is_deleted = false
      LEFT JOIN articles a ON u.user_id = a.user_id AND a.is_deleted = false
      GROUP BY u.user_id, u.email, u.name, u.created_at
      ORDER BY u.user_id
    `;

    const result = await this.em.getConnection().execute(query);
    return result.map((row) => ({
      userId: row.userId,
      email: row.email,
      name: row.name,
      scrapCount: parseInt(row.scrapCount) || 0,
      articleCount: parseInt(row.articleCount) || 0,
      inactiveDays: parseInt(row.inactiveDays) || 0,
    }));
  }

  /**
   * 특정 유저의 상세 정보 조회
   */
  async getUserDetail(userId: number) {
    const user = await this.em.findOne(
      User,
      { userId: userId },
      {
        populate: ['scraps', 'tags'],
      },
    );

    if (!user) {
      throw new Error('User not found');
    }

    const articles = await this.em.find(
      Article,
      {
        user: { userId: userId },
        isDeleted: false,
      },
      {
        populate: ['archives'],
      },
    );

    return {
      userId: user.userId,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      scrapCount: user.scraps.length,
      articleCount: articles.length,
      scraps: user.scraps.getItems().map((scrap) => ({
        scrapId: scrap.scrapId,
        title: scrap.title,
        url: scrap.url,
        createdAt: scrap.createdAt.toISOString(),
      })),
      articles: articles.map((article) => ({
        articleId: article.articleId,
        topic: article.topic,
        keyInsight: article.keyInsight,
        generationStatus: article.generationStatus,
        createdAt: article.createdAt.toISOString(),
      })),
    };
  }

  /**
   * 아티클 생성 결과 - 각 아티클 생성 요청별 생성결과
   */
  async getArticleGenerationResults() {
    const query = `
      SELECT 
        u.user_id as "userId",
        u.email,
        u.name,
        a.article_id as "articleId",
        a.topic,
        a.key_insight as "keyInsight",
        a.generation_params as "generationParams",
        a.generation_status as "generationStatus",
        a.created_at as "createdAt",
        COALESCE(
          (
            SELECT array_agg(s.scrap_id)
            FROM scraps s 
            WHERE s.article_id = a.article_id AND s.is_deleted = false
          ), 
          ARRAY[]::integer[]
        ) as "scrapIds"
      FROM articles a
      JOIN users u ON a.user_id = u.user_id
      WHERE a.is_deleted = false
      ORDER BY a.created_at DESC
    `;

    const result = await this.em.getConnection().execute(query);
    return result.map((row) => ({
      userId: row.userId,
      email: row.email,
      name: row.name,
      articleId: row.articleId,
      topic: row.topic,
      keyInsight: row.keyInsight,
      scrapIds: row.scrapIds || [],
      generationParams: row.generationParams
        ? JSON.parse(row.generationParams)
        : null,
      generationStatus: row.generationStatus,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  /**
   * 활동 내역 - 모든 유저들의 활동 내역
   */
  async getActivities(userId?: number) {
    const userFilter = userId ? `AND u.user_id = ${userId}` : '';

    const query = `
      SELECT 
        'scrap' as "activityType",
        u.user_id as "userId",
        u.email,
        u.name,
        s.scrap_id as "resourceId",
        s.title as "resourceTitle",
        s.created_at as "activityDate"
      FROM scraps s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.is_deleted = false ${userFilter}
      
      UNION ALL
      
      SELECT 
        'article' as "activityType",
        u.user_id as "userId",
        u.email,
        u.name,
        a.article_id as "resourceId",
        a.topic as "resourceTitle",
        a.created_at as "activityDate"
      FROM articles a
      JOIN users u ON a.user_id = u.user_id
      WHERE a.is_deleted = false ${userFilter}
      
      ORDER BY "activityDate" DESC
      LIMIT 1000
    `;

    const result = await this.em.getConnection().execute(query);
    return result.map((row) => ({
      activityType: row.activityType,
      userId: row.userId,
      email: row.email,
      name: row.name,
      resourceId: row.resourceId,
      resourceTitle: row.resourceTitle,
      activityDate: row.activityDate,
    }));
  }

  /**
   * 특정 아티클 생성 요청의 상세 결과
   */
  async getArticleDetail(userId: number, articleId: number) {
    const article = await this.em.findOne(
      Article,
      {
        articleId,
        user: { userId: userId },
        isDeleted: false,
      },
      {
        populate: ['user', 'archives', 'articleScraps.scrap'],
      },
    );

    if (!article) {
      throw new Error('Article not found');
    }

    return {
      userId: article.user.userId,
      email: article.user.email,
      name: article.user.name,
      articleId: article.articleId,
      topic: article.topic,
      keyInsight: article.keyInsight,
      generationParams: article.generationParams
        ? JSON.parse(article.generationParams)
        : null,
      generationStatus: article.generationStatus,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      scraps: article.articleScraps.getItems().map((as) => ({
        scrapId: as.scrap.scrapId,
        title: as.scrap.title,
        url: as.scrap.url,
        content: as.scrap.content,
        createdAt: as.scrap.createdAt.toISOString(),
      })),
      archives: article.archives
        .getItems()
        .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))
        .map((archive) => ({
          articleArchiveId: archive.articleArchiveId,
          versionNumber:
            archive.versionNumber === undefined ? null : archive.versionNumber,
          title: archive.title,
          content: archive.content,
          createdAt: archive.createdAt.toISOString(),
        })),
    };
  }
}
