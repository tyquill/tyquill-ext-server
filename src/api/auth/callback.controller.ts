/**
 * OAuth 콜백 컨트롤러
 *
 * @description Chrome Extension에서 OAuth 콜백을 처리하는 컨트롤러
 * Google OAuth 인증 후 Extension으로 결과를 전달합니다.
 */

import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('OAuth Callback')
@Controller('auth')
export class CallbackController {
  private readonly logger = new Logger(CallbackController.name);

  /**
   * OAuth 콜백 처리 - Chrome Extension으로 결과 전달
   */
  @Get('callback')
  @ApiOperation({
    summary: 'OAuth 콜백 처리',
    description: 'Google OAuth 인증 후 Chrome Extension으로 결과를 전달합니다.',
  })
  @ApiQuery({
    name: 'code',
    description: '인증 코드',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'error',
    description: '인증 에러',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'state',
    description: '상태 값',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '콜백 페이지 반환',
    schema: {
      type: 'string',
      example: 'HTML 페이지',
    },
  })
  async handleCallback(
    @Query('code') code?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
    @Query('state') state?: string,
    @Res() res?: Response,
  ) {
    this.logger.log('OAuth callback received', {
      hasCode: !!code,
      error: error || 'none',
      state: state || 'none',
      code: code ? code.substring(0, 10) + '...' : 'none', // 보안을 위해 일부만 로그
    });

    // Chrome Extension에서 감지할 수 있도록 HTML 페이지 반환
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>OAuth 인증 완료</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 400px;
        }
        .status {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        .message {
            font-size: 16px;
            opacity: 0.9;
            line-height: 1.5;
            margin-bottom: 20px;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            color: #ff4444;
            background: rgba(255, 68, 68, 0.1);
            padding: 16px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 14px;
        }
        .success {
            color: #44ff44;
            background: rgba(68, 255, 68, 0.1);
            padding: 16px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        ${
          error
            ? `
            <div class="status">❌ 인증 실패</div>
            <div class="message">인증 과정에서 오류가 발생했습니다.</div>
            <div class="error">
                오류: ${error}
                ${errorDescription ? `<br>상세: ${errorDescription}` : ''}
            </div>
        `
            : code
              ? `
            <div class="status">✅ 인증 완료</div>
            <div class="message">성공적으로 인증되었습니다.<br>잠시 후 자동으로 창이 닫힙니다.</div>
            <div class="success">Tyquill Extension으로 돌아가는 중...</div>
        `
              : `
            <div class="spinner"></div>
            <div class="status">🔄 인증 처리 중</div>
            <div class="message">잠시만 기다려주세요...</div>
        `
        }
    </div>

    <script>
        // Extension에서 감지할 수 있도록 URL 파라미터 유지
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        
        if (code) {
            // 성공시 3초 후 자동으로 창 닫기
            setTimeout(() => {
                window.close();
            }, 3000);
        }
        
        if (error) {
            // 에러시 5초 후 자동으로 창 닫기
            setTimeout(() => {
                window.close();
            }, 5000);
        }

        // 부모 창에 메시지 전송 (필요한 경우)
        if (window.opener) {
            window.opener.postMessage({
                type: 'OAUTH_CALLBACK',
                code: code,
                error: error,
                errorDescription: urlParams.get('error_description')
            }, '*');
        }
    </script>
</body>
</html>
    `;

    res?.setHeader('Content-Type', 'text/html');
    res?.send(html);
  }
}
