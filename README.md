# TaskFlow (업무보드)

조직 기반 트렐로 스타일 업무 분장 시스템.

- **조직**: 한 사람이 여러 조직에 소속 가능. 조직장이 만든 초대 링크로만 가입.
- **도메인 제한**: 조직별로 허용 이메일 도메인을 설정하면 해당 도메인 계정만 초대 수락 가능.
- **보드**: 트렐로 방식 — 보드 > 리스트 > 카드, 드래그&드롭으로 이동.
- **카드**: 담당자 지정, 상태(준비/진행/완료), 작업 시작~종료 시간, 마감일, 라벨, 첨부(파일/링크), 댓글, 체크리스트, 업무 히스토리 자동 기록.
- **다양한 보기**: 상태별(준비/진행/완료 분류), 타임라인(간트), 캘린더(월간), 보고서(통계 대시보드) — 조직 전체 또는 보드 단위로 전환.
- **실시간**: 다른 팀원이 카드를 옮기면 내 화면에도 즉시 반영 (Supabase Realtime). 인앱 알림(종 아이콘).

기술 스택: Next.js (App Router) · Supabase (Postgres/Auth/Realtime) · @dnd-kit · Tailwind CSS

---

## 1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com) 에서 새 프로젝트를 생성합니다.
2. 대시보드 > **SQL Editor** 에서 아래 파일들을 순서대로 붙여넣고 **Run** 을 실행합니다:
   1. [`supabase/schema.sql`](supabase/schema.sql) — 기본 스키마
   2. [`supabase/notifications.sql`](supabase/notifications.sql) — 인앱 알림
   3. [`supabase/attachments.sql`](supabase/attachments.sql) — 첨부 (파일/링크 + 스토리지)
   4. [`supabase/card-status.sql`](supabase/card-status.sql) — 카드 상태 + 작업 시간
   5. [`supabase/due-reminders.sql`](supabase/due-reminders.sql) — 마감 임박 알림 (pg_cron)
3. **Authentication > Sign In / Providers > Email** 에서:
   - 빠르게 시작하려면 **Confirm email 을 끄세요** (이메일 인증 없이 즉시 가입).
   - 이메일 인증을 유지하려면 SMTP 설정이 필요합니다 (기본 내장 메일은 시간당 발송 제한이 있음).

## 2. 로컬 실행

```bash
npm install
```

`.env.local` 파일의 값을 실제 값으로 교체합니다 (Supabase 대시보드 > **Settings > API**):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

```bash
npm run dev
```

http://localhost:3000 접속 → 회원가입 → 조직 만들기 → 보드 만들기.

## 3. Vercel 배포

1. 이 프로젝트를 GitHub 저장소에 push 합니다.
2. [vercel.com](https://vercel.com) 에서 **Add New Project** → 저장소 import.
3. **Environment Variables** 에 아래 두 개를 추가합니다:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. 배포 후 Supabase 대시보드 > **Authentication > URL Configuration** 에서:
   - **Site URL** 을 배포 주소로 설정 (예: `https://your-app.vercel.app`)

## 로컬 디버깅 (VS Code, Windows에서 F5)

VS Code는 **Windows에서** `C:\forWife\일정관리` 폴더를 열고, 디버깅도 Windows에서 F5로 시작합니다.

### 테스트 DB

테스트 DB는 **Supabase 무료 클라우드 프로젝트**를 사용합니다 — 로컬에 설치할 것이 없습니다.
(Supabase는 인증·실시간·API 서버를 포함한 스택이라 단독 Postgres 설치로는 대체할 수 없고,
로컬 스택은 Docker가 필요하므로 이 프로젝트에서는 사용하지 않습니다.)

위의 **1. Supabase 프로젝트 만들기**를 마치고 `.env.local`에 URL/anon key만 넣으면
F5 만으로 전체 기능(가입 → 조직 → 초대 → 보드 → 실시간)을 테스트할 수 있습니다.
데이터 확인·수정은 Supabase 대시보드의 **Table Editor**에서 하면 됩니다.

### 디버그 실행 (F5)

`실행 및 디버그` 패널(Ctrl+Shift+D)에 3가지 구성이 준비되어 있습니다:

| 구성 | 용도 |
|------|------|
| **Next.js: 서버 디버그** | 서버 컴포넌트, `proxy.ts`(미들웨어), 서버 측 Supabase 호출에 중단점 |
| **Next.js: 클라이언트 디버그** | 브라우저 코드(BoardCanvas, CardModal 등 `"use client"` 컴포넌트)에 중단점 — 서버가 이미 떠 있을 때 사용 |
| **Next.js: 풀스택 디버그** | 서버 시작 + Chrome 자동 실행, 양쪽 중단점 동시 지원 |

`.tsx` 파일 왼쪽 여백을 클릭해 중단점을 찍고 F5로 시작하면 됩니다. 예: [components/board/BoardCanvas.tsx](components/board/BoardCanvas.tsx)의 `handleDragEnd`에 중단점을 찍으면 카드 드래그 시 멈춥니다.

### 참고 사항

- `node_modules`에는 Windows/Linux 네이티브 바이너리가 함께 설치되어 있어, 필요하면 WSL 터미널에서도 `npm run dev`를 실행할 수 있습니다 (선택 사항). 이상해지면 `rm -rf node_modules && npm install` 로 재설치하세요.
- 이 프로젝트는 **Docker를 사용하지 않습니다.**

## 인앱 알림 (종 아이콘)

내가 담당자로 지정되거나, 내가 담당한 카드가 다른 리스트로 이동되면 화면 오른쪽 위
종 아이콘에 실시간으로 알림이 옵니다. 알림 클릭 시 해당 카드가 바로 열립니다.

**마감 임박 알림** — 매일 오전 9시(KST)에 pg_cron 이 돌면서 마감이 **7일 / 1일 / 0일**
남은 카드의 담당자에게 알림을 보냅니다. 담당자가 없으면 카드를 만든 사람에게 갑니다.
같은 카드·같은 D-day 로는 한 번만 발송되며, 완료된 카드는 제외됩니다.

> **설치**: [`supabase/schema.sql`](supabase/schema.sql) 실행 후
> [`supabase/notifications.sql`](supabase/notifications.sql) 도 SQL Editor 에서 실행해야 합니다.
> (알림 테이블·트리거·실시간 설정)

## 메일 알림 (담당자 배정)

카드에 담당자를 지정하면 그 사람에게 이메일이 발송됩니다. [Resend](https://resend.com) 무료 계정(월 3,000건)이 필요합니다:

1. resend.com 가입 → **API Keys** 에서 키 발급
2. `.env.local`(및 Vercel 환경변수)에 추가:
   ```
   RESEND_API_KEY=re_xxxxxxxx
   EMAIL_FROM=업무보드 <onboarding@resend.dev>
   ```
3. 키를 설정하지 않으면 메일만 발송되지 않고 나머지 기능은 정상 동작합니다.

> **주의**: 발신 도메인을 인증하기 전에는 Resend가 **가입한 본인 이메일로만** 발송을 허용합니다.
> 팀 전체에게 보내려면 Resend 대시보드 > Domains 에서 회사 도메인을 인증하고
> `EMAIL_FROM=업무보드 <no-reply@회사도메인>` 으로 바꾸세요.
>
> 본인이 본인을 담당자로 지정한 경우에는 메일을 보내지 않습니다.

## PWA (앱 설치)

업무보드는 PWA를 지원합니다 — 브라우저 주소창의 설치 아이콘(PC) 또는 "홈 화면에 추가"(모바일)로
앱처럼 설치할 수 있습니다. 오프라인일 때는 안내 페이지가 표시됩니다.
자세한 사용 방법은 앱 내 [`/help`](app/help/page.tsx) 페이지에 정리되어 있습니다.

## 사용 흐름

1. **조직장**: 회원가입 → `내 조직 > 새 조직 만들기` (허용 도메인 입력 가능)
2. **조직장**: `조직 설정 · 초대 > 링크 만들기` → 링크 복사 → 팀원에게 공유
3. **팀원**: 링크 접속 → 로그인/가입 → `조직 참여하기` (도메인 제한이 있으면 해당 도메인 이메일만 가능)
4. 보드 생성 → 리스트(할 일 / 진행 중 / 완료 등) 생성 → 카드 등록 → 드래그로 진행 상태 관리
5. 카드를 열어 담당자·마감일·라벨·체크리스트·댓글 관리, 활동 기록 확인

## 권한 구조

| 역할 | 권한 |
|------|------|
| 조직장 (owner) | 조직 설정, 초대 링크, 멤버 역할 변경/내보내기, 조직 삭제 |
| 관리자 (admin) | 조직 설정, 초대 링크, 멤버 내보내기 |
| 멤버 (member) | 보드/리스트/카드 생성·수정·이동 |

모든 데이터 접근은 Supabase RLS(행 수준 보안)로 서버에서 강제됩니다 — 소속 조직의 데이터만 읽고 쓸 수 있습니다.
