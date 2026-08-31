import { apiGet, apiPost } from "./client";

// pointwallet-service /api/v1/wallet — 홀드는 잔액에서 즉시 빠지는 모델이라 이 값이 곧 입찰 가능액이다
export interface WalletBalance {
  availableBalance: number;
}

export function getWalletBalance(): Promise<WalletBalance> {
  return apiGet<WalletBalance>("/api/v1/wallet");
}

export type PointTransactionType =
  | "DEPOSIT"
  | "HOLD"
  | "RELEASE"
  | "DEPOSIT_CANCEL"
  | "WITHDRAW"
  | "FEE_INCOME"
  | "SETTLEMENT_PAYOUT";

export interface PointTransaction {
  transactionId: number;
  type: PointTransactionType;
  // 부호가 붙어서 온다 — 차감 거래(HOLD·DEPOSIT_CANCEL·WITHDRAW)는 음수
  amount: number;
  // 이름은 auction이지만 실제로는 홀드·충전 등 거래를 만든 쪽의 id가 들어온다.
  // 유형마다 가리키는 대상이 달라 사용자에게 보여줄 수 없어, 지금은 화면에서 쓰지 않는다
  relatedAuctionId: number | null;
  createdAt: string;
}

// 다른 목록 API와 달리 totalElements·last가 없다 (백엔드 PointTransactionHistoryResponse 그대로)
export interface PointTransactionPage {
  content: PointTransaction[];
  page: number;
  totalPages: number;
}

export interface PointTransactionParams {
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export function fetchPointTransactions(
  params: PointTransactionParams,
): Promise<PointTransactionPage> {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 20));
  return apiGet<PointTransactionPage>(`/api/v1/wallet/transactions?${query}`);
}

// POST /api/v1/deposits — 충전 요청만 만든다. 실제 입금은 결제사 결제까지 끝나야 반영된다
export const MIN_DEPOSIT_AMOUNT = 1000;

export interface DepositRequestResult {
  orderId: string;
  amount: number;
}

export function requestDeposit(amount: number): Promise<DepositRequestResult> {
  return apiPost<DepositRequestResult>("/api/v1/deposits", { amount });
}

// POST /api/v1/deposits/confirm — 결제사에서 결제를 마치고 돌아왔을 때 부른다.
// 이걸 불러야 백엔드가 결제사에 승인을 요청하고 잔액에 반영한다
export function confirmDeposit(
  paymentKey: string,
  orderId: string,
  amount: number,
): Promise<void> {
  return apiPost<void>("/api/v1/deposits/confirm", {
    paymentKey,
    orderId,
    amount,
  });
}

// 이 충전은 이미 반영이 끝났다는 응답. 앞선 시도가 통과한 뒤 한 번 더 부르면 이게 온다
export const DEPOSIT_ALREADY_PROCESSED = "DERR-3001";
// 결제사가 승인을 거절했다는 응답. QR·앱 결제처럼 승인이 늦게 끝나는 흐름에서는
// 아직 승인 전이라 거절된 것일 수 있어, 잠시 뒤 다시 물어보면 통과한다
export const DEPOSIT_PG_ERROR = "DERR-3008";

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "충전",
  HOLD: "입찰 보증금 차감",
  RELEASE: "입찰 보증금 반환",
  DEPOSIT_CANCEL: "충전 취소",
  WITHDRAW: "출금",
  FEE_INCOME: "수수료",
  SETTLEMENT_PAYOUT: "정산 입금",
};

export function formatTransactionType(type: string): string {
  return TRANSACTION_TYPE_LABELS[type] ?? type;
}

// ===== 인출 =====
// WithdrawController — 신청과 상태조회 둘 다 있지만, 신청 자체가 계좌조회→지갑차감→완료 처리까지
// 한 번에 동기로 끝나므로(뱅킹 연동은 시뮬레이션) 신청 응답의 status는 실패가 아닌 한 항상 SUCCESS다.
// 상태조회는 신청 시점 이후 내역을 다시 확인하고 싶을 때 쓴다
export type WithdrawStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface WithdrawRequestResult {
  withdrawRequestId: number;
  status: WithdrawStatus;
  feeAmount: number;
  netAmount: number;
}

export interface WithdrawStatusResult {
  withdrawRequestId: number;
  status: WithdrawStatus;
  amount: number;
  failReason: string | null;
  requestedAt: string;
  processedAt: string | null;
}

// 인출 수수료율 — 백엔드 WITHDRAW_FEE_RATE(2%, 내림 처리)와 동일한 값. 안내 문구에만 쓴다,
// 실제 금액 계산은 서버 응답(feeAmount/netAmount)을 그대로 표시한다
export const WITHDRAW_FEE_RATE = 0.02;

// POST /api/v1/wallet/withdraw/request
// 백엔드가 Idempotency-Key 헤더를 필수로 검증한다((user_id, idempotency_key) 복합 유니크로
// 중복 출금을 막는 설계) — 요청마다 새 키를 만들어 함께 보낸다
export function requestWithdraw(
  amount: number,
): Promise<WithdrawRequestResult> {
  return apiPost<WithdrawRequestResult>(
    "/api/v1/wallet/withdraw/request",
    { amount },
    { "Idempotency-Key": crypto.randomUUID() },
  );
}

// GET /api/v1/wallet/withdraw/{id}
export function getWithdrawStatus(
  withdrawRequestId: number,
): Promise<WithdrawStatusResult> {
  return apiGet<WithdrawStatusResult>(
    `/api/v1/wallet/withdraw/${withdrawRequestId}`,
  );
}

// 등록된 출금 계좌가 없다는 응답 — 회원 서비스 쪽 계좌 등록을 먼저 안내해야 한다
export const WITHDRAW_NO_BANK_ACCOUNT = "WDERR-3003";
// 잔액 부족
export const WITHDRAW_INSUFFICIENT_BALANCE = "WDERR-3002";
// 동시 요청이 몰려 지갑 락 획득에 실패(재시도 5회 소진) — 잠시 후 다시 시도하면 된다
export const WITHDRAW_LOCK_CONTENTION = "WDERR-3006";
