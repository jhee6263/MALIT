# 말이음(MALIUM) D1

성인 실어증 환자를 위한 단계적 문장 산출 훈련 웹 앱의 D1 구현입니다. D1은 화면, 실제 계정/권한, 데이터 저장, 콘텐츠 운영, 수동 발화 확인까지 포함합니다. 실제 음성 인식과 기록 기반 자동 추천은 D2에서 현재 인터페이스에 연결합니다.

## 실행

```bash
npm install
npm run dev
```

`http://localhost:3000`에서 확인합니다. Supabase 환경변수가 없으면 데모 모드로 실행됩니다.

- 일반 이름 입력: 환자 화면
- 이름에 `재활사` 입력: 재활사 화면
- 이름에 `관리자` 입력: 관리자 화면
- 데모 모드에서는 비밀번호에 아무 값이나 입력할 수 있습니다.
- 화면에 보이는 `0000`은 디자인 확인용 안내일 뿐, 실제 계정은 8자 이상 비밀번호를 사용합니다.

## Supabase 연결

1. `.env.example`을 `.env.local`로 복사하고 세 값을 입력합니다.
2. Supabase SQL Editor에서 `../supabase/migrations/202609260001_initial_schema.sql`부터 날짜 순서대로 실행합니다.
3. 첫 관리자 계정을 Supabase Auth에서 만든 뒤 해당 사용자 ID로 아래 SQL을 실행합니다.

```sql
update public.profiles
set role = 'admin', status = 'active', name = '이진희'
where id = 'AUTH_USER_UUID';
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 API에서 환자 Auth 계정을 만들 때만 사용합니다. 브라우저에 노출되는 `NEXT_PUBLIC_` 이름을 붙이면 안 됩니다.

## 주요 경로

| 경로 | 기능 |
|---|---|
| `/` | 환자/재활사/관리자 로그인 |
| `/signup/therapist` | 실제 재활사 가입 신청(`pending`) |
| `/patient/today` | 오늘의 훈련 |
| `/patient/training` | 상황→핵심어→문장→문법→재산출 |
| `/patient/result` | 쉬운 변화 메시지와 결과 |
| `/therapist` | 재활사 대시보드 |
| `/therapist/patients/new` | 환자 계정과 초기 훈련 설정 |
| `/therapist/records` | 도움 단계·판정 출처 기록 |
| `/admin/therapists` | 재활사 승인/반려 |
| `/admin/contents` | 콘텐츠 초안·검토·게시 |

## D1/D2 경계

- D1: 실제 Supabase Auth/DB/RLS/Storage 구조, 수동 발화 확인, 단계별 단서, 규칙 기반 일일 콘텐츠 구성, 관리자 콘텐츠 검토
- D2: 한국어 음성 인식, 신뢰도/대체 표현 판정, 설명 가능한 자동 추천, 저신뢰 기록 검토 큐

음성 버튼은 D1에서 의도적으로 자동 판정하지 않습니다. 사용자가 `말했어요`를 누르거나 옆의 동반 보조자가 확인할 수 있으며 판정 출처가 구분되어 저장됩니다.

## 검증

```bash
npm run lint
npm run build
```
