/**
 * Supabase 설정 및 클라이언트 초기화
 * 
 * @description Supabase 프로젝트 설정과 JWT 검증을 위한 설정을 관리합니다.
 * Linear issue CHI-40 요구사항에 따라 구현되었습니다.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase 설정 인터페이스
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
}

/**
 * Supabase 설정 검증 에러 클래스
 */
export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

/**
 * Supabase 환경 변수 검증 및 설정 반환
 * @throws {SupabaseConfigError} 필수 환경 변수가 설정되지 않은 경우
 */
export function validateSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  const errors: string[] = [];

  if (!url || url.trim() === '') {
    errors.push('SUPABASE_URL is required');
  }

  if (!anonKey || anonKey.trim() === '') {
    errors.push('SUPABASE_ANON_KEY is required');
  }

  if (!serviceRoleKey || serviceRoleKey.trim() === '') {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  if (!jwtSecret || jwtSecret.trim() === '') {
    errors.push('SUPABASE_JWT_SECRET is required');
  }

  if (errors.length > 0) {
    throw new SupabaseConfigError(
      `Supabase configuration errors: ${errors.join(', ')}`
    );
  }

  // URL 형식 검증
  try {
    new URL(url!);
  } catch (error) {
    throw new SupabaseConfigError(
      'SUPABASE_URL must be a valid URL'
    );
  }

  return {
    url: url!,
    anonKey: anonKey!,
    serviceRoleKey: serviceRoleKey!,
    jwtSecret: jwtSecret!,
  };
}

/**
 * Supabase 클라이언트 생성 (익명 사용자용)
 */
export function createSupabaseClient(): SupabaseClient {
  const config = validateSupabaseConfig();
  
  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Supabase 클라이언트 생성 (관리자용)
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const config = validateSupabaseConfig();
  
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * JWT 시크릿 키 반환
 */
export function getJwtSecret(): string {
  const config = validateSupabaseConfig();
  return config.jwtSecret;
}

/**
 * 개발 환경에서 Supabase 설정 정보 출력
 */
export function logSupabaseConfig(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  try {
    const config = validateSupabaseConfig();
    console.log('🔐 Supabase Configuration:');
    console.log(`  - URL: ${config.url}`);
    console.log(`  - Anon Key: ${config.anonKey.substring(0, 10)}...`);
    console.log(`  - Service Role Key: ${config.serviceRoleKey.substring(0, 10)}...`);
    console.log(`  - JWT Secret: ${config.jwtSecret.substring(0, 10)}...`);
    console.log('✅ All Supabase environment variables are properly configured');
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      console.log('❌ Supabase configuration issues:');
      console.log(`  - ${error.message}`);
    }
  }
}

/**
 * Google OAuth 설정 검증
 */
export function validateGoogleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || clientId.trim() === '') {
    throw new SupabaseConfigError('GOOGLE_CLIENT_ID is required for Google OAuth');
  }

  if (!clientSecret || clientSecret.trim() === '') {
    throw new SupabaseConfigError('GOOGLE_CLIENT_SECRET is required for Google OAuth');
  }

  return {
    clientId,
    clientSecret,
  };
}

/**
 * 환경 변수 설정 가이드 출력
 */
export function printEnvironmentGuide(): void {
  console.log('\n📋 Required Environment Variables for Supabase OAuth:');
  console.log('  SUPABASE_URL=your-supabase-url');
  console.log('  SUPABASE_ANON_KEY=your-supabase-anon-key');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key');
  console.log('  SUPABASE_JWT_SECRET=your-supabase-jwt-secret');
  console.log('  GOOGLE_CLIENT_ID=your-google-client-id');
  console.log('  GOOGLE_CLIENT_SECRET=your-google-client-secret');
  console.log('\n📋 Chrome Extension Environment Variables:');
  console.log('  CHROME_EXTENSION_ID=your-chrome-extension-id');
  console.log('\n🔗 Get these values from:');
  console.log('  - Supabase Dashboard: https://app.supabase.com/');
  console.log('  - Google Cloud Console: https://console.cloud.google.com/');
  console.log('  - Chrome Extension ID: From chrome://extensions/ developer mode\n');
} 