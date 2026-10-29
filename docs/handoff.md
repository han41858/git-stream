# 작업 인계

## 구현

`docs/specification.md`에 따라 React + TypeScript + Vite 웹앱 구현.
Canvas 2D 커밋 DAG, 저장소 입력/공유 URL, 브랜치 강조, 시간 방향 전환,
커밋 상세, 페이지네이션, 미조회 부모 표시, 메모리 전용 PAT 입력,
반응형 화면 및 테마를 제공한다. 실행·배포 절차는 README.md 참고.

## 검증

- Node.js 24에서 `npm ci`, `npm test`(11개), `npm run build` 통과.
- Chromium에서 모의 GitHub API를 사용해 데스크톱·모바일 화면과 저장소 입력,
  URL 복원용 쿼리, 상세 정보, 브랜치 선택, 시간 방향 전환, 토큰 제거 검증.
- 프로덕션 정적 HTML 및 JS/CSS 자산 응답 확인.
- 10,000개 합성 커밋 레이아웃 테스트 통과.
- 실제 GitHub API와 private 저장소 조회, 대형 실제 저장소 성능은 미검증.

## 배포 미완료

Vercel 설정은 준비했지만 배포된 주소는 없다.
기존 환경에서 Vercel CLI 65.7.0은 로그아웃 상태였고,
`api.github.com`과 `api.vercel.com`은 실행 환경의 egress 정책에 막혔다.
환경 설정 초안에 GitHub API 허용, Vercel API 허용 및 `VERCEL_TOKEN` 보안 요구를
저장했지만 실행 환경 적용과 Publish는 확인되지 않았다.
새 채팅에서는 현재 네트워크/인증 상태를 다시 확인할 것.
Vercel 토큰은 환경 설정의 보안 입력으로만 받고 Git이나 채팅에 남기지 않는다.
배포 요청은 있었으나 이후 사용자는 채팅을 옮기기 위해 dev 브랜치 푸시를 요청했다.

배포 빌드에는 환경변수가 필요 없다. PAT를 `VITE_*` 변수에 넣지 않는다.
클라우드 개발 환경 설정 초안과 임시 브라우저 검증 스크립트/스크린샷은
GitHub 저장소에 포함되지 않는다. 새 환경에서는 README의 설치·검증 절차를 실행한다.
