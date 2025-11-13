import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RepurposeController } from './repurpose.controller';
import { RepurposeService } from './services/repurpose.service';
import {
  RepurposedContent,
  RepurposingJob,
  FormatTemplate,
  FormatRule,
  ExportHistory,
} from './entities';
import { Article } from '../articles/entities/article.entity';
import { User } from '../users/entities/user.entity';
import { RepurposeWorkflowService } from '../ai-workflows/services/repurpose-workflow.service';
import { VertexAiFactory } from '../ai-workflows/services/vertex-ai.factory';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      RepurposedContent,
      RepurposingJob,
      FormatTemplate,
      FormatRule,
      ExportHistory,
      Article,
      User,
    ]),
  ],
  controllers: [RepurposeController],
  providers: [
    RepurposeService,
    RepurposeWorkflowService,
    VertexAiFactory,
    {
      provide: 'REPURPOSE_SERVICE_INIT',
      useFactory: (
        repurposeService: RepurposeService,
        workflowService: RepurposeWorkflowService,
      ) => {
        repurposeService.setRepurposeWorkflowService(workflowService);
        return true;
      },
      inject: [RepurposeService, RepurposeWorkflowService],
    },
  ],
  exports: [RepurposeService],
})
export class RepurposeModule {}
