# Chrome Extension OAuth 인증 가이드

## 개요

이 가이드는 TyQuill 크롬 익스텐션에서 Supabase OAuth를 통한 Google 인증을 구현하는 방법을 설명합니다.

## 백엔드 API 엔드포인트

### 1. 크롬 익스텐션 OAuth 설정 조회
```
GET /api/auth/chrome-extension/config
```

크롬 익스텐션에서 Chrome Identity API 사용을 위한 OAuth 설정을 반환합니다.

**응답 예시:**
```json
{
  "clientId": "your-google-client-id",
  "scopes": ["openid", "email", "profile"],
  "redirectUri": "chrome-extension://your-extension-id/auth/callback"
}
```

### 2. 크롬 익스텐션 OAuth 인증
```
POST /api/auth/chrome-extension/auth
```

Chrome Identity API로 받은 토큰을 사용하여 JWT 토큰을 발급받습니다.

**요청 예시:**
```json
{
  "accessToken": "google-access-token",
  "provider": "google",
  "extensionId": "your-extension-id" // 선택적
}
```

**응답 예시:**
```json
{
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "fullName": "User Name",
    "avatarUrl": "https://...",
    "provider": "google"
  },
  "expiresAt": 1234567890
}
```

## 크롬 익스텐션 구현 예시

### 1. manifest.json 설정

```json
{
  "manifest_version": 3,
  "name": "TyQuill Extension",
  "version": "1.0",
  "permissions": [
    "identity",
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://your-backend-api.com/*"
  ],
  "oauth2": {
    "client_id": "your-google-client-id",
    "scopes": ["openid", "email", "profile"]
  }
}
```

### 2. 백그라운드 스크립트 (service-worker.js)

```javascript
// OAuth 설정 가져오기
async function getOAuthConfig() {
  try {
    const response = await fetch('https://your-backend-api.com/api/auth/chrome-extension/config');
    return await response.json();
  } catch (error) {
    console.error('Failed to get OAuth config:', error);
    throw error;
  }
}

// Google OAuth 인증 수행
async function authenticateWithGoogle() {
  try {
    // 1. 백엔드에서 OAuth 설정 가져오기
    const config = await getOAuthConfig();
    
    // 2. Chrome Identity API를 사용하여 토큰 받기
    const token = await chrome.identity.getAuthToken({
      interactive: true,
      scopes: config.scopes
    });
    
    // 3. 백엔드에 토큰 전송하여 JWT 받기
    const response = await fetch('https://your-backend-api.com/api/auth/chrome-extension/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: token,
        provider: 'google',
        extensionId: chrome.runtime.id
      })
    });
    
    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }
    
    const authData = await response.json();
    
    // 4. JWT 토큰 저장
    await chrome.storage.local.set({
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      user: authData.user,
      expiresAt: authData.expiresAt
    });
    
    return authData;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

// 저장된 토큰 확인
async function getStoredAuth() {
  try {
    const result = await chrome.storage.local.get([
      'accessToken',
      'refreshToken',
      'user',
      'expiresAt'
    ]);
    
    // 토큰 만료 확인
    if (result.expiresAt && Date.now() > result.expiresAt * 1000) {
      // 토큰 갱신 로직 수행
      return await refreshToken(result.refreshToken);
    }
    
    return result.accessToken ? result : null;
  } catch (error) {
    console.error('Failed to get stored auth:', error);
    return null;
  }
}

// 토큰 갱신
async function refreshToken(refreshToken) {
  try {
    const response = await fetch('https://your-backend-api.com/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken })
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const authData = await response.json();
    
    // 새로운 토큰 저장
    await chrome.storage.local.set({
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      user: authData.user,
      expiresAt: authData.expiresAt
    });
    
    return authData;
  } catch (error) {
    console.error('Token refresh error:', error);
    // 갱신 실패 시 재로그인 필요
    await chrome.storage.local.clear();
    throw error;
  }
}

// 로그아웃
async function logout() {
  try {
    const auth = await getStoredAuth();
    if (auth && auth.accessToken) {
      // 백엔드에 로그아웃 요청
      await fetch('https://your-backend-api.com/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Chrome Identity API 토큰 제거
    await chrome.identity.clearAllCachedAuthTokens();
    
    // 로컬 저장소 클리어
    await chrome.storage.local.clear();
    
  } catch (error) {
    console.error('Logout error:', error);
    // 에러가 발생해도 로컬 저장소는 클리어
    await chrome.storage.local.clear();
  }
}

// API 요청 헬퍼 함수
async function makeAuthenticatedRequest(url, options = {}) {
  try {
    const auth = await getStoredAuth();
    if (!auth || !auth.accessToken) {
      throw new Error('No authentication token available');
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 401) {
      // 토큰 만료 시 재로그인 필요
      await chrome.storage.local.clear();
      throw new Error('Authentication required');
    }
    
    return response;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'authenticate':
      authenticateWithGoogle()
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
      return true; // 비동기 응답을 위해 true 반환
      
    case 'getAuth':
      getStoredAuth()
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'logout':
      logout()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'apiRequest':
      makeAuthenticatedRequest(request.url, request.options)
        .then(response => response.json())
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
      return true;
  }
});
```

### 3. 컨텐츠 스크립트 또는 팝업에서 사용

```javascript
// 인증 상태 확인
chrome.runtime.sendMessage({ action: 'getAuth' }, (response) => {
  if (response && response.accessToken) {
    // 로그인 상태
    showUserInfo(response.user);
  } else {
    // 비로그인 상태
    showLoginButton();
  }
});

// 로그인 버튼 클릭 시
document.getElementById('loginButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
    if (response && response.accessToken) {
      // 로그인 성공
      showUserInfo(response.user);
    } else {
      // 로그인 실패
      console.error('Login failed:', response.error);
    }
  });
});

// 로그아웃 버튼 클릭 시
document.getElementById('logoutButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
    if (response.success) {
      // 로그아웃 성공
      showLoginButton();
    }
  });
});

// API 요청 예시
function fetchUserArticles() {
  chrome.runtime.sendMessage({
    action: 'apiRequest',
    url: 'https://your-backend-api.com/api/articles',
    options: { method: 'GET' }
  }, (response) => {
    if (response && !response.error) {
      displayArticles(response);
    } else {
      console.error('API request failed:', response.error);
    }
  });
}
```

## 환경 변수 설정

백엔드 `.env` 파일에 다음 환경 변수를 설정해야 합니다:

```env
# Supabase 설정
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# Google OAuth 설정
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# 크롬 익스텐션 설정
CHROME_EXTENSION_ID=your-chrome-extension-id
```

## 주의사항

1. **보안**: 크롬 익스텐션 ID는 공개 정보이므로 보안에 민감한 정보를 포함하지 않도록 주의하세요.

2. **CORS**: 백엔드에서 크롬 익스텐션 origin을 CORS에 추가해야 합니다.

3. **토큰 관리**: 토큰은 chrome.storage.local에 저장되며, 익스텐션 업데이트 시에도 유지됩니다.

4. **에러 처리**: 네트워크 오류, 인증 실패 등에 대한 적절한 에러 처리를 구현해야 합니다.

5. **토큰 갱신**: JWT 토큰 만료 시 자동으로 갱신되도록 구현해야 합니다.

## 테스트

1. 크롬 익스텐션 로드 후 개발자 도구에서 네트워크 탭 확인
2. 백엔드 API 로그 확인
3. 인증 플로우 테스트
4. 토큰 갱신 테스트
5. 로그아웃 테스트

이 가이드를 따라 구현하면 크롬 익스텐션과 백엔드 간의 안전한 OAuth 인증 시스템을 구축할 수 있습니다. 