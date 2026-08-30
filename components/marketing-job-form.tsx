"use client";

import { Camera, ClipboardPaste, ImageDown, ImagePlus, RotateCcw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  compressMarketingPhoto,
  formatPhotoBytes,
  MAX_SOURCE_PHOTO_BYTES,
  PHOTO_COMPRESSION_PROFILES,
  PhotoCompressionProfileId,
} from "@/lib/logic/marketing-photo-compression";

type SelectedPhoto = {
  file: File;
  originalFile: File;
  url: string;
  key: string;
  originalBytes: number;
  uploadBytes: number;
  originalWidth: number;
  originalHeight: number;
  uploadWidth: number;
  uploadHeight: number;
  optimized: boolean;
};

const MAX_PHOTOS = 6;

export function MarketingJobForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<SelectedPhoto[]>([]);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [compressionProfile, setCompressionProfile] = useState<PhotoCompressionProfileId>("recommended");
  const [causeUnknown, setCauseUnknown] = useState(false);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const totalBytes = useMemo(() => photos.reduce((sum, photo) => sum + photo.uploadBytes, 0), [photos]);
  const totalOriginalBytes = useMemo(() => photos.reduce((sum, photo) => sum + photo.originalBytes, 0), [photos]);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  function replacePhotos(next: SelectedPhoto[]) {
    photosRef.current = next;
    setPhotos(next);
  }

  async function addPhotos(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    setError("");
    setProcessingPhotos(true);
    const working = [...photosRef.current];
    const errors: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (working.length >= MAX_PHOTOS) {
          errors.push(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
          break;
        }
        if (!isSupportedPhoto(file)) {
          errors.push(`${file.name}: 휴대폰 사진, JPEG, PNG 또는 WebP만 선택할 수 있습니다.`);
          continue;
        }
        if (file.size > MAX_SOURCE_PHOTO_BYTES) {
          errors.push(`${file.name}: 원본 사진 한 장은 30MB 이하여야 합니다.`);
          continue;
        }
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (working.some((photo) => photo.key === key)) continue;
        try {
          const result = await compressMarketingPhoto(file, compressionProfile);
          if (result.uploadBytes > 8 * 1024 * 1024) {
            throw new Error("최적화 후에도 8MB를 초과합니다. 데이터 절약 모드로 다시 선택해 주세요.");
          }
          working.push({
            file: result.uploadFile,
            originalFile: result.originalFile,
            key,
            url: URL.createObjectURL(result.uploadFile),
            originalBytes: result.originalBytes,
            uploadBytes: result.uploadBytes,
            originalWidth: result.originalWidth,
            originalHeight: result.originalHeight,
            uploadWidth: result.uploadWidth,
            uploadHeight: result.uploadHeight,
            optimized: result.optimized,
          });
        } catch (photoError) {
          errors.push(`${file.name}: ${photoError instanceof Error ? photoError.message : "사진을 처리하지 못했습니다."}`);
        }
      }
      replacePhotos(working);
      if (errors.length) setError(errors.join(" "));
    } finally {
      setProcessingPhotos(false);
      if (inputRef.current) inputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  async function changeCompressionProfile(profileId: PhotoCompressionProfileId) {
    setCompressionProfile(profileId);
    if (photosRef.current.length === 0) return;
    setProcessingPhotos(true);
    setError("");
    const previous = [...photosRef.current];
    try {
      const next: SelectedPhoto[] = [];
      for (const photo of previous) {
        const result = await compressMarketingPhoto(photo.originalFile, profileId);
        next.push({
          ...photo,
          file: result.uploadFile,
          url: URL.createObjectURL(result.uploadFile),
          originalBytes: result.originalBytes,
          uploadBytes: result.uploadBytes,
          originalWidth: result.originalWidth,
          originalHeight: result.originalHeight,
          uploadWidth: result.uploadWidth,
          uploadHeight: result.uploadHeight,
          optimized: result.optimized,
        });
      }
      previous.forEach((photo) => URL.revokeObjectURL(photo.url));
      replacePhotos(next);
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "사진 용량 설정을 바꾸지 못했습니다.");
    } finally {
      setProcessingPhotos(false);
    }
  }

  function removePhoto(key: string) {
    const target = photosRef.current.find((photo) => photo.key === key);
    if (target) URL.revokeObjectURL(target.url);
    replacePhotos(photosRef.current.filter((photo) => photo.key !== key));
  }

  function resetAll() {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    replacePhotos([]);
    setCompressionProfile("recommended");
    setCauseUnknown(false);
    setError("");
    formRef.current?.reset();
  }

  function handlePaste(event: ClipboardEvent<HTMLFormElement>) {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    event.preventDefault();
    void addPhotos(imageFiles);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    void addPhotos(event.dataTransfer.files);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (processingPhotos) {
      setError("사진 용량 조절이 끝난 뒤 다시 등록해 주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const data = new FormData(event.currentTarget);
      data.set("causeUnknown", String(causeUnknown));
      data.set("idempotencyKey", crypto.randomUUID());
      for (const photo of photosRef.current) data.append("photos", photo.file, photo.file.name);
      const response = await fetch("/api/admin/marketing/jobs", { method: "POST", body: data });
      const result = await response.json() as { jobId?: string; error?: string };
      if (!response.ok || !result.jobId) throw new Error(result.error || `요청 실패 (${response.status})`);
      router.push(`/admin/marketing?view=history&created=${encodeURIComponent(result.jobId)}`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "작업을 등록하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} className="marketing-intake" onSubmit={submit} onPaste={handlePaste} aria-busy={processingPhotos || submitting}>
      <section className="marketing-form-section">
        <header><span>01</span><div><h2>수리 결과 입력</h2><p>짧게 적어도 AI가 사실을 벗어나지 않고 수리일지로 확장합니다.</p></div></header>
        <div className="marketing-field-grid">
          <label className="wide"><span>접수 증상 <b>필수</b></span><textarea name="symptom" rows={4} required placeholder="예: 전원은 켜지지만 화면이 나오지 않음" /></label>
          <label><span>실제 서비스 지역 <b>필수</b></span><select name="district" required defaultValue="광진구"><option>광진구</option><option>성동구</option><option>동대문구</option></select></label>
          <label><span>기기·부품 정보</span><input name="deviceInfo" placeholder="예: 조립 PC, DDR4 메모리" /></label>
          <label className="wide"><span>확인된 원인 <b>필수</b></span><textarea name="diagnosedCause" rows={3} disabled={causeUnknown} required={!causeUnknown} placeholder="현장에서 확인한 원인만 입력" /></label>
          <label className="marketing-check wide"><input type="checkbox" checked={causeUnknown} onChange={(event) => setCauseUnknown(event.target.checked)} /><span><strong>원인 미확정</strong> — 원인을 추정하지 않고 확인된 증상과 조치만으로 작성</span></label>
          <label className="wide"><span>실제 조치 <b>필수</b></span><textarea name="actionsTaken" rows={4} required placeholder="예: 메모리 분리 후 접점 정리 및 재장착" /></label>
          <label className="wide"><span>조치 후 수리 결과 <b>필수</b></span><textarea name="verificationResult" rows={3} required placeholder="예: 3회 재부팅과 Windows 진입 정상 확인" /></label>
          <label><span>작업 시간</span><input name="workDuration" placeholder="예: 약 40분" /></label>
          <label><span>특이사항</span><input name="repairNotes" placeholder="입력된 내용만 현장 사실로 사용" /></label>
        </div>
      </section>

      <section className="marketing-form-section photo-bench">
        <header><span>02</span><div><h2>현장 사진 업로드</h2><p>휴대폰 사진은 선택한 용량으로 줄인 뒤 위치정보·EXIF를 제거해 저장합니다.</p></div></header>
        <fieldset className="photo-compression-settings" disabled={processingPhotos}>
          <legend><ImageDown size={18} aria-hidden="true" /><span><strong>휴대폰 사진 용량</strong><small>이미 올린 사진도 설정을 바꾸면 다시 최적화됩니다.</small></span></legend>
          <div>
            {Object.values(PHOTO_COMPRESSION_PROFILES).map((profile) => (
              <label key={profile.id} className={compressionProfile === profile.id ? "selected" : ""}>
                <input type="radio" name="photoCompressionProfile" value={profile.id} checked={compressionProfile === profile.id} onChange={() => void changeCompressionProfile(profile.id)} />
                <strong>{profile.label}</strong>
                <span>긴 변 {profile.maxDimension}px · 장당 약 {formatPhotoBytes(profile.targetBytes)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <input ref={inputRef} className="visually-hidden" id="marketing-photos" type="file" accept="image/*" multiple disabled={processingPhotos} onChange={(event) => void addPhotos(event.target.files)} />
        <input ref={cameraInputRef} className="visually-hidden" id="marketing-camera" type="file" accept="image/*" capture="environment" disabled={processingPhotos} onChange={(event) => void addPhotos(event.target.files)} />
        <label className="marketing-photo-drop" htmlFor="marketing-photos" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
          <ImagePlus aria-hidden="true" /><strong>{processingPhotos ? "사진 용량 조절 중…" : "사진 선택·끌어놓기"}</strong><span>클립보드 붙여넣기도 가능 · 원본 장당 최대 30MB · 최대 6장</span>
        </label>
        <div className="photo-source-actions">
          <label className="button secondary" htmlFor="marketing-camera" aria-disabled={processingPhotos}><Camera size={17} aria-hidden="true" /> 지금 촬영</label>
          <span><ClipboardPaste size={16} aria-hidden="true" /> 복사한 사진은 이 화면에서 바로 붙여넣으세요.</span>
        </div>
        {photos.length > 0 && (
          <div className="marketing-photo-grid" aria-live="polite">
            {photos.map((photo, index) => {
              const saving = photo.originalBytes > 0 ? Math.max(0, Math.round((1 - photo.uploadBytes / photo.originalBytes) * 100)) : 0;
              return (
                <article key={photo.key} data-original-size={`${photo.originalWidth}x${photo.originalHeight}`} data-upload-size={`${photo.uploadWidth}x${photo.uploadHeight}`} data-upload-bytes={photo.uploadBytes}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`선택한 수리 사진 ${index + 1}`} />
                  <div>
                    <strong>{index + 1}. {photo.originalFile.name}</strong>
                    <small>원본 {formatPhotoBytes(photo.originalBytes)} → 업로드 {formatPhotoBytes(photo.uploadBytes)}</small>
                    <small>{photo.originalWidth}×{photo.originalHeight} → {photo.uploadWidth}×{photo.uploadHeight}{photo.optimized ? ` · ${saving}% 절감` : " · 최적화 불필요"}</small>
                  </div>
                  <button type="button" onClick={() => removePhoto(photo.key)} aria-label={`${photo.originalFile.name} 삭제`} disabled={processingPhotos}><Trash2 size={16} /> 삭제</button>
                </article>
              );
            })}
          </div>
        )}
        <p className="photo-total">선택 {photos.length}/{MAX_PHOTOS}장 · 원본 {formatPhotoBytes(totalOriginalBytes)} → 업로드 {formatPhotoBytes(totalBytes)}</p>
        <div className="marketing-consent-box">
          <ShieldCheck aria-hidden="true" />
          <div>
            <label className="marketing-check"><input name="photoConsent" type="checkbox" required={photos.length > 0} /><span>사진의 블로그 공개 동의를 확인했습니다.</span></label>
            <label className="marketing-check"><input name="privacyReviewed" type="checkbox" required={photos.length > 0} /><span>얼굴·전화번호·주소·시리얼번호가 보이지 않도록 비식별 처리된 사진입니다.</span></label>
            <label><span>동의·비식별 확인 메모</span><input name="photoEvidenceNote" placeholder="예: 고객 구두 동의, 제품 라벨 가림 확인" /></label>
          </div>
        </div>
      </section>

      {error && <p className="marketing-form-message error" role="alert">{error}</p>}
      <footer className="marketing-form-actions">
        <button className="button secondary" type="button" onClick={resetAll} disabled={submitting || processingPhotos}><RotateCcw size={17} /> 전체 초기화</button>
        <button className="button primary" type="submit" disabled={submitting || processingPhotos}><Send size={17} /> {submitting ? "안전하게 등록 중…" : processingPhotos ? "사진 처리 중…" : "AI 수리일지 생성 요청"}</button>
      </footer>
    </form>
  );
}

function isSupportedPhoto(file: File) {
  if (["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type.toLowerCase())) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}
