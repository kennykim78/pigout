# Pigout React App

Zeplin 디자인을 기반으로 구현한 음식 건강 분석 앱입니다.

## 화면 구성

1. **Intro Splash** - 인트로 스플래시 화면
2. **Select Option** - 관심 질병 선택 화면 (최대 3개)
3. **Main** - 음식 입력 메인 화면 (촬영/음성/직접입력)
4. **Result 01** - 음식 분석 결과 (점수 기반)
5. **Result 2** - 상세 분석 결과 (좋은점/나쁜점)

## 시작하기

### 개발 서버 실행
```bash
npm run dev
```

개발 서버가 실행되면 브라우저에서 자동으로 열립니다.
상단 네비게이션을 통해 각 화면을 확인할 수 있습니다.

### 프로덕션 빌드
```bash
npm run build
```

### 빌드 미리보기
```bash
npm run preview
```

## 기술 스택
- React 18.3.1
- Vite 5.4.11
- SCSS (Sass)
- React Router DOM
- @vitejs/plugin-react 4.3.4

## 프로젝트 구조
```
src/
├── pages/           # 페이지 컴포넌트
│   ├── IntroSplash.jsx/scss
│   ├── SelectOption.jsx/scss
│   ├── Main.jsx/scss
│   ├── Result01.jsx/scss
│   └── Result2.jsx/scss
├── components/      # 재사용 가능한 컴포넌트
├── styles/          # 공통 스타일
│   ├── _variables.scss
│   └── _mixins.scss
├── assets/          # 이미지, 아이콘 등
└── App.jsx          # 라우터 설정
```

## 디자인
Zeplin 프로젝트 기반으로 구현되었습니다.
