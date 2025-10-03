# 🌤️ 외출 브리핑 (Outing Briefing)

> 완벽한 여행을 위한 통합 정보 서비스

외출 브리핑은 날씨, 공기질, 교통 정보를 한 번에 확인할 수 있는 웹 애플리케이션입니다. 기상청, 에어코리아, 고속도로 교통정보를 통합하여 사용자에게 최적의 외출 정보를 제공합니다.

## ✨ 주요 기능

- 🌤️ **실시간 날씨 정보**: 기상청 데이터 기반 정확한 날씨 예보
- 🌬️ **공기질 모니터링**: 미세먼지(PM10, PM2.5) 농도 및 건강 가이드
- 🚗 **교통 정보**: 고속도로 교통 상황 및 예상 소요 시간
- 📱 **반응형 디자인**: 모바일과 데스크톱에서 최적화된 사용자 경험
- 🔄 **실시간 업데이트**: 최신 정보를 자동으로 갱신
- ⚡ **빠른 로딩**: 캐싱을 통한 효율적인 데이터 관리

## 🏗️ 기술 스택

### Frontend
- **React 18** + **TypeScript** - 현대적인 UI 개발
- **Vite** - 빠른 개발 서버 및 빌드 도구
- **Tailwind CSS** - 유틸리티 기반 스타일링
- **shadcn/ui** - 고품질 UI 컴포넌트
- **Lucide React** - 아이콘 라이브러리

### Backend
- **Node.js 20+** + **TypeScript** - 서버 사이드 개발
- **Express.js** - 웹 프레임워크
- **Axios** - HTTP 클라이언트
- **Pino** - 고성능 로깅
- **NodeCache** - 인메모리 캐싱
- **Zod** - 스키마 검증

### 데이터 소스
- **기상청 (KMA)** - 날씨 정보
- **에어코리아** - 공기질 정보
- **고속도로 교통정보** - 교통 상황

## 🚀 빠른 시작

### 1. 저장소 클론
```bash
git clone <repository-url>
cd cws-project
```

### 2. 백엔드 설정 및 실행
```bash
# 백엔드 디렉토리로 이동
cd server

# 의존성 설치
pnpm install

# 환경변수 설정
cp env.example .env

# 개발 서버 시작
pnpm dev
```

### 3. 프론트엔드 설정 및 실행
```bash
# 루트 디렉토리로 이동
cd ..

# 의존성 설치
pnpm install

# 개발 서버 시작
pnpm dev
```

### 4. 애플리케이션 접속
- **프론트엔드**: http://localhost:8080
- **백엔드 API**: http://localhost:8787

## ⚙️ 환경 설정

### 백엔드 환경변수 (server/.env)
```env
NODE_ENV=development
PORT=8787
CORS_ORIGINS=http://localhost:8080
MOCK=1  # 1=모크 모드, 0=실제 API 모드

# API 키 (선택사항 - 모크 모드에서는 불필요)
KMA_SERVICE_KEY=your_kma_key
AIRKOREA_SERVICE_KEY=your_airkorea_key
EXPRESSWAY_API_KEY=your_expressway_key

# 성능 설정
HTTP_TIMEOUT_MS=4500
HTTP_RETRY=1
CACHE_TTL_SEC=300
```

### 프론트엔드 환경변수 (선택사항)
```env
VITE_API_BASE_URL=http://localhost:8787/api/v1
```

## 📖 사용법

### 1. 기본 사용
1. 웹 애플리케이션에 접속
2. 출발지와 도착지 입력
3. 현재 위치의 위도/경도 입력 (또는 기본값 사용)
4. "브리핑 받기" 버튼 클릭
5. 통합된 날씨, 공기질, 교통 정보 확인

### 2. 상세 정보 보기
- 각 카드를 클릭하여 상세 정보 모달 열기
- 실시간 데이터 업데이트 시간 확인
- API 상태 및 오류 정보 확인

## 🔧 개발 모드

### 모크 모드 (기본값)
- API 키 없이도 개발 가능
- 샘플 데이터로 UI 테스트
- 백엔드 서버만 실행하면 됨

### 실제 API 모드
1. `server/.env`에서 `MOCK=0`으로 설정
2. 각 서비스의 API 키 입력
3. 백엔드 서버 재시작

## 🧪 테스트

### 백엔드 테스트
```bash
cd server
pnpm test
```

### API 테스트
```bash
# 브리핑 API 테스트
curl "http://localhost:8787/api/v1/briefing?lat=37.5665&lon=126.9780&from=강남역&to=서울역"

# 헬스체크
curl "http://localhost:8787/api/v1/healthz"
```

## 📁 프로젝트 구조

```
cws-project/
├── src/                    # 프론트엔드 소스코드
│   ├── components/         # React 컴포넌트
│   ├── lib/               # 유틸리티 및 API
│   ├── pages/             # 페이지 컴포넌트
│   └── hooks/             # 커스텀 훅
├── server/                # 백엔드 소스코드
│   ├── src/
│   │   ├── adapters/      # 외부 API 어댑터
│   │   ├── services/      # 비즈니스 로직
│   │   ├── routes/        # API 라우트
│   │   ├── lib/           # 유틸리티
│   │   └── types/         # 타입 정의
│   ├── tests/             # 테스트 파일
│   └── openapi.yaml       # API 스펙
├── package.json           # 프론트엔드 의존성
└── README.md             # 프로젝트 문서
```

## 🌐 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/v1/briefing` | GET | 통합 브리핑 정보 |
| `/api/v1/weather` | GET | 날씨 정보 |
| `/api/v1/air` | GET | 공기질 정보 |
| `/api/v1/traffic` | GET | 교통 정보 |
| `/api/v1/healthz` | GET | 서버 상태 확인 |

## 🚀 배포

### 프론트엔드 배포
```bash
pnpm build
# dist/ 폴더를 정적 호스팅 서비스에 업로드
```

### 백엔드 배포
```bash
cd server
pnpm build
pnpm start
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 문의

프로젝트에 대한 문의사항이나 버그 리포트는 GitHub Issues를 통해 제출해 주세요.

---

**Made with ❤️ for better outdoor experiences**