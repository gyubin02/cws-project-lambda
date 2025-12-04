# Lambda Deploy Guide

## 빌드 & 산출물
- `pnpm -C server build:lambda` (또는 `npm run build:lambda` inside `server/`) 실행 시 `server/dist/lambda/*.js` 로 TypeScript가 컴파일됩니다.
- 각 파일의 **핸들러 이름**은 `handler`이며, API Gateway에 등록할 때 `briefing-lambda.handler` 처럼 `<filename>.handler` 형식을 사용합니다.
- CORS 기본 헤더(`Access-Control-Allow-Origin` 등)는 Lambda 응답에 내장되어 있어 추가 설정 없이도 동작합니다.

## 경로 → Lambda 매핑 (HTTP API, Lambda Proxy)
| API Gateway Route | Lambda 파일 (handler) |
| --- | --- |
| `GET /api/v1/briefing` | `server/dist/lambda/briefing.lambda.js` (`handler`) |
| `GET /api/v1/weather` | `server/dist/lambda/weather.lambda.js` (`handler`) |
| `GET /api/v1/air` | `server/dist/lambda/air.lambda.js` (`handler`) |
| `GET /api/v1/traffic/city` / `car` / `transit` | `server/dist/lambda/trafficCity.lambda.js` (`handler`) |
| `GET /api/v1/traffic/expressway` / `route-tollgates` | `server/dist/lambda/trafficExpressway.lambda.js` (`handler`) |
| `GET/POST /api/v1/profile` | `server/dist/lambda/profile.lambda.js` (`handler`) |
| `GET/POST /api/v1/settings` | `server/dist/lambda/settings.lambda.js` (`handler`) |
| `GET /api/v1/healthz` / `/health/geocode` | `server/dist/lambda/health.lambda.js` (`handler`) |

## 환경 변수 및 시크릿
- `.env`에 정의된 기존 키(`TMAP_API_KEY`, `KMA_API_KEY`, 등)와 함께 DB 설정(`DB_ENABLED`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CLIENT`)을 Lambda 환경 변수 또는 SSM/Secrets Manager에 주입하세요.
- `DB_ENABLED=0` 상태에서는 JSON 파일(`.data/store.json`) fallback을 사용하여 로컬에서도 동작합니다.

## 배포 팁
- API Gateway 스테이지 별로 Lambda Alias(dev/stage/prod)를 연결하면 무중단 스위칭이 쉽습니다.
- RDS 보안 그룹에 Lambda VPC 서브넷을 허용하고, 외부 공공데이터 호출을 위해 NAT 게이트웨이 또는 VPC 엔드포인트 구성을 고려하세요.
