import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, describe, it } from '@jest/globals';

@Module({})
class EmptyTestModule {}

describe('Application (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EmptyTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) returns 404 when no root controller is registered', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  afterAll(async () => {
    await app.close();
  });
});
