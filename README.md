# 말이음(MALIUM)

성인 실어증 환자를 위한 단계적 문장 산출 훈련 웹 애플리케이션입니다.

## 프로젝트 구조

```text
MALIT/
├─ frontend/   # Next.js 웹 앱과 서버 API
├─ supabase/   # 데이터베이스 마이그레이션
├─ docs/       # 기획·데이터·콘텐츠 문서
└─ scripts/    # 프로젝트 공용 관리 스크립트
```

현재 백엔드 API는 별도 서버가 아니라 `frontend/src/app/api`의 Next.js Route Handler로 구성합니다. 독립적인 음성 처리 서버나 배치 서버가 필요해질 때 `backend/`를 추가합니다.

## 웹 앱 실행

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다. 자세한 설정은 [프론트엔드 안내](frontend/README.md)를 확인합니다.

## 주요 문서

- [프로젝트 기획](docs/PROJECT_PLAN.md)
- [개발 인수인계](docs/CLAUDE_CODE_HANDOFF.md)
- [배포 안내](docs/DEPLOYMENT.md)
- [데이터 정의](docs/DATA_DEFINITION_DRAFT.md)
- [훈련 콘텐츠 검토](docs/TRAINING_CONTENT_AUDIT.md)
- [훈련 이미지 기준](docs/TRAINING_IMAGES_MVP.md)

## 데이터베이스

Supabase SQL 파일은 `supabase/migrations/`에서 실행 순서대로 관리합니다. 이미 적용한 마이그레이션은 수정하지 않고, 변경이 필요하면 새로운 마이그레이션 파일을 추가합니다.

