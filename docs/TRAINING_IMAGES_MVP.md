# MALIUM MVP 훈련 이미지

## 저장 위치

최종 이미지 18개는 `frontend/public/training-images`에 바로 저장한다.

Supabase Storage에서는 기존 콘텐츠 연결을 유지하기 위해 `mvp-v1/파일명` 경로를 사용한다. 로컬 폴더 구조와 Supabase Storage 경로는 서로 독립적이다.

## 이미지 규칙

- 4:3 가로형, 1448×1086px
- 성인 대상의 친근한 교육용 일러스트
- 사실적인 성인 신체 비율
- 한 장면에서 하나의 핵심 행동 강조
- 글자, 로고, 워터마크 제외
- 인물, 대상, 장소가 목표 문장과 일치해야 함

## Supabase 연결

먼저 `202609280003_initial_training_content_drafts.sql`을 실행한다.

파일과 DB 콘텐츠가 모두 존재하는지만 검사:

```bash
npm run upload:training-images
```

검사 후 실제 Storage 업로드와 `training_contents.image_path` 연결:

```bash
npm run upload:training-images -- --apply
```

업로드 후에도 콘텐츠 상태는 `draft`로 유지한다. 관리자가 그림과 문장을 검토한 뒤 개별적으로 게시한다.
