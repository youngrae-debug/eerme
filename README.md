# eerme

하루를 **세 줄의 문장과 사진**으로 기록하는 Expo Router 기반 모바일 저널 앱입니다.
뉴모피즘 스타일 UI를 공통 테마로 사용하며, 로컬 우선 저장 + 계정 로그인 시 자동 원격 동기화를 지원합니다.

## 현재 앱 기능

### 1) 홈(오늘 기록)
- 오늘 날짜 기준으로 세 줄 일기를 작성/수정/저장
- 각 줄 최대 120자 제한과 공백 검사 등 기본 입력 검증
- 사진 첨부 지원 (무료 최대 3장, 프리미엄 최대 10장)
- 최근 작성한 기록 7개를 홈에서 바로 확인

### 2) 캘린더
- 현재 월 포함 최근 12개월 기록을 달력으로 탐색
- 기록이 있는 날짜를 썸네일/점 표시로 구분
- 날짜 선택 시 해당 일기 상세 확인, 수정, 삭제 가능

### 3) 검색
- 키워드로 저장된 기록 검색
- 검색어가 들어간 문장만 추려서 결과 표시

### 4) 통계
- 최근 7일 기준 사진 수/문장 수 추이 차트 제공
- 이번 달 문장 수, 전체 누적 문장 수 집계
- 자주 등장한 키워드 Top 목록 확인

### 5) 동기화/구독(My)
- 앱 언어 전환 (한국어/영어/일본어)
- 프리미엄 구독 상품 조회, 구매, 복원
- 동기화 상태(진행률, 대기 건수, 마지막 동기화 시각) 확인 및 수동 동기화 실행
- 백업(JSON export/import) 화면은 프리미엄 사용자에게만 노출

### 6) 데이터 구조
- `expo-sqlite` 기반 로컬 우선 저장
- 동기화 큐로 로컬 변경사항(생성/수정/삭제) 순차 처리
- 원격 동기화 provider (`custom` / `firebase` / `supabase`) 확장 구조 지원

## 기기 간 자동 복구(자동 백업) 흐름

같은 계정으로 로그인한 기기에서는 아래 흐름으로 자동 복구가 동작합니다.

1. A 기기에서 일기를 저장/수정/삭제하면 로컬 DB에 즉시 반영됩니다.
2. 변경 항목이 sync queue에 적재됩니다.
3. 로그인 세션이 있으면 백그라운드에서 자동 `syncNow()`가 실행되어 원격으로 push/pull 됩니다.
4. B 기기에서 같은 계정으로 로그인하면 앱 시작 시 자동 pull이 실행되어 최신 데이터가 로컬 DB에 반영됩니다.

추가로 앱 내부에는 로컬 긴급 복구용 자동 백업(`AsyncStorage`, `@eerme/auto-backup:v1`)도 유지됩니다.

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


## RevenueCat 구독 설정

현재 구독 결제는 RevenueCat(`react-native-purchases`) 기준으로 동작하도록 구현되어 있습니다.

1. 패키지 설치
```bash
npm install react-native-purchases
```

2. `app.json`의 `expo.extra`에 키/권한 ID 설정
```json
{
  "expo": {
    "extra": {
      "revenueCat": {
        "iosApiKey": "appl_xxxxxxxxx",
        "androidApiKey": "goog_xxxxxxxxx",
        "entitlementId": "premium"
      }
    }
  }
}
```

- `react-native-purchases`는 네이티브 모듈이므로 **Expo Go에서는 동작하지 않습니다**. 반드시 EAS Development Build(또는 스토어 배포 빌드)에서 결제를 테스트하세요.
- Expo managed workflow에서는 별도 config plugin 추가 없이 EAS 빌드(또는 `expo prebuild`)로 네이티브 프로젝트에 모듈을 반영하세요.
- iOS/Android 동시 지원이면 `iosApiKey`/`androidApiKey`를 각각 넣어 주세요. 단일 `apiKey`만 넣으면 모든 플랫폼에서 같은 키를 사용합니다.
- `entitlementId`는 RevenueCat 대시보드의 Entitlement ID와 동일해야 합니다.
- Offering에 월간/연간 패키지를 연결하면 앱의 구독 화면에서 자동으로 상품 목록을 가져옵니다.
- 앱 내 구독 약관/고지 문구는 `docs/subscription-terms.ko.md`를 기준으로 관리합니다.

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
