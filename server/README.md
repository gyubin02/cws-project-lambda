# Outing Briefing Service - Backend

외출 브리핑 서비스의 백엔드 API 서버입니다. 날씨, 대기질, 교통 정보를 통합하여 제공합니다.

## 🚀 기능

- **통합 브리핑**: 날씨, 대기질, 교통 정보를 하나의 API로 제공
- **실시간 데이터**: 기상청, 한국환경공단, ITS/EX 교통 API 연동
- **캐싱**: NodeCache를 활용한 성능 최적화
- **에러 처리**: 견고한 에러 처리 및 재시도 로직
- **로깅**: Pino를 활용한 구조화된 로깅
- **개발 모드**: API 키 없이도 모크 데이터로 서버 실행 가능
- **Request ID**: 모든 요청에 고유 ID 자동 생성 및 추적
- **Partial Failure Tolerance**: 일부 서비스 실패 시에도 다른 데이터 제공
- **Graceful Degradation**: API 키 누락 시 명확한 상태 표시

## 📋 요구사항

- Node.js 20+
- pnpm (권장) 또는 npm
- 공공 API 키 (기상청, 한국환경공단, 고속도로공단)

## 🛠️ 설치 및 실행

### 1. 의존성 설치

```bash
cd server
pnpm install
```

### 2. 환경변수 설정

```bash
cp env.example .env
```

`.env` 파일을 편집하여 필요한 API 키를 설정하세요:

```env
# 공공 API 키
KMA_SERVICE_KEY=your_kma_service_key_here
AIRKOREA_SERVICE_KEY=your_airkorea_service_key_here
EXPRESSWAY_SERVICE_KEY=your_expressway_service_key_here

# 개발/모크 모드 (API 키 없이도 실행 가능)
MOCK=true
```

### 3. 개발 서버 실행

```bash
pnpm dev
```

### 4. 프로덕션 빌드 및 실행

```bash
pnpm build
pnpm start
```

## 📚 API 엔드포인트

### 통합 브리핑
```
GET /api/v1/briefing?from=37.5665,126.9780&to=37.5172,127.0473&mode=car
```

### 개별 서비스
- 날씨: `GET /api/v1/weather?lat=37.5665&lon=126.9780`
- 대기질: `GET /api/v1/air?district=강남구`
- 교통: `GET /api/v1/traffic?from=37.5665,126.9780&to=37.5172,127.0473`
- 헬스체크: `GET /api/v1/healthz`

## 🔧 설정

### 환경변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `PORT` | 서버 포트 | 8787 |
| `NODE_ENV` | 실행 환경 | development |
| `CORS_ORIGINS` | 허용된 CORS 오리진 | http://localhost:3000 |
| `KMA_SERVICE_KEY` | 기상청 API 키 | - |
| `AIRKOREA_SERVICE_KEY` | 한국환경공단 API 키 | - |
| `EXPRESSWAY_SERVICE_KEY` | 고속도로공단 API 키 | - |
| `HTTP_TIMEOUT_MS` | HTTP 타임아웃 (ms) | 6000 |
| `CACHE_TTL_WEATHER_SEC` | 날씨 캐시 TTL (초) | 300 |
| `CACHE_TTL_AIR_SEC` | 대기질 캐시 TTL (초) | 300 |
| `CACHE_TTL_TRAFFIC_SEC` | 교통 캐시 TTL (초) | 300 |
| `MOCK` | 모크 모드 활성화 | false |

### 캐시 설정

서버는 NodeCache를 사용하여 성능을 최적화합니다:

- **날씨 데이터**: 5분 캐시
- **대기질 데이터**: 5분 캐시  
- **교통 데이터**: 5분 캐시

## 📊 모니터링

### 로깅

Pino를 사용한 구조화된 JSON 로깅:

```json
{
  "level": "info",
  "time": "2024-01-15T09:00:00.000Z",
  "reqId": "req-1234567890-abcdef",
  "method": "GET",
  "url": "/api/v1/briefing",
  "status": 200,
  "duration": 150
}
```

### 헬스체크

```bash
curl http://localhost:8787/api/v1/healthz
```

응답 예시:
```json
{
  "ok": true,
  "time": "2024-01-15T09:00:00Z",
  "uptime": 3600,
  "memory": {
    "rss": 50000000,
    "heapTotal": 20000000,
    "heapUsed": 15000000
  },
  "version": "1.0.0",
  "environment": "development"
}
```

## 🚀 배포

### 로컬 배포

```bash
# 빌드
pnpm build

# 실행
pnpm start
```

### EC2 배포

1. EC2 인스턴스 생성 (Ubuntu 22.04)
2. Node.js 20+ 설치
3. 애플리케이션 배포
4. PM2로 프로세스 관리
5. Nginx 리버스 프록시 설정 (선택사항)

```bash
# PM2 설치
npm install -g pm2

# 애플리케이션 시작
pm2 start dist/server.js --name "briefing-api"

# 자동 재시작 설정
pm2 startup
pm2 save
```

## 🧪 테스트

### API 테스트

```bash
# 브리핑 조회 (새로운 파라미터 형식)
curl "http://localhost:8787/api/v1/briefing?lat=37.5665&lon=126.9780&from=강남역&to=서울역"

# 헬스체크
curl "http://localhost:8787/api/v1/healthz"
```

### 개발/모크 모드

API 키 없이도 서버를 실행하여 개발할 수 있습니다:

```bash
# 모크 모드로 실행
MOCK=true pnpm dev

# 또는 .env 파일에 설정
echo "MOCK=true" >> .env
pnpm dev
```

모크 모드에서는 실제 API 대신 샘플 데이터를 반환합니다.

### 테스트 실행

```bash
# 단위 테스트 실행
pnpm test

# 테스트 감시 모드
pnpm test:watch
```

## 📝 API 문서

OpenAPI 3.1 스펙이 `openapi.yaml` 파일에 정의되어 있습니다.

## 🔍 문제 해결

### 일반적인 문제

1. **API 키 오류**: 환경변수에 올바른 API 키가 설정되었는지 확인
2. **CORS 오류**: `CORS_ORIGINS` 환경변수에 프론트엔드 도메인 추가
3. **타임아웃**: `HTTP_TIMEOUT_MS` 값을 늘려보세요
4. **메모리 부족**: Node.js 힙 메모리 제한 증가

### 로그 확인

```bash
# 개발 환경에서 로그 확인
pnpm dev

# 프로덕션 환경에서 로그 확인
pm2 logs briefing-api
```

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

MIT License
