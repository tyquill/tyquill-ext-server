import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VersioningType, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { logSupabaseConfig, printEnvironmentGuide } from './config/supabase.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 ValidationPipe 설정
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Supabase 설정 로깅
  logSupabaseConfig();

  const config = new DocumentBuilder()
    .setTitle('TyQuill Extension Server API')
    .setDescription('API documentation for TyQuill extension server with Supabase OAuth authentication')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .addTag('Authentication', 'Google OAuth authentication endpoints')
    .addTag('Articles', 'Article management endpoints')
    .addTag('Scraps', 'Scrap management endpoints')
    .addTag('Tags', 'Tag management endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Article Archive', 'Article archive management endpoints')
    .build();

  // api prefix 추가
  app.setGlobalPrefix('api');

  // versioning 설정
  app.enableVersioning({
    type: VersioningType.URI,
  });

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // CORS 설정 (크롬 익스텐션 포함)
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? [
          process.env.FRONTEND_URL,
          `chrome-extension://${process.env.CHROME_EXTENSION_ID}`,
        ].filter(Boolean)
      : [
          'http://localhost:3000', 
          'http://localhost:3001',
          `chrome-extension://${process.env.CHROME_EXTENSION_ID}`,
        ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`🔐 Authentication endpoints: http://localhost:${port}/api/auth`);
  
  // 환경 변수 설정이 잘못된 경우 가이드 출력
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { logSupabaseConfig } = await import('./config/supabase.config');
      logSupabaseConfig();
    } catch (error) {
      console.log('\n❌ Supabase configuration error detected!');
      printEnvironmentGuide();
    }
  }
}

bootstrap();
