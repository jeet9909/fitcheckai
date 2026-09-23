import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState } from '../state/AppState';
import { setTryOnDraft } from '../lib/tryOnDraft';

/**
 * ONE PHOTO. This replaces the old 3-step form (photo + height/weight +
 * two consent checkboxes) that the audit flagged as the single biggest
 * leak: the largest ask in the whole product, arriving before any value
 * had been shown. Height/weight now live behind an optional "improve
 * accuracy" prompt AFTER the first render, not here.
 */
export default function Setup() {
  const navigate = useNavigate();
  const location = useLocation();
  const setupState = location.state as { sourceLink?: string | null; productId?: number | null } | null;
  const sourceLink = setupState?.sourceLink ?? null;
  const productId = setupState?.productId ?? null;
  const { markProfileSetupDone, products } = useAppState();
  const [preview, setPreview] = useState<string | null>(null);
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [productLink, setProductLink] = useState(sourceLink ?? '');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [fitSize, setFitSize] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const productInput = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_FILE_BYTES = 10 * 1000 * 1000;
  const selectedProduct = productId != null ? products.find((product) => product.id === productId) ?? null : null;
  const catalogImageUrl = selectedProduct?.imageUrl;
  const catalogPageUrl = selectedProduct?.productUrl;
  const hasProductSource = Boolean(productFile || catalogImageUrl || catalogPageUrl || productLink.trim());

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Please choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('That photo is over 10 MB — please choose a smaller file.');
      return;
    }
    setFileError(null);
    setPersonFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onProductFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_BYTES) {
      setFileError('Product image must be JPG, PNG, or WebP and no larger than 10 MB.');
      return;
    }
    setFileError(null);
    setProductFile(file);
    setProductLink('');
    const reader = new FileReader();
    reader.onload = () => setProductPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    onFile(event.dataTransfer.files?.[0]);
  };

  const submitSetup = () => {
    if (!personFile || !hasProductSource) return;
    setTryOnDraft({
      personImage: personFile,
      productImage: productFile ?? undefined,
      productImageUrl: productFile ? undefined : catalogImageUrl,
      productPageUrl: productFile || catalogImageUrl ? undefined : (catalogPageUrl || productLink.trim() || undefined),
      category: selectedProduct?.category || selectedProduct?.slot || 'clothing',
    });
    markProfileSetupDone();
    navigate('/processing', { state: { afterRoute: '/result', sourceLink, productId } });
  };

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '32px 24px 100px' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 12.5, padding: 0, marginBottom: 18, cursor: 'pointer' }}>
        ← Back
      </button>
      <h1 className="display" style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Upload a clear full-body photo</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
        For the best result, use a front-facing photo with good lighting and your full body visible.
      </p>

      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" capture="user" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={productInput} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => onProductFile(e.target.files?.[0])} />

      <div
        onClick={() => fileInput.current?.click()}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          aspectRatio: '3/5', borderRadius: 16,
          border: preview ? '1px solid var(--border)' : isDragActive ? '2px dashed var(--teal)' : '2px dashed var(--border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: preview ? `center/cover no-repeat url(${preview})` : isDragActive ? 'var(--teal-soft)' : 'var(--surface-alt)',
          cursor: 'pointer', marginBottom: fileError ? 6 : 18, position: 'relative', overflow: 'hidden',
        }}
      >
        {!preview && (
          <>
            <span style={{ fontSize: 30, color: 'var(--ink-faint)' }}>+</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-faint)', marginTop: 6, textAlign: 'center', padding: '0 20px' }}>
              Drop a photo here, or choose a file
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>JPG, PNG or WebP, up to 10 MB</span>
          </>
        )}
      </div>
      {fileError && (
        <p role="alert" style={{ fontSize: 12, color: 'var(--red)', margin: '0 0 18px' }}>
          {fileError}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => fileInput.current?.click()} className="fc-btn-secondary" style={{ flex: 1 }}>
          {preview ? 'Retake' : 'Take photo'}
        </button>
      </div>

      <section style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 5px' }}>Product to try on</h2>
        {selectedProduct && (catalogImageUrl || catalogPageUrl) ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {(catalogImageUrl || productPreview) && <img src={productPreview || catalogImageUrl} alt="Selected product" style={{ width: 64, height: 76, borderRadius: 9, objectFit: 'cover', border: '1px solid var(--border)' }} />}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedProduct.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 3 }}>{selectedProduct.store}</div>
            </div>
          </div>
        ) : productPreview ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img src={productPreview} alt="Uploaded product" style={{ width: 64, height: 76, borderRadius: 9, objectFit: 'cover', border: '1px solid var(--border)' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Product image ready</span>
          </div>
        ) : (
          <>
            <input value={productLink} onChange={(event) => setProductLink(event.target.value)} placeholder="Paste Amazon, Myntra, Flipkart or product image URL" style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, marginBottom: 10 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>or</span>
              <button type="button" onClick={() => productInput.current?.click()} className="fc-btn-secondary" style={{ flex: 1 }}>Upload product image</button>
            </div>
          </>
        )}
        {(selectedProduct || productPreview) && (
          <button type="button" onClick={() => { setProductFile(null); setProductPreview(null); setProductLink(''); productInput.current?.click(); }} style={{ border: 0, background: 'none', color: 'var(--accent-dark)', fontSize: 12, fontWeight: 600, padding: '10px 0 0', cursor: 'pointer' }}>Use another product image</button>
        )}
      </section>

      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', margin: '0 0 10px' }}>
        Optional, and it helps the fit estimate
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)' }}>
          Height
          <input
            type="text"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="5 ft 9 in"
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13.5 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)' }}>
          Weight
          <input
            type="text"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="68 kg"
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13.5 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)' }}>
          A size that already fits you well
          <input
            type="text"
            value={fitSize}
            onChange={(e) => setFitSize(e.target.value)}
            placeholder="Roadster M"
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13.5 }}
          />
        </label>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', margin: '0 0 8px' }}>What works best</h2>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li style={{ fontSize: 12.5, color: 'var(--ink-soft)', display: 'flex', gap: 6 }}>
            <span aria-hidden="true">✓</span> Standing straight, facing the camera
          </li>
          <li style={{ fontSize: 12.5, color: 'var(--ink-soft)', display: 'flex', gap: 6 }}>
            <span aria-hidden="true">✓</span> Full body in frame, head to feet
          </li>
          <li style={{ fontSize: 12.5, color: 'var(--ink-soft)', display: 'flex', gap: 6 }}>
            <span aria-hidden="true">✓</span> Plain background and even light
          </li>
          <li style={{ fontSize: 12.5, color: 'var(--ink-faint)', display: 'flex', gap: 6 }}>
            <span aria-hidden="true">✕</span> Heavy shadows, group photos, or a cropped body
          </li>
        </ul>
      </div>

      <div style={{ border: '1px solid var(--teal)', background: 'var(--teal-soft)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: 'var(--teal)', lineHeight: 1.55, margin: 0 }}>
          Your photo and generated result are saved in your private anonymous gallery. Keep this browser's session token to access them. Never shown to other shoppers.{' '}
          <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontWeight: 700, padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
            Details
          </button>
        </p>
      </div>

      <button onClick={submitSetup} disabled={!preview || !hasProductSource} className="fc-btn-primary" style={{ opacity: preview && hasProductSource ? 1 : 0.45 }}>
        Create my try-on
      </button>
      <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', textAlign: 'center', margin: '8px 0 0' }}>
        Gemini generation can take up to two minutes.
      </p>
    </main>
  );
}
