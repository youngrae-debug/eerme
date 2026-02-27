# eerme

하루를 **세 줄의 문장과 사진**으로 기록하는 Expo Router 기반 모바일 저널 앱입니다.
뉴모피즘 스타일 UI를 공통 테마로 사용하며, 로컬 우선 저장과 선택적 원격 동기화를 지원합니다.

## 주요 기능

### 1) 오늘 기록 (Today)
- 오늘 날짜 기준으로 3줄 텍스트 입력/수정/저장
- 줄당 최대 120자 입력 제한 및 기본 유효성 검사
- 사진 첨부 지원 (무료: 1장, 프리미엄: 최대 5장)
- 최근 기록 7개 빠른 보기

### 2) 캘린더 기록
- 최근 12개월 + 현재 월 기록을 달력에서 확인
- 기록이 있는 날짜를 이미지/점 표시로 구분
- 과거 날짜를 눌러 일기 상세를 확인하고 수정/삭제 가능

### 3) 검색
- 키워드 기반 기록 검색
- 검색어가 포함된 문장만 추려서 표시

### 4) 통계
- 최근 7일 사진 수/문장 수 라인 차트
- 이번 달 문장 수, 전체 문장 수 집계
- 자주 사용한 키워드 Top 목록 제공

### 5) 마이(My)
- 앱 언어 전환: 한국어 / 영어 / 일본어
- 구독(프리미엄) 상품 조회, 구매 요청, 복원
- 동기화 상태(진행 상태, 대기 건수, 마지막 동기화 시각) 확인 및 수동 동기화

### 6) 데이터 저장/동기화
- `expo-sqlite` 기반 로컬 영속화
- 동기화 큐를 통한 로컬 변경사항 관리
- 원격 동기화 provider(`custom` / `firebase` / `supabase`) 구조 지원

## 기술 스택
- Expo + React Native + TypeScript
- Expo Router (file-based routing)
- expo-sqlite
- Firebase JavaScript SDK (`firebase`)
- react-native-chart-kit
- lucide-react-native

## 실행 방법

```bash
npm install
npm start
```

Expo 개발 서버가 실행되면 Android/iOS 시뮬레이터 또는 Expo Go에서 앱을 열어 확인할 수 있습니다.

## 환경 변수

```bash
EXPO_PUBLIC_SYNC_PROVIDER=firebase

# custom provider 사용 시
EXPO_PUBLIC_SYNC_API_BASE_URL=https://your-api.example.com

# firebase provider 사용 시
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_APP_ID=1:xxxx:ios:xxxx

# supabase provider 사용 시
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> 참고: Firebase provider는 Firebase JavaScript SDK(auth/database)와 REST API를 함께 사용합니다. 이메일 로그인/회원가입, 실시간 DB 동기화는 SDK 경로를 우선 사용하며, 일부 소셜 로그인/토큰 재발급은 REST API를 병행합니다.
> 참고: TestFlight/EAS 빌드에서는 로컬 `.env`가 자동 포함되지 않으므로, `EXPO_PUBLIC_SYNC_PROVIDER`와 Firebase 키들은 EAS 환경 변수(또는 `eas.json > build.<profile>.env`)로 반드시 주입해야 합니다. 값이 누락되면 로그인/회원가입 시 환경 변수 누락 오류가 발생합니다.
