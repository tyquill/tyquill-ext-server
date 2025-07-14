import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VersioningType, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// Removed Supabase config import

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 ValidationPipe 설정
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // JWT 인증 설정 확인
  console.log('🔐 JWT authentication enabled');

  const config = new DocumentBuilder()
    .setTitle('TyQuill Extension Server API')
    .setDescription('API documentation for TyQuill extension server with JWT authentication')
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
  
  // JWT 설정 확인
  if (process.env.NODE_ENV !== 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'your-fallback-secret-key') {
      console.log('\n⚠️  Warning: Using fallback JWT secret. Please set JWT_SECRET in production!');
    } else {
      console.log('✅ JWT secret configured properly');
    }
  }
}

bootstrap();
