import { Test, TestingModule } from '@nestjs/testing';
import { ScrapsController } from './scraps.controller';
import { ScrapsService } from './scraps.service';

describe('ScrapsController', () => {
  let controller: ScrapsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScrapsController],
      providers: [ScrapsService],
    }).compile();

    controller = module.get<ScrapsController>(ScrapsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
