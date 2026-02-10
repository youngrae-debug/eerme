# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

# eerme

하루를 세 줄의 문장으로 남기는 Expo Router 기반 모바일 앱입니다.
`sample_ui.tsx`의 뉴모피즘 색감(다크 배경 + 라이트 서피스)을 공통 테마로 사용합니다.

## 현재 구현 상태

- 탭 네비게이션: 오늘 / 캘린더 / 검색 / 통계 / 동기화
- 오늘 탭: 3줄 입력, 저장/삭제, 최근 기록 7개 표시
- 캘린더 탭: 날짜별 기록 줄 수 요약
- 검색 탭: 키워드 기반 문장 필터
- 입력 검증: 공백 방지 + 120자 제한
- 로컬 영속화: expo-sqlite 기반 저장/복원
- 원격 동기화: 로컬 write + 백그라운드 push, 앱 시작 시 pull
- 동기화 안정성: sqlite 기반 retry queue로 실패 건 재시도
- 충돌 해결: 최신 수정 시간(updatedAt) 우선(LWW)
- 백업/복원: JSON 내보내기/가져오기 + 파일 URI 기반 저장/복원 + 저장된 파일 목록 관리 + 네이티브 공유시트 지원
- 통계 탭: 이번 달 기록일/문장 수, 연속 기록(streak), 상위 키워드

## 인증/동기화 정책

- Email 로그인: `/auth/email/login`
- Apple 로그인: `/auth/apple/login` (identity token 전달)
- Google 로그인: `/auth/google/login` (identity token 전달)
- Pull: `/entries/pull?since=<timestamp>`
- Push: `/entries/push`

> 현재 빌드에서는 `custom` / `firebase` / `supabase` provider 경로가 구현되어 있습니다.

## 환경 변수

```bash
EXPO_PUBLIC_SYNC_PROVIDER=firebase
# custom provider 사용 시
EXPO_PUBLIC_SYNC_API_BASE_URL=https://your-api.example.com
# firebase provider 사용 시
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
# supabase provider 사용 시
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```


## Firebase 보안 규칙(권장)

Realtime Database Rules 예시:

```json
{
  "rules": {
    "entries": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

## 개발 단계 (Step-by-step)

1. **완료**: 공통 테마/뉴모피즘 컴포넌트 정리
2. **완료**: 홈(오늘 기록) + 검증 + 기본 기록 리스트
3. **완료**: 캘린더 요약 / 검색
4. **완료**: expo-sqlite 영속화
5. **완료**: 로컬 우선 + 원격 동기화 구조(인증 포함)
6. **다음 단계**: 네이티브 파일 picker 연동, 테마 토글, 통계 확장(월별 비교)

## 실행

1. 의존성 설치: `npm install`
2. 개발 서버: `npm start`
3. 기기/에뮬레이터에서 Expo Go로 접속

## 라이선스

추후 결정
