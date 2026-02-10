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

하루를 세줄의 문장으로 남기는 Expo Router 기반 모바일 앱 스캐폴드입니다. 
심플한 화면/스토어/유틸 구성을 포함하며, 이후 기능 확장을 위한 기초 구조만 잡혀 있습니다.

## 폴더 구조
```
eerme/
```

## 동작 개요
- 오늘 기록: app/index.tsx에서 한 문장 입력 후 저장, 동일 날짜 항목을 리스트로 표시
- 달력/요약: app/calendar.tsx에서 날짜별 그룹핑된 기록 목록
- 검색: app/search.tsx에서 키워드 필터
- 상태 관리: Zustand persist로 AsyncStorage에 로컬 보존
- 입력 검증: utils/validate.ts에서 공백/120자 제한 처리
- 월별 통계/시각화, 검색 범위 필터, 백업/동기화 옵션
- 커스텀 폰트(assets/fonts) 및 테마 토글

## 실행
1. 의존성 설치: npm install (또는 yarn, pnpm)
2. 개발 서버: npm start
3. 기기/에뮬레이터에서 Expo Go로 접속

## 라이선스
추후 결정

