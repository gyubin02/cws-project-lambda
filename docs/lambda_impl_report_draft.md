# 외출 브리핑 Lambda 전환 구현 보고서 (초안)

## 1) 시스템 설계 (요약)
- 기존 구조: Express + TypeScript API (`server/src/app.ts`), Vite/React SPA 클라이언트, 파일 기반 스토어(`.data/store.json`).
- 목표 아키텍처: Amazon API Gateway + AWS Lambda + RDS(Aurora Serverless) 중심의 무상태 마이크로서비스.
- 라우트 그룹 단위 Lambda: briefing/weather/air/traffic/profile/settings/health로 분리, API Gateway에서 경로별로 매핑.
- 데이터 계층: RDS(Aurora MySQL/PostgreSQL) 우선, 로컬/시험용으로 JSON fallback 유지. NoSQL(DynamoDB/MongoDB) 확장 포인트 확보.

## 2) 구현 결과 (소스 코드 설명)
- `server/src/controllers/*`: Express와 Lambda가 공유하는 컨트롤러. 입력 검증/서비스 호출/응답 생성의 단일 진입점.
  - 예: `briefing.controller.ts`, `traffic.controller.ts`, `health.controller.ts` 등.
- `server/src/lambda/*`: API Gateway Proxy용 Lambda 핸들러. CORS 헤더 포함, `controllers` 결과를 HTTP 응답으로 변환.
  - `lambda/http.ts`: 공통 CORS/에러 래퍼, JSON Body 파서.
- `server/src/lib/db.ts`: RDS 연결 설정(환경 변수 기반) + MySQL 풀 초기화. `DB_ENABLED=0` 시 비활성화하여 JSON fallback으로 전환.
- `server/src/repositories/*`: RDS 저장소 + JSON fallback 구현.
  - `profile.repository.ts`, `settings.repository.ts`가 `store.ts` 의존성을 대체.
- 서비스 계층/응답 스키마: 기존 서비스(`services/*.ts`)와 어댑터(`adapters/*.ts`)는 그대로 재사용하여 프론트엔드/응답 구조 호환 유지.
- 빌드 스크립트: `pnpm -C server build:lambda` → `dist/lambda/*.js` 산출, API Gateway에 `<file>.handler` 등록.

## 3) 작동 서비스 / 미완료 항목
- **완료 (REST + Lambda)**: briefing, weather, air, traffic(city/car/transit/expressway/route-tollgates), profile, settings, healthz/geocode.
- **DBMS**: 레포지토리/쿼리/환경변수 정의 완료. 실제 RDS 접속은 AWS 자격 증명/네트워크 연결 후 진행 필요.
- **NoSQL**: DynamoDB/MongoDB 캐시/로그 연동은 TODO(인터페이스 확장 포인트만 마련).

## 4) 배포/운영 메모
- `docs/lambda_deploy_guide.md` 참고: 빌드 방법, Lambda 핸들러 파일/이름, API Gateway 경로 매핑 정리.
- 환경 변수: 공공데이터 API 키 + `DB_ENABLED`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CLIENT` 등을 Lambda/Parameter Store/Secrets Manager로 주입.
- CORS: Lambda 응답에 기본 허용 헤더 포함. API Gateway 단계에서 Origin을 도메인에 맞춰 제한 가능.
