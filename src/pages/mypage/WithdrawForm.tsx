import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  requestWithdraw,
  WITHDRAW_FEE_RATE,
  WITHDRAW_INSUFFICIENT_BALANCE,
  WITHDRAW_LOCK_CONTENTION,
  WITHDRAW_NO_BANK_ACCOUNT,
  type WithdrawRequestResult,
} from "../../api/wallet";
import { ApiError } from "../../api/client";
import { formatWon } from "../../components/AuctionCard";

const MIN_WITHDRAW_AMOUNT = 1000;

// 에러코드별로 사용자가 다음에 뭘 해야 하는지가 다르므로(계좌 등록 vs 재시도 vs 잔액 확인)
// 서버 메시지를 그대로 보여주지 않고 코드로 분기한다
function describeError(e: unknown): string {
  if (!(e instanceof ApiError)) return "인출 신청 중 문제가 생겼습니다.";
  switch (e.code) {
    case WITHDRAW_NO_BANK_ACCOUNT:
      // TODO : 계좌 등록 화면이 생기면(백엔드 #102 등록 API 대기) 그리로 안내하는 링크로 교체
      return "등록된 출금 계좌가 없습니다. 계좌 등록 기능은 아직 준비 중입니다.";
    case WITHDRAW_INSUFFICIENT_BALANCE:
      return "잔액이 부족합니다.";
    case WITHDRAW_LOCK_CONTENTION:
      return "요청이 몰려 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
    default:
      return e.message;
  }
}

export function WithdrawForm() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WithdrawRequestResult | null>(null);

  const withdraw = useMutation({
    mutationFn: () => requestWithdraw(Number(amount)),
    onSuccess: (res) => {
      setError(null);
      setResult(res);
      setAmount("");
      // 인출 신청이 지갑 잔액과 거래내역(WITHDRAW 항목)을 동시에 바꾸므로 둘 다 갱신한다
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: unknown) => {
      setResult(null);
      setError(describeError(e));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < MIN_WITHDRAW_AMOUNT) {
      setResult(null);
      setError(
        `인출 금액은 ${formatWon(MIN_WITHDRAW_AMOUNT)} 이상이어야 합니다.`,
      );
      return;
    }
    // 되돌릴 수 없이 돈이 나가는 액션이라 실지급액을 보여주고 확인받는다.
    // 수수료 계산은 백엔드와 같은 규칙(2%, 내림)
    const fee = Math.floor(parsed * WITHDRAW_FEE_RATE);
    const confirmed = window.confirm(
      `${formatWon(parsed)} 인출을 신청할까요?\n수수료 ${formatWon(fee)}를 뺀 ${formatWon(parsed - fee)}이 계좌로 지급됩니다.`,
    );
    if (!confirmed) return;
    setResult(null);
    withdraw.mutate();
  }

  const parsedAmount = Number(amount);
  const canPreview =
    Number.isFinite(parsedAmount) && parsedAmount >= MIN_WITHDRAW_AMOUNT;
  const previewFee = Math.floor(parsedAmount * WITHDRAW_FEE_RATE);

  return (
    <section className="rounded-2xl border border-line bg-surface px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-faint">
        예치금 인출
      </p>
      <form
        onSubmit={submit}
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <input
          type="number"
          inputMode="numeric"
          min={MIN_WITHDRAW_AMOUNT}
          step={1000}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(MIN_WITHDRAW_AMOUNT)}
          aria-label="인출 금액"
          className="w-40 rounded-lg border border-line bg-paper px-3 py-1.5 font-mono text-sm outline-none focus:border-line-strong"
        />
        <button
          type="submit"
          disabled={withdraw.isPending}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-ink disabled:opacity-50"
        >
          {withdraw.isPending ? "처리 중…" : "인출 신청"}
        </button>
      </form>
      <p className="mt-2 text-[13px] text-muted">
        {canPreview
          ? `수수료 ${formatWon(previewFee)}를 뺀 ${formatWon(parsedAmount - previewFee)}이 등록된 계좌로 즉시 지급됩니다.`
          : `수수료 ${WITHDRAW_FEE_RATE * 100}%를 뗀 나머지가 등록된 계좌로 즉시 지급됩니다.`}
      </p>
      {error && <p className="mt-2 text-xs font-semibold text-live">{error}</p>}
      {result && (
        <div className="mt-3 rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px]">
          <p className="font-semibold text-up">인출 신청이 완료됐습니다.</p>
          <dl className="mt-1.5 grid grid-cols-2 gap-y-0.5 text-muted">
            <dt>수수료</dt>
            <dd className="text-right font-mono">
              {formatWon(result.feeAmount)}
            </dd>
            <dt>실지급액</dt>
            <dd className="text-right font-mono font-bold text-ink">
              {formatWon(result.netAmount)}
            </dd>
          </dl>
        </div>
      )}
    </section>
  );
}
