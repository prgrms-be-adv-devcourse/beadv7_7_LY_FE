import { useRef, useState } from "react";

// 사진 실물은 S3에 올라가고 DB에는 주소만 저장된다.
// 여기서는 사진을 줄여서 들고 있다가, 폼 제출 때 서명된 주소를 받아 S3로 직접 올린다.
const MAX_EDGE_PX = 720;
const JPEG_QUALITY = 0.7;
// 서버는 5장까지 받지만, 상세 화면 레이아웃 기준으로 3장으로 묶어둔다
export const MAX_ITEM_IMAGES = 3;
// 줄이기 전에 거르는 크기. 이보다 큰 파일은 브라우저가 여는 동안 화면이 멈춘다
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

// 폼이 들고 있는 사진 한 장의 상태
export type PickedImage =
    | { kind: "remote"; url: string } // 이미 서버에 있는 사진 (수정 화면의 기존 사진)
    | { kind: "local"; blob: Blob; preview: string }; // 이번에 고른 사진 (아직 업로드 전)

async function shrinkToBlob(file: File): Promise<PickedImage> {
    // imageOrientation을 지정해야 세로로 찍은 사진이 눕지 않는다
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) {
        bitmap.close();
        throw new Error("브라우저가 이미지를 처리하지 못했습니다.");
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (blob === null) throw new Error("브라우저가 이미지를 변환하지 못했습니다.");
    return { kind: "local", blob, preview: URL.createObjectURL(blob) };
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface ImagePickerProps {
    images: PickedImage[];
    onChange: (images: PickedImage[]) => void;
}

export function ImagePicker({ images, onChange }: ImagePickerProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<string | null>(null);

    const remaining = MAX_ITEM_IMAGES - images.length;

    async function addFiles(files: FileList) {
        setBusy(true);
        setError(null);
        const added: PickedImage[] = [];
        let sourceBytes = 0;
        let resultBytes = 0;

        try {
            for (const file of Array.from(files).slice(0, remaining)) {
                if (!file.type.startsWith("image/")) {
                    setError(`${file.name}은(는) 이미지 파일이 아닙니다.`);
                    continue;
                }
                if (file.size > MAX_SOURCE_BYTES) {
                    setError(`${file.name}이(가) 너무 큽니다 (${formatBytes(file.size)}). ${formatBytes(MAX_SOURCE_BYTES)} 이하로 골라주세요.`);
                    continue;
                }
                const picked = await shrinkToBlob(file);
                added.push(picked);
                sourceBytes += file.size;
                resultBytes += picked.kind === "local" ? picked.blob.size : 0;
            }
            if (added.length > 0) {
                onChange([...images, ...added]);
                setReport(`${formatBytes(sourceBytes)} → ${formatBytes(resultBytes)}로 줄여 담았습니다.`);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "사진을 처리하지 못했습니다.");
        } finally {
            setBusy(false);
            // 같은 파일을 다시 고를 수 있게 입력값을 비운다
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    function removeAt(index: number) {
        const target = images[index];
        // 미리보기용으로 잡아둔 브라우저 메모리를 돌려준다
        if (target.kind === "local") URL.revokeObjectURL(target.preview);
        onChange(images.filter((_, i) => i !== index));
        setReport(null);
    }

    return (
        <div>
            <div className="flex flex-wrap gap-2.5">
                {images.map((image, index) => (
                    <div key={index} className="relative">
                        <img
                            src={image.kind === "remote" ? image.url : image.preview}
                            alt={`매물 사진 ${index + 1}`}
                            className="h-24 w-24 rounded-lg border border-line object-cover"
                        />
                        <button
                            type="button"
                            onClick={() => removeAt(index)}
                            aria-label={`매물 사진 ${index + 1} 빼기`}
                            className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border border-line bg-surface text-[13px] font-bold text-muted shadow-sm hover:border-live hover:text-live"
                        >
                            ×
                        </button>
                    </div>
                ))}
                {remaining > 0 && (
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={busy}
                        className="grid h-24 w-24 place-items-center rounded-lg border border-dashed border-line-strong bg-paper text-[12px] font-semibold text-muted hover:border-brand hover:text-brand disabled:opacity-50"
                    >
                        {busy ? "줄이는 중…" : `＋ 사진 추가`}
                    </button>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) void addFiles(e.target.files);
                }}
            />

            <p className="mt-2 text-[12px] text-muted">
                최대 {MAX_ITEM_IMAGES}장 · 큰 사진은 자동으로 줄여서 올라갑니다.
                {images.length > 0 && ` (지금 ${images.length}장)`}
            </p>
            {report && <p className="mt-1 text-[12px] text-up">{report}</p>}
            {error && <p className="mt-1 text-[12px] font-semibold text-live">{error}</p>}
        </div>
    );
}
