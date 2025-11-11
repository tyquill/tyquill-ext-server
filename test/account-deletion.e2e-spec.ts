import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { EntityManager } from '@mikro-orm/postgresql';

/**
 * E2E 테스트: 계정 삭제 기능
 *
 * 테스트 시나리오:
 * 1. 사용자 본인 계정 삭제
 * 2. 관리자가 사용자 계정 삭제
 * 3. 잘못된 확인 문구로 삭제 시도 (실패)
 * 4. 관리자가 다른 관리자 계정 삭제 시도 (실패)
 */
describe('Account Deletion (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let em: EntityManager;
  let testUserToken: string;
  let testUserId: string;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    usersService = moduleFixture.get<UsersService>(UsersService);
    em = moduleFixture.get<EntityManager>(EntityManager);

    // TODO: 테스트 사용자 및 관리자 생성
    // testUserToken = await createTestUserWithToken();
    // adminToken = await createTestAdminWithToken();
  });

  afterAll(async () => {
    // TODO: 테스트 데이터 정리
    await app.close();
  });

  describe('DELETE /api/v1/users/me', () => {
    it('should delete user account with valid confirmation', async () => {
      // TODO: 실제 테스트 사용자 생성 및 인증 토큰 획득 필요
      // const response = await request(app.getHttpServer())
      //   .delete('/api/v1/users/me')
      //   .set('Authorization', `Bearer ${testUserToken}`)
      //   .send({ confirmation: 'DELETE MY ACCOUNT' })
      //   .expect(HttpStatus.NO_CONTENT);

      // TODO: 사용자 및 관련 데이터가 삭제되었는지 확인
      // const user = await usersService.findOne(testUserId);
      // expect(user).toBeNull();

      // TODO: 감사 로그가 생성되었는지 확인
      // const auditLog = await em.findOne(AccountDeletionAudit, { userId: testUserId });
      // expect(auditLog).toBeDefined();
      // expect(auditLog.deletedBy).toBe('self');
    });

    it('should reject deletion without proper confirmation', async () => {
      // TODO: 실제 테스트 사용자 생성 및 인증 토큰 획득 필요
      // const response = await request(app.getHttpServer())
      //   .delete('/api/v1/users/me')
      //   .set('Authorization', `Bearer ${testUserToken}`)
      //   .send({ confirmation: 'WRONG PHRASE' })
      //   .expect(HttpStatus.BAD_REQUEST);

      // expect(response.body.message).toContain('Invalid confirmation');

      // TODO: 사용자가 여전히 존재하는지 확인
      // const user = await usersService.findOne(testUserId);
      // expect(user).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/users/me')
        .send({ confirmation: 'DELETE MY ACCOUNT' })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('DELETE /api/v1/admin/users/:userId', () => {
    it('should allow admin to delete user account', async () => {
      // TODO: 실제 테스트 사용자 및 관리자 생성 필요
      // const response = await request(app.getHttpServer())
      //   .delete(`/api/v1/admin/users/${testUserId}`)
      //   .set('Authorization', `Bearer ${adminToken}`)
      //   .expect(HttpStatus.NO_CONTENT);

      // TODO: 사용자가 삭제되었는지 확인
      // const user = await usersService.findOne(testUserId);
      // expect(user).toBeNull();

      // TODO: 감사 로그 확인
      // const auditLog = await em.findOne(AccountDeletionAudit, { userId: testUserId });
      // expect(auditLog).toBeDefined();
      // expect(auditLog.deletedBy).toBe('admin');
      // expect(auditLog.adminId).toBe(adminUserId);
    });

    it('should prevent admin from deleting other admin accounts', async () => {
      // TODO: 두 개의 관리자 계정 생성 필요
      // const secondAdminId = await createTestAdmin();

      // const response = await request(app.getHttpServer())
      //   .delete(`/api/v1/admin/users/${secondAdminId}`)
      //   .set('Authorization', `Bearer ${adminToken}`)
      //   .expect(HttpStatus.FORBIDDEN);

      // expect(response.body.message).toContain('Cannot delete admin accounts');

      // TODO: 관리자 계정이 여전히 존재하는지 확인
      // const admin = await usersService.findOne(secondAdminId);
      // expect(admin).toBeDefined();
    });

    it('should require ADMIN role', async () => {
      // TODO: 일반 사용자 토큰으로 시도
      // const response = await request(app.getHttpServer())
      //   .delete(`/api/v1/admin/users/${testUserId}`)
      //   .set('Authorization', `Bearer ${testUserToken}`)
      //   .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 404 for non-existent user', async () => {
      // TODO: 관리자 토큰으로 존재하지 않는 사용자 삭제 시도
      // const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
      // const response = await request(app.getHttpServer())
      //   .delete(`/api/v1/admin/users/${nonExistentUserId}`)
      //   .set('Authorization', `Bearer ${adminToken}`)
      //   .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('Data Cascade Deletion', () => {
    it('should delete all user-related data', async () => {
      // TODO: 테스트 사용자 생성 및 관련 데이터 (scraps, articles, tags 등) 생성
      // const userId = await createTestUserWithData();

      // TODO: 계정 삭제
      // await request(app.getHttpServer())
      //   .delete('/api/v1/users/me')
      //   .set('Authorization', `Bearer ${testUserToken}`)
      //   .send({ confirmation: 'DELETE MY ACCOUNT' })
      //   .expect(HttpStatus.NO_CONTENT);

      // TODO: 모든 관련 데이터가 삭제되었는지 확인
      // const scraps = await em.find(Scrap, { user: { userId } });
      // expect(scraps).toHaveLength(0);

      // const articles = await em.find(Article, { user: { userId } });
      // expect(articles).toHaveLength(0);

      // const tags = await em.find(Tag, { user: { userId } });
      // expect(tags).toHaveLength(0);

      // TODO: 추가 entity 확인
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback if deletion fails midway', async () => {
      // TODO: 삭제 도중 실패하도록 mock 설정
      // 예: S3 삭제는 실패해도 DB 트랜잭션은 커밋되어야 함
      // 하지만 DB 삭제가 실패하면 모든 변경사항이 롤백되어야 함
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log entry for self-deletion', async () => {
      // TODO: 감사 로그 테스트
    });

    it('should create audit log entry for admin deletion', async () => {
      // TODO: 감사 로그 테스트
    });
  });
});
