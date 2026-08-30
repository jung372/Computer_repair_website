"use client";

import { ImagePlus, RotateCcw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type SelectedPhoto = { file: File; url: string; key: string };

export function MarketingJobForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<SelectedPhoto[]>([]);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [causeUnknown, setCauseUnknown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const totalBytes = useMemo(() => photos.reduce((sum, photo) => sum + photo.file.size, 0), [photos]);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    setError("");
    setPhotos((current) => {
      const next = [...current];
      for (const file of Array.from(files)) {
        if (![/^image\/jpeg$/, /^image\/png$/].some((pattern) => pattern.test(file.type))) {
          setError("JPEG 또는 PNG 사진만 선택할 수 있습니다.");
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          setError(`${file.name}: 사진 한 장은 8MB 이하여야 합니다.`);
          continue;
        }
        if (next.length >= 6) {
          setError("사진은 최대 6장까지 첨부할 수 있습니다.");
          break;
        }
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!next.some((photo) => photo.key === key)) next.push({ file, key, url: URL.createObjectURL(file) });
      }
      return next;
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function removePhoto(key: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((photo) => photo.key !== key);
    });
  }

  function resetAll() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([]);
    setCauseUnknown(false);
    setError("");
    formRef.current?.reset();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const data = new FormData(event.currentTarget);
      data.set("causeUnknown", String(causeUnknown));
      data.set("idempotencyKey", crypto.randomUUID());
      for (const photo of photos) data.append("photos", photo.file, photo.file.name);
      const response = await fetch("/api/admin/marketing/jobs", { method: "POST", body: data });
      const result = await response.json() as { jobId?: string; error?: string };
      if (!response.ok || !result.jobId) throw new Error(result.error || `요청 실패 (${response.status})`);
      router.push(`/admin/marketing?created=${encodeURIComponent(result.jobId)}`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "작업을 등록하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} className="marketing-intake" onSubmit={submit}>
      <section className="marketing-form-section">
        <header><span>01</span><div><h2>현장 사실 원장</h2><p>AI가 추정하면 안 되는 최소 사실을 기록합니다.</p></div></header>
        <div className="marketing-field-grid">
          <label className="wide"><span>접수 증상 <b>필수</b></span><textarea name="symptom" rows={4} required placeholder="예: 전원은 켜지지만 화면이 나오지 않음" /></label>
          <label><span>실제 서비스 지역 <b>필수</b></span><select name="district" required defaultValue="광진구"><option>광진구</option><option>성동구</option><option>동대문구</option></select></label>
          <label><span>기기·부품 정보</span><input name="deviceInfo" placeholder="예: 조립 PC, DDR4 메모리" /></label>
          <label className="wide"><span>확인된 원인 <b>필수</b></span><textarea name="diagnosedCause" rows={3} disabled={causeUnknown} required={!causeUnknown} placeholder="현장에서 확인한 원인만 입력" /></label>
          <label className="marketing-check wide"><input type="checkbox" checked={causeUnknown} onChange={(event) => setCauseUnknown(event.target.checked)} /><span><strong>원인 미확정</strong> — 원인을 추정하지 않고 확인된 증상과 조치만으로 작성</span></label>
          <label className="wide"><span>실제 조치 <b>필수</b></span><textarea name="actionsTaken" rows={4} required placeholder="예: 메모리 분리 후 접점 정리 및 재장착" /></label>
          <label className="wide"><span>조치 후 확인 결과 <b>필수</b></span><textarea name="verificationResult" rows={3} required placeholder="예: 3회 재부팅과 Windows 진입 정상 확인" /></label>
          <label><span>작업 시간</span><input name="workDuration" placeholder="예: 약 40분" /></label>
          <label><span>특이사항</span><input name="repairNotes" placeholder="입력된 내용만 현장 사실로 사용" /></label>
        </div>
      </section>

      <section className="marketing-form-section photo-bench">
        <header><span>02</span><div><h2>수리 사진</h2><p>서버 저장 전 위치정보·EXIF 메타데이터를 제거합니다.</p></div></header>
        <input ref={inputRef} className="visually-hidden" id="marketing-photos" type="file" accept="image/jpeg,image/png" multiple onChange={(event) => addPhotos(event.target.files)} />
        <label className="marketing-photo-drop" htmlFor="marketing-photos"><ImagePlus aria-hidden="true" /><strong>JPEG·PNG 사진 선택</strong><span>장당 8MB · 최대 6장</span></label>
        {photos.length > 0 && (
          <div className="marketing-photo-grid" aria-live="polite">
            {photos.map((photo, index) => (
              <article key={photo.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`선택한 수리 사진 ${index + 1}`} />
                <div><strong>{index + 1}. {photo.file.name}</strong><small>{(photo.file.size / 1024 / 1024).toFixed(1)} MB</small></div>
                <button type="button" onClick={() => removePhoto(photo.key)} aria-label={`${photo.file.name} 삭제`}><Trash2 size={16} /> 삭제</button>
              </article>
            ))}
          </div>
        )}
        <p className="photo-total">선택 {photos.length}/6장 · 합계 {(totalBytes / 1024 / 1024).toFixed(1)} MB</p>
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
        <button className="button secondary" type="button" onClick={resetAll} disabled={submitting}><RotateCcw size={17} /> 전체 초기화</button>
        <button className="button primary" type="submit" disabled={submitting}><Send size={17} /> {submitting ? "안전하게 등록 중…" : "서버 작업 등록"}</button>
      </footer>
    </form>
  );
}
