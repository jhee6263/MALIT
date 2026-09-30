# MALIT 배포 안내 (Vercel + 운영 Supabase)

> 작성일: 2026-09-30
> 기준: D1 구현 완료 시점

## 환경 구성

| 구분 | 웹 앱 | 데이터베이스 | 환경변수 위치 |
|---|---|---|---|
| 개발 | `localhost:3000` (`npm run dev`) | 기존 Supabase 프로젝트(개발용) | `frontend/.env` |
| 운영 | Vercel 배포 주소 | **새 Supabase 프로젝트(운영용)** | Vercel 대시보드 환경변수 |

- 개발 중 테스트 기록은 개발 DB에만 쌓이고, 운영 DB와 섞이지 않는다.
- `main` 브랜치에 push하면 Vercel이 자동으로 운영 사이트를 다시 배포한다.
- 다른 브랜치에 push하면 운영과 별개인 미리보기(Preview) 주소가 생긴다.

## 1. 운영 Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com)에서 **New project**를 만든다. 지역은 `Northeast Asia (Seoul)`을 권장한다.
2. **Authentication → Sign In / Providers**에서 **Allow new users to sign up**을 끈다.
   - 앱의 모든 계정은 서버 API(재활사 가입 신청, 재활사의 환자 등록)로만 만들어진다.
   - 끄지 않으면 공개 키로 누구나 계정을 만들 수 있다(보안 마이그레이션으로 로그인은 막히지만 계정 자체는 생긴다).
3. **Project Settings → API**에서 다음 세 값을 확인한다.
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (**절대 공개 금지**)

## 2. 운영 DB에 마이그레이션 실행

Supabase **SQL Editor**에서 `supabase/migrations/`의 파일을 **아래 순서대로 하나씩** 실행한다.

1. `202609260001_initial_schema.sql`
2. `202609280001_remove_example_seed.sql` (새 DB에서는 지울 것이 없어 그대로 통과)
3. `202609280002_account_data_rules.sql`
4. `202609280003_initial_training_content_drafts.sql` (주제 6개, 훈련 콘텐츠 18개를 초안으로 생성)
5. `202609290001_normalize_grammar_targets.sql`
6. `202609290002_attempt_details.sql`
7. `202609300001_account_security_hardening.sql`

> 개발 DB에도 7번(`202609300001`)을 실행했는지 확인한다.

## 3. 훈련 이미지 업로드 (로컬에서 1회)

1. `frontend/.env.prod` 파일을 만들고 **운영** 값을 넣는다. 이 파일은 Git에 올라가지 않는다.

   ```env
   NEXT_PUBLIC_SUPABASE_URL=운영 Project URL
   SUPABASE_SERVICE_ROLE_KEY=운영 service_role 키
   ```

2. 먼저 검사만 실행한다.

   ```bash
   cd frontend
   npm run upload:training-images:prod
   ```

   `이미지 18개와 콘텐츠 18개를 확인했습니다.`가 나오면 실제 업로드를 실행한다.

   ```bash
   npm run upload:training-images:prod -- --apply
   ```

## 4. 콘텐츠 게시

업로드가 끝나면 SQL Editor에서 이미지가 연결된 초안을 게시한다.

```sql
update public.training_contents
set status = 'published', published_at = now(), updated_at = now()
where status = 'draft' and image_path is not null;

-- 18이 나와야 한다
select count(*) from public.training_contents where status = 'published';
```

## 5. 최초 관리자 계정

1. **Authentication → Users → Add user → Create new user**에서 관리자 이메일과 비밀번호를 입력하고 **Auto Confirm User**를 체크한다.
2. 만들어진 사용자의 **User UID**를 복사해 SQL Editor에서 실행한다.

   ```sql
   update public.profiles
   set role = 'admin', status = 'active', name = '관리자 이름'
   where id = 'User UID';
   ```

   보안 마이그레이션 이후 역할이 지정되지 않은 계정은 `pending`으로 만들어지므로, 이 SQL로 활성화해야 로그인할 수 있다.

## 6. GitHub와 Vercel 연결

1. GitHub에 **빈 저장소**를 만든다(README·.gitignore 추가 안 함, Private 권장).
2. 로컬 저장소를 연결해 push한다.

   ```bash
   git remote add origin https://github.com/<계정>/<저장소>.git
   git push -u origin main
   ```

3. [vercel.com](https://vercel.com) → **Add New → Project** → GitHub 저장소 **Import**
4. 설정
   - **Root Directory**: `frontend` (Edit을 눌러 지정)
   - Framework Preset: Next.js (자동 인식)
   - **Environment Variables**: 1단계의 운영 값 세 개를 입력
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
5. **Deploy**

환경변수를 나중에 바꾸면 **Deployments → 최신 배포 → Redeploy**를 해야 반영된다.

## 7. 배포 후 확인

1. 관리자 계정으로 로그인 → `/admin`
2. 재활사 가입 신청 → 관리자 승인 → 재활사 로그인
3. 재활사가 환자 등록(초기 비밀번호 `00000000`)
4. 환자 로그인 → 오늘의 훈련 → 1문장 이상 진행
5. 재활사 대시보드와 훈련 기록 확인

## 이후 개발 흐름

```text
로컬 개발(개발 DB) → commit → push
  ├─ 기능 브랜치 push → Vercel Preview 주소에서 확인
  └─ main에 merge/push → 운영 자동 배포
```

- DB 구조를 바꾸는 작업은 새 마이그레이션 파일로 추가하고, **개발 DB에 먼저 실행해 확인한 뒤 운영 DB에 실행**한다.
- 코드가 새 컬럼이나 테이블을 사용하는 경우, 운영 DB 마이그레이션을 **배포 전에** 실행한다.
- Preview 배포도 기본적으로 같은 환경변수를 쓴다. Preview에서 개발 DB를 쓰려면 Vercel 환경변수에서 Environment를 `Preview`로 나눠 개발 값을 따로 넣는다.
