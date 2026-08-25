import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AUCTION_POLICY,
    createAuction,
    deleteAuction,
    getAuctionDetail,
    ITEM_CONDITIONS,
    modifyAuction,
    presignAuctionImages,
    type AuctionPayload,
} from "../api/auctions";
import { ApiError } from "../api/client";
import { useSession } from "../auth/session";
import { QueryState } from "../components/QueryState";
import { formatWon } from "../components/AuctionCard";
import { ProductPicker, type PickedProduct } from "./auction-form/ProductPicker";
import { ImagePicker, type LocalImage, type PickedImage } from "./auction-form/ImagePicker";
import {
    addHours,
    earliestStartAt,
    isEditableNow,
    parseInputValue,
    toInputValue,
    toInputValueFromServer,
    toServerDateTime,
    validateAuctionForm,
    type AuctionFormValues,
} from "./auction-form/schedule";

function emptyValues(now: Date): AuctionFormValues {
    const start = earliestStartAt(now);
    return {
        productId: null,
        itemCondition: "",
        itemDescription: "",
        startPrice: "",
        shippingFee: "",
        bidUnit: "",
        startAt: toInputValue(start),
        endAt: toInputValue(addHours(start, 24)),
        extensionEnabled: false,
        extensionTime: "",
    };
}

export function AuctionFormPage() {
    const { auctionId } = useParams();
    const editing = auctionId !== undefined;
    const session = useSession();

    if (!session) {
        return (
            <div className="rounded-xl border border-line bg-surface px-5 py-14 text-center">
                <p className="font-semibold">로그인이 필요한 화면입니다.</p>
                <p className="mt-1 text-sm text-muted">경매는 본인 계정으로만 등록할 수 있습니다.</p>
                <Link
                    to="/login"
                    className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink"
                >
                    로그인하러 가기
                </Link>
            </div>
        );
    }

    return editing ? <EditAuction auctionId={Number(auctionId)} /> : <AuctionForm mode="create" />;
}

function EditAuction({ auctionId }: { auctionId: number }) {
    const query = useQuery({
        queryKey: ["auction", String(auctionId)],
        queryFn: () => getAuctionDetail(auctionId),
    });
    const detail = query.data;

    return (
        <QueryState
            isLoading={query.isPending}
            error={query.error}
            isEmpty={!detail}
            emptyMessage="존재하지 않는 경매입니다."
        >
            {detail && (
                <AuctionForm
                    mode="edit"
                    auctionId={auctionId}
                    originalStartAt={toInputValueFromServer(detail.startAt)}
                    originalStatus={detail.status}
                    originalStartBidAmount={detail.startBidAmount}
                    originalImages={detail.itemImages ?? []}
                    initialProduct={{
                        productId: detail.product.productId,
                        title: detail.product.title,
                        artistName: detail.product.artistName,
                        coverImageUrl: detail.product.coverImageUrl,
                    }}
                    initialValues={{
                        productId: detail.product.productId,
                        itemCondition: detail.itemCondition,
                        itemDescription: detail.itemDescription ?? "",
                        // 서버가 시작가와 배송비를 합쳐서만 주기 때문에 되살릴 수 없다 — 다시 받는다
                        startPrice: "",
                        shippingFee: "",
                        bidUnit: String(detail.bidUnit),
                        startAt: toInputValueFromServer(detail.startAt),
                        endAt: toInputValueFromServer(detail.endAt),
                        extensionEnabled: detail.extensionEnabled,
                        extensionTime: detail.extensionTime === null ? "" : String(detail.extensionTime),
                    }}
                />
            )}
        </QueryState>
    );
}

interface AuctionFormProps {
    mode: "create" | "edit";
    auctionId?: number;
    initialValues?: AuctionFormValues;
    initialProduct?: PickedProduct;
    originalStartAt?: string;
    originalStatus?: string;
    originalStartBidAmount?: number;
    originalImages?: string[];
}

// 아직 안 올린 사진만 골라 서명 주소를 받아 S3에 올린다.
// 올린 사진에는 받은 주소를 적어서 폼에 돌려준다(onUploaded) — 다시 눌러도 같은 사진을 또 올리지 않는다.
// 일부만 성공한 채 실패해도 성공분은 먼저 돌려주고 나서 예외를 던진다
async function uploadPickedImages(
    picked: PickedImage[],
    onUploaded: (picked: PickedImage[]) => void,
): Promise<string[]> {
    const pending = picked.filter(
        (p): p is LocalImage => p.kind === "local" && p.uploadedUrl === undefined);
    // 미리보기 주소는 사진마다 유일해서, 발급받은 주소를 원래 사진에 되짚는 열쇠로 쓴다
    const uploadedByPreview = new Map<string, string>();

    const applyUploaded = () => {
        const next = picked.map<PickedImage>((p) => {
            if (p.kind === "remote") return p;
            const url = p.uploadedUrl ?? uploadedByPreview.get(p.preview);
            return url === undefined ? p : { ...p, uploadedUrl: url };
        });
        onUploaded(next);
        return next;
    };

    if (pending.length > 0) {
        const { presignedImages } = await presignAuctionImages(
            pending.map((local) => ({ contentType: local.blob.type, contentLength: local.blob.size })));
        // 발급 개수가 요청과 다르면 사진과 주소의 짝이 어긋난다. 여기서 끊어야 원인이 드러난다
        if (presignedImages.length !== pending.length) {
            throw new Error("사진 업로드 주소를 올바르게 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
        // allSettled로 전부 끝까지 보낸다 — 첫 실패에서 끊으면 이미 올라간 사진의 주소까지 잃는다
        const results = await Promise.allSettled(presignedImages.map(async (presigned, i) => {
            const local = pending[i];
            let res: Response;
            try {
                // Content-Type은 발급 때 선언한 값과 같아야 한다 — 서명에 묶여 있어 다르면 S3가 거부한다
                res = await fetch(presigned.uploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": local.blob.type },
                    body: local.blob,
                });
            } catch {
                // 연결 실패는 브라우저가 영문 메시지로 던진다 — 화면에 그대로 내보내지 않는다
                throw new Error("사진을 올리지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
            }
            if (!res.ok) throw new Error(`사진 업로드에 실패했습니다 (HTTP ${res.status})`);
            uploadedByPreview.set(local.preview, presigned.imageUrl);
        }));

        const failed = results.find((r) => r.status === "rejected");
        if (failed !== undefined) {
            // 성공분을 먼저 폼에 남긴 뒤 실패를 알린다. 다시 누르면 못 올린 사진만 재시도된다
            applyUploaded();
            const reason = (failed as PromiseRejectedResult).reason;
            throw reason instanceof Error ? reason : new Error("사진 업로드에 실패했습니다.");
        }
    }

    const next = applyUploaded();
    const urls = next.map((p) => {
        const url = p.kind === "remote" ? p.url : p.uploadedUrl;
        if (url === undefined) throw new Error("사진 주소를 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return url;
    });
    return urls;
}

function AuctionForm({
    mode,
    auctionId,
    initialValues,
    initialProduct,
    originalStartAt,
    originalStatus,
    originalStartBidAmount,
    originalImages = [],
}: AuctionFormProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [values, setValues] = useState<AuctionFormValues>(() => initialValues ?? emptyValues(new Date()));
    const [product, setProduct] = useState<PickedProduct | null>(initialProduct ?? null);
    const [images, setImages] = useState<PickedImage[]>(
        () => originalImages.map((url) => ({ kind: "remote", url })));
    const [errors, setErrors] = useState<string[]>([]);
    const [serverError, setServerError] = useState<string | null>(null);
    // 사진을 줄이는 중이면 아직 목록에 안 들어온 사진이 있다 — 그 상태로 저장하면 사진 없이 등록된다
    const [pickerBusy, setPickerBusy] = useState(false);

    const editing = mode === "edit";
    // 시한 판정은 폼에 입력한 값이 아니라 지금 등록돼 있는 시작 시각으로 해야 한다
    const pastDeadline = editing && originalStartAt !== undefined && !isEditableNow(originalStartAt, new Date());
    const notScheduled = editing && originalStatus !== undefined && originalStatus !== "SCHEDULED";
    const locked = pastDeadline || notScheduled;

    // 시작 시각 입력칸이 허용하는 가장 이른 값. 화면을 열어둔 채 시간이 흐르는 경우까지는 보지 않고,
    // 실제 판정은 보내기 직전 검증에서 다시 한다
    const minStartAt = useMemo(() => toInputValue(earliestStartAt(new Date())), []);

    function patch(next: Partial<AuctionFormValues>) {
        setValues((current) => ({ ...current, ...next }));
    }

    useEffect(() => {
        patch({ productId: product?.productId ?? null });
    }, [product]);

    const submit = useMutation({
        // 새로 고른 사진을 먼저 S3에 올려 주소로 바꾼 뒤 등록한다 — 업로드가 실패하면 등록을 진행하지 않는다
        mutationFn: async (payload: Omit<AuctionPayload, "itemImages">) => {
            // 올린 결과는 그때그때 폼에 남긴다. 등록이 실패해 다시 눌러도 이미 올라간 사진은 건너뛴다
            const urls = await uploadPickedImages(images, setImages);
            const full: AuctionPayload = {
                ...payload,
                // 사진을 안 넣었으면 빈 배열로 보낸다 — 서버가 이 항목을 빼거나 비우는 걸 허용하지 않는다
                itemImages: urls.slice(0, AUCTION_POLICY.MAX_IMAGE_COUNT),
            };
            return editing ? modifyAuction(auctionId as number, full) : createAuction(full);
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ["auctions"] });
            queryClient.invalidateQueries({ queryKey: ["auction", String(result.auctionId)] });
            navigate(`/auctions/${result.auctionId}`);
        },
        onError: (e: unknown) => {
            // 업로드 단계(presign·S3 PUT)의 실패 메시지도 그대로 보여준다
            setServerError(e instanceof Error ? e.message : "경매 저장 중 문제가 생겼습니다.");
        },
    });

    const cancelAuction = useMutation({
        mutationFn: () => deleteAuction(auctionId as number),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["auctions"] });
            navigate("/mypage?tab=hosted");
        },
        onError: (e: unknown) => {
            setServerError(e instanceof ApiError ? e.message : "경매 취소 중 문제가 생겼습니다.");
        },
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        // 버튼 잠금은 리렌더 뒤에야 걸린다 — 그 사이 들어온 두 번째 제출은 여기서 막는다
        if (submit.isPending) return;
        setServerError(null);
        if (pickerBusy) {
            setServerError("사진을 준비하는 중입니다. 잠시 후 다시 눌러주세요.");
            return;
        }
        const found = validateAuctionForm(values, new Date());
        setErrors(found);
        if (found.length > 0) return;

        const description = values.itemDescription.trim();

        submit.mutate({
            productId: values.productId as number,
            itemCondition: values.itemCondition,
            itemDescription: description === "" ? null : description,
            startPrice: Number(values.startPrice),
            shippingFee: Number(values.shippingFee),
            bidUnit: Number(values.bidUnit),
            startAt: toServerDateTime(values.startAt),
            endAt: toServerDateTime(values.endAt),
            extensionEnabled: values.extensionEnabled,
            extensionTime: values.extensionEnabled ? Number(values.extensionTime) : null,
        });
    }

    const startAtDate = parseInputValue(values.startAt);
    const description = values.itemDescription.trim();

    return (
        <div className="max-w-[760px]">
            <Link
                to={editing ? "/mypage?tab=hosted" : "/feed"}
                className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink"
            >
                ← {editing ? "등록한 경매로" : "경매 피드로"}
            </Link>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
                {editing ? "경매 수정" : "경매 등록"}
            </h1>
            <p className="mt-1 text-[13.5px] text-muted">
                {editing
                    ? `시작 ${AUCTION_POLICY.EDIT_DEADLINE_MINUTES}분 전까지, 아직 시작하지 않은 경매만 고칠 수 있습니다.`
                    : "카탈로그에 있는 음반을 골라 경매를 엽니다."}
            </p>

            {locked && (
                <div className="mt-4 rounded-xl border border-live/30 bg-live-bg px-5 py-4">
                    <p className="font-semibold text-live">
                        {notScheduled ? "이미 시작했거나 끝난 경매입니다." : "수정·취소 가능 시한이 지났습니다."}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                        경매는 시작 {AUCTION_POLICY.EDIT_DEADLINE_MINUTES}분 전까지만 고치거나 취소할 수 있습니다.
                    </p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
                <Section title="음반" hint="경매로 올릴 마스터 상품">
                    <ProductPicker picked={product} onPick={setProduct} />
                </Section>

                <Section title="매물 정보" hint="이 판의 상태와 설명">
                    <label className="block">
                        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-faint">
                            음반 상태
                        </span>
                        <select
                            value={values.itemCondition}
                            onChange={(e) => patch({ itemCondition: e.target.value })}
                            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13.5px] font-semibold outline-none"
                        >
                            <option value="">상태를 고르세요</option>
                            {ITEM_CONDITIONS.map((condition) => (
                                <option key={condition.value} value={condition.value}>
                                    {condition.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="mt-3 block">
                        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-faint">
                            설명 (선택)
                        </span>
                        <textarea
                            value={values.itemDescription}
                            onChange={(e) => patch({ itemDescription: e.target.value })}
                            rows={4}
                            placeholder="스크래치·슬리브 상태 등 사진으로 안 보이는 부분을 적어주세요"
                            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-line-strong"
                        />
                        <span className="mt-1 block text-[11.5px] text-faint">
                            비우거나 {AUCTION_POLICY.MIN_DESC_LENGTH}~{AUCTION_POLICY.MAX_DESC_LENGTH}자 · 지금{" "}
                            <span className="font-mono tabular-nums">{description.length}</span>자
                        </span>
                    </label>
                    <div className="mt-4">
                        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-faint">
                            매물 사진 (선택)
                        </span>
                        <ImagePicker
                            images={images}
                            onChange={setImages}
                            disabled={submit.isPending}
                            onBusyChange={setPickerBusy}
                        />
                    </div>
                </Section>

                <Section title="가격" hint="시작가·배송비·입찰 단위">
                    {editing && originalStartBidAmount !== undefined && (
                        <p className="mb-3 rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] text-muted">
                            지금 등록된 시작가와 배송비를 합치면 {formatWon(originalStartBidAmount)}입니다. 서버가 둘을
                            나눠서 알려주지 않아 다시 입력해야 합니다.
                        </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-3">
                        <NumberField
                            label="시작가"
                            value={values.startPrice}
                            onChange={(v) => patch({ startPrice: v })}
                            min={AUCTION_POLICY.MIN_START_PRICE}
                            step={100}
                            hint={`${AUCTION_POLICY.MIN_START_PRICE.toLocaleString("ko-KR")}원 이상`}
                        />
                        <NumberField
                            label="배송비"
                            value={values.shippingFee}
                            onChange={(v) => patch({ shippingFee: v })}
                            min={0}
                            step={100}
                            hint="무료면 0"
                        />
                        <NumberField
                            label="입찰 단위"
                            value={values.bidUnit}
                            onChange={(v) => patch({ bidUnit: v })}
                            min={AUCTION_POLICY.MIN_BID_UNIT}
                            step={100}
                            hint={`${AUCTION_POLICY.MIN_BID_UNIT.toLocaleString("ko-KR")}원 이상`}
                        />
                    </div>
                    <p className="mt-2 text-[12px] text-muted">
                        입찰은 시작가와 배송비를 합친 금액부터 시작합니다.
                    </p>
                </Section>

                <Section title="일정" hint="시작·마감과 자동 연장">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-faint">
                                시작 시각
                            </span>
                            <input
                                type="datetime-local"
                                value={values.startAt}
                                min={minStartAt}
                                step={AUCTION_POLICY.TIME_UNIT_MINUTES * 60}
                                onChange={(e) => patch({ startAt: e.target.value })}
                                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13.5px] outline-none focus:border-line-strong"
                            />
                            <span className="mt-1 block text-[11.5px] text-faint">
                                지금으로부터 {AUCTION_POLICY.MIN_START_LEAD_MINUTES}분 뒤부터
                            </span>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-faint">
                                마감 시각
                            </span>
                            <input
                                type="datetime-local"
                                value={values.endAt}
                                min={
                                    startAtDate === null
                                        ? minStartAt
                                        : toInputValue(addHours(startAtDate, AUCTION_POLICY.MIN_DURATION_HOURS))
                                }
                                step={AUCTION_POLICY.TIME_UNIT_MINUTES * 60}
                                onChange={(e) => patch({ endAt: e.target.value })}
                                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13.5px] outline-none focus:border-line-strong"
                            />
                            <span className="mt-1 block text-[11.5px] text-faint">
                                시작보다 최소 {AUCTION_POLICY.MIN_DURATION_HOURS}시간 뒤
                            </span>
                        </label>
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-[13.5px] font-semibold">
                        <input
                            type="checkbox"
                            checked={values.extensionEnabled}
                            onChange={(e) => patch({ extensionEnabled: e.target.checked })}
                        />
                        마감 직전 입찰이 들어오면 자동으로 연장
                    </label>
                    {values.extensionEnabled && (
                        <div className="mt-3 max-w-[220px]">
                            <NumberField
                                label="연장 시간 (분)"
                                value={values.extensionTime}
                                onChange={(v) => patch({ extensionTime: v })}
                                min={AUCTION_POLICY.MIN_EXTENSION_MINUTES}
                                step={1}
                                hint={`${AUCTION_POLICY.MIN_EXTENSION_MINUTES}분 이상`}
                            />
                        </div>
                    )}
                </Section>

                {errors.length > 0 && (
                    <div className="rounded-xl border border-live/30 bg-live-bg px-5 py-4">
                        <p className="font-semibold text-live">아래를 고쳐야 등록할 수 있습니다.</p>
                        <ul className="mt-2 list-disc pl-5 text-[13px] text-ink">
                            {errors.map((message) => (
                                <li key={message}>{message}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {serverError && (
                    <p className="rounded-xl border border-live/30 bg-live-bg px-5 py-4 font-semibold text-live">
                        {serverError}
                    </p>
                )}

                <div className="flex flex-wrap gap-2">
                    <button
                        type="submit"
                        disabled={submit.isPending || locked || pickerBusy}
                        className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-ink disabled:opacity-50"
                    >
                        {submit.isPending ? "저장 중…" : pickerBusy ? "사진 준비 중…" : editing ? "수정 저장" : "경매 등록"}
                    </button>
                    {editing && (
                        <button
                            type="button"
                            disabled={cancelAuction.isPending || locked}
                            onClick={() => {
                                if (window.confirm("이 경매를 취소할까요? 목록에서 사라집니다.")) {
                                    setServerError(null);
                                    cancelAuction.mutate();
                                }
                            }}
                            className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-bold text-live hover:border-live disabled:opacity-50"
                        >
                            경매 취소
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-line bg-surface px-5 py-4">
            <h2 className="text-[15px] font-bold">{title}</h2>
            <p className="mb-3 text-[12.5px] text-muted">{hint}</p>
            {children}
        </section>
    );
}

interface NumberFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    min: number;
    step: number;
    hint: string;
}

function NumberField({ label, value, onChange, min, step, hint }: NumberFieldProps) {
    return (
        <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-faint">{label}</span>
            <input
                type="number"
                inputMode="numeric"
                min={min}
                step={step}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={String(min)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-[13.5px] outline-none focus:border-line-strong"
            />
            <span className="mt-1 block text-[11.5px] text-faint">{hint}</span>
        </label>
    );
}
