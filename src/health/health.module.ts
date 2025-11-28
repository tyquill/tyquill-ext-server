import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { HealthController } from '../api/health/health.controller';

@Module({
  imports: [TerminusModule, MikroOrmModule],
  controllers: [HealthController],
})
export class HealthModule {}
