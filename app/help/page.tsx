import Link from "next/link";

export const metadata = {
  title: "사용 방법",
};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
        {n}
      </span>
      <span className="text-sm leading-6 text-slate-600">{children}</span>
    </li>
  );
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold">
        <span className="mr-2">{emoji}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const kbd =
  "rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600";

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">업무보드 사용 방법</h1>
          <p className="mt-1 text-sm text-slate-500">
            조직 기반 트렐로 스타일 업무 분장 시스템
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          ← 돌아가기
        </Link>
      </div>

      <div className="space-y-6">
        <Section emoji="🚀" title="시작하기">
          <ol className="space-y-3">
            <Step n={1}>
              <strong>회원가입</strong> — 이름, 이메일, 비밀번호(6자 이상)로
              가입합니다.
            </Step>
            <Step n={2}>
              <strong>조직 참여</strong> — 두 가지 방법이 있습니다: 직접 새
              조직을 만들거나, 조직장에게 받은 <strong>초대 링크</strong>로
              참여합니다.
            </Step>
            <Step n={3}>
              <strong>보드 만들기</strong> — 조직 안에서 프로젝트/업무 단위로
              보드를 만들고 팀원들과 함께 사용합니다.
            </Step>
          </ol>
        </Section>

        <Section emoji="🏢" title="조직과 멤버">
          <div className="space-y-4 text-sm leading-6 text-slate-600">
            <p>
              한 사람이 <strong>여러 조직에 동시에 소속</strong>될 수 있습니다.
              조직마다 역할이 있습니다:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-400">
                    <th className="py-2 pr-4 font-medium">역할</th>
                    <th className="py-2 font-medium">권한</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 pr-4 font-semibold text-amber-700">
                      조직장
                    </td>
                    <td className="py-2">
                      조직 설정, 초대 링크, 멤버 역할 변경·내보내기
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-semibold text-sky-700">
                      관리자
                    </td>
                    <td className="py-2">조직 설정, 초대 링크, 멤버 내보내기</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-semibold text-slate-600">
                      멤버
                    </td>
                    <td className="py-2">보드·리스트·카드 생성, 수정, 이동</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        <Section emoji="✉️" title="팀원 초대하기 (조직장·관리자)">
          <ol className="space-y-3">
            <Step n={1}>
              조직 페이지에서 <span className={kbd}>조직 설정 · 초대</span> 로
              이동합니다.
            </Step>
            <Step n={2}>
              역할·유효 기간·최대 사용 횟수를 정하고{" "}
              <span className={kbd}>링크 만들기</span>를 누릅니다.
            </Step>
            <Step n={3}>
              <span className={kbd}>링크 복사</span> 후 카카오톡·메일 등으로
              팀원에게 공유합니다.
            </Step>
            <Step n={4}>
              팀원이 링크를 열고 로그인(또는 가입)하면{" "}
              <span className={kbd}>조직 참여하기</span> 버튼으로 바로
              합류합니다.
            </Step>
          </ol>
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            <strong>이메일 도메인 제한</strong> — 조직 설정에서 허용 도메인(예:
            company.co.kr)을 등록하면, 해당 도메인 이메일로 가입한 계정만 초대를
            수락할 수 있습니다. 회사 구성원만 받고 싶을 때 사용하세요.
          </p>
        </Section>

        <Section emoji="📋" title="보드 사용법">
          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li>
              <strong>리스트</strong> — 업무 단계를 나타내는 세로 컬럼입니다.
              보통 <span className={kbd}>할 일</span> →{" "}
              <span className={kbd}>진행 중</span> →{" "}
              <span className={kbd}>완료</span> 처럼 만듭니다. 이름을 클릭하면
              바로 수정됩니다.
            </li>
            <li>
              <strong>카드</strong> — 개별 업무입니다. 리스트 아래{" "}
              <span className={kbd}>+ 카드 추가</span>로 만듭니다.
            </li>
            <li>
              <strong>드래그 &amp; 드롭</strong> — 카드를 끌어서 다른 리스트로
              옮기면 업무 상태가 바뀝니다. 리스트 자체도 머리글을 잡고 좌우로
              옮길 수 있습니다.
            </li>
            <li>
              <strong>실시간 동기화</strong> — 팀원이 카드를 옮기거나 수정하면{" "}
              <em>새로고침 없이</em> 내 화면에 즉시 반영됩니다.
            </li>
          </ul>
        </Section>

        <Section emoji="🗂️" title="카드 상세 (카드를 클릭하면 열립니다)">
          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li>
              <strong>👤 담당자</strong> — 조직 멤버 중에서 이 업무의 담당자를
              지정합니다. 여러 명도 가능합니다. 지정된 담당자에게는{" "}
              <strong>알림</strong>이 갑니다.
            </li>
            <li>
              <strong>🏷️ 라벨</strong> — 색상 라벨로 업무를 분류합니다 (예:
              긴급, 디자인, 개발). 보드마다 자유롭게 만들 수 있습니다.
            </li>
            <li>
              <strong>📅 마감일</strong> — 기한을 설정하면 카드에 표시되고,
              지나면 <span className="font-semibold text-red-600">빨간색</span>
              으로 바뀝니다.
            </li>
            <li>
              <strong>⚡ 상태</strong> — 준비 / 진행 / 완료 중 선택합니다.
              진행으로 바꾸면 작업 시작 시간이, 완료로 바꾸면 종료 시간이
              자동으로 기록됩니다 (직접 수정도 가능).
            </li>
            <li>
              <strong>📎 첨부</strong> — 파일(최대 10MB)이나 링크를 카드에
              붙입니다. 파일은 보드 멤버만 열 수 있습니다.
            </li>
            <li>
              <strong>✅ 체크리스트</strong> — 업무를 세부 항목으로 쪼개고
              진행률을 확인합니다.
            </li>
            <li>
              <strong>💬 댓글</strong> — 카드 안에서 팀원과 소통합니다.
            </li>
            <li>
              <strong>🕘 활동 기록</strong> — 카드 생성, 이동, 담당자 변경,
              마감일 변경이 자동으로 기록됩니다. 누가 언제 무엇을 했는지 확인할
              수 있습니다.
            </li>
          </ul>
        </Section>

        <Section emoji="📊" title="상태별 보기 · 타임라인">
          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li>
              <strong>상태별 보기</strong> — 조직 페이지의{" "}
              <span className={kbd}>📊 상태별 보기</span>에서 조직의 모든
              업무를 준비/진행/완료 컬럼으로 한눈에 봅니다.
            </li>
            <li>
              <strong>타임라인</strong> —{" "}
              <span className={kbd}>📅 타임라인</span>에서 작업 시작~종료
              시간을 간트 차트로 봅니다. 막대를 클릭하면 해당 카드가 열립니다.
            </li>
            <li>
              <strong>날짜 미지정 업무</strong> — 타임라인 상단의 접이식
              목록에 모입니다. 목록에서 시작~종료 시간을 입력하고{" "}
              <span className={kbd}>지정</span>을 누르면 그 자리에서 바로
              타임라인에 추가됩니다.
            </li>
          </ul>
        </Section>

        <Section emoji="🔔" title="알림">
          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li>
              화면 오른쪽 위의 <strong>종 아이콘</strong>에 읽지 않은 알림
              개수가 표시됩니다. 알림은 실시간으로 도착합니다.
            </li>
            <li>
              알림이 오는 경우: <strong>내가 업무 담당자로 지정될 때</strong>,{" "}
              <strong>내가 담당한 업무가 다른 리스트로 이동될 때</strong> (예:
              할 일 → 진행 중).
            </li>
            <li>
              알림을 <strong>클릭하면 해당 업무 카드가 바로 열립니다</strong>.
              &ldquo;모두 읽음&rdquo;으로 한 번에 정리할 수 있습니다.
            </li>
          </ul>
        </Section>

        <Section emoji="📱" title="앱으로 설치하기 (PWA)">
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>업무보드는 앱처럼 설치해서 쓸 수 있습니다.</p>
            <ul className="space-y-2">
              <li>
                <strong>PC (Chrome/Edge)</strong> — 주소창 오른쪽의{" "}
                <span className={kbd}>설치</span> 아이콘을 클릭 →{" "}
                <span className={kbd}>설치</span>
              </li>
              <li>
                <strong>Android</strong> — 브라우저 메뉴(⋮) →{" "}
                <span className={kbd}>홈 화면에 추가</span>
              </li>
              <li>
                <strong>iPhone (Safari)</strong> — 공유 버튼 →{" "}
                <span className={kbd}>홈 화면에 추가</span>
              </li>
            </ul>
          </div>
        </Section>

        <Section emoji="❓" title="자주 묻는 질문">
          <dl className="space-y-4 text-sm leading-6">
            <div>
              <dt className="font-semibold text-slate-800">
                Q. 초대 링크를 눌렀는데 참여가 안 돼요.
              </dt>
              <dd className="mt-1 text-slate-600">
                링크가 만료됐거나 사용 횟수가 소진됐을 수 있습니다 — 조직장에게
                새 링크를 요청하세요. 조직에 이메일 도메인 제한이 있다면 해당
                도메인 이메일로 가입한 계정으로 시도해야 합니다.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">
                Q. 다른 조직의 보드가 안 보여요.
              </dt>
              <dd className="mt-1 text-slate-600">
                보드는 소속된 조직의 멤버에게만 보입니다. 해당 조직의 초대
                링크로 먼저 참여하세요.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">
                Q. 카드를 삭제했는데 복구할 수 있나요?
              </dt>
              <dd className="mt-1 text-slate-600">
                삭제는 즉시 반영되며 복구할 수 없습니다. 삭제 대신
                <span className={kbd}>완료</span> 리스트로 옮기는 것을
                권장합니다.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">
                Q. 담당자 메일 알림이 안 와요.
              </dt>
              <dd className="mt-1 text-slate-600">
                관리자가 메일 발송 설정(RESEND_API_KEY)을 완료해야 발송됩니다.
                스팸함도 확인해보세요.
              </dd>
            </div>
          </dl>
        </Section>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        업무보드 — 조직 기반 업무 분장 시스템
      </p>
    </div>
  );
}
