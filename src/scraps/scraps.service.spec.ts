import { Test, TestingModule } from '@nestjs/testing';
import { ScrapsService } from './scraps.service';

describe('ScrapsService', () => {
  let service: ScrapsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScrapsService],
    }).compile();

    service = module.get<ScrapsService>(ScrapsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
