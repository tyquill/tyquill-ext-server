// tracing.ts - Langfuse OpenTelemetry 초기화
// This file must be imported before any other application code to ensure tracing is enabled

async function initTracing() {
  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { LangfuseSpanProcessor } = await import('@langfuse/otel');

    // Langfuse 환경 변수 확인
    const langfuseSecretKey = process.env.LANGFUSE_SECRET_KEY;
    const langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const langfuseBaseUrl =
      process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

    if (!langfuseSecretKey || !langfusePublicKey) {
      console.warn(
        '⚠️  Warning: Langfuse credentials not found. Tracing will be disabled.',
      );
      console.warn(
        'Please set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY in your .env file',
      );
      return;
    }

    // LangfuseSpanProcessor 초기화
    const langfuseSpanProcessor = new LangfuseSpanProcessor({
      publicKey: langfusePublicKey,
      secretKey: langfuseSecretKey,
      baseUrl: langfuseBaseUrl,
      environment: process.env.NODE_ENV || 'development',
    });

    // OpenTelemetry SDK 초기화
    const sdk = new NodeSDK({
      spanProcessors: [langfuseSpanProcessor],
    });

    sdk.start();

    console.log('✅ Langfuse tracing initialized successfully');
    console.log(`   - Base URL: ${langfuseBaseUrl}`);
    console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      try {
        await sdk.shutdown();
        console.log('🔒 Langfuse tracing shutdown completed');
      } catch (error) {
        console.error('Error shutting down Langfuse tracing:', error);
      }
    });
  } catch (error) {
    console.error('❌ Error initializing Langfuse tracing:', error);
    console.error('Tracing will be disabled. Application will continue without tracing.');
  }
}

initTracing();
