## 1. RESTful API 구현 상태

| Endpoint | Lambda Handler | Status | Notes |
| --- | --- | --- | --- |
| GET /api/v1/briefing | briefing-lambda.handler | ✅ Done | Controller 재사용 |
| GET /api/v1/weather | weather-lambda.handler | ✅ Done |  |
| GET /api/v1/air | air-lambda.handler | ✅ Done |  |
| GET /api/v1/traffic/city | trafficCity-lambda.handler | ✅ Done |  |
| GET /api/v1/traffic/car | trafficCity-lambda.handler | ✅ Done |  |
| GET /api/v1/traffic/transit | trafficCity-lambda.handler | ✅ Done |  |
| GET /api/v1/traffic/expressway | trafficExpressway-lambda.handler | ✅ Done |  |
| GET /api/v1/traffic/route-tollgates | trafficExpressway-lambda.handler | ✅ Done |  |
| GET /api/v1/profile | profile-lambda.handler | ✅ Done | DB + JSON fallback |
| POST /api/v1/profile | profile-lambda.handler | ✅ Done |  |
| GET /api/v1/settings | settings-lambda.handler | ✅ Done |  |
| POST /api/v1/settings | settings-lambda.handler | ✅ Done |  |
| GET /api/v1/healthz | health-lambda.handler | ✅ Done |  |
| GET /api/v1/health/geocode | health-lambda.handler | ✅ Done |  |

## 2. DBMS / NoSQL 사용
- RDS-style SQL DB: ✅ 인터페이스/레포지토리 구현, `DB_ENABLED` 환경 변수로 활성화
- Local JSON fallback: ✅ `DB_ENABLED=0` 시 `.data/store.json` 사용
- NoSQL (MongoDB/DynamoDB): ⚠️ 인터페이스 준비, 구현은 TODO

## 3. 최종 시스템 설계 요약 (보고서용)
- 프론트엔드: React/Vite SPA (S3 + CloudFront 배포 가정)
- 백엔드: Amazon API Gateway + AWS Lambda (도메인별 함수, controller 재사용)
- 데이터베이스: Amazon RDS (Aurora Serverless, MySQL/PostgreSQL) 가정, 개발/로컬은 JSON fallback
- 캐시/로그: 향후 DynamoDB/MongoDB 연동을 위한 확장 포인트 마련 (TODO)
