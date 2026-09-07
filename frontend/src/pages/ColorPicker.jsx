import { useEffect, useMemo, useRef, useState } from "react";
import { useColorData } from "../hooks/useColorData";
import VendorSelector from "../components/VendorSelector";
import OptionSelector from "../components/OptionSelector";
import ColorSwatch from "../components/ColorSwatch";
import { findClosestThreads } from "../utils/colorMatch";
import { extractDominantColors } from "../utils/dominantColors";
import { generateId } from "../utils/color";

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const MATCHES_PER_PICK = 3;
const AUTO_DETECT_COUNT = 8;

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgbTriplet(hex) {
  const n = hex.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

/**
 * Upload an image, click it to sample pixel colors, and see the closest
 * matching thread (with its PMS value) from a chosen vendor's thread
 * chart for each sampled color — e.g. a customer sends a logo mockup and
 * you want to know which 4imprint / Isacord 40 thread to embroider it in.
 */
export default function ColorPicker() {
  const { records, status } = useColorData();
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const scrollRef = useRef(null);

  const [imageUrl, setImageUrl] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);
  // Scale that fits the image's full width inside the card on load, so a
  // large photo doesn't blow out the layout or require scrolling just to
  // see the whole thing. `zoom` is a multiplier applied on top of this.
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [picks, setPicks] = useState([]);
  const [vendor, setVendor] = useState("");
  const [threadBrand, setThreadBrand] = useState("");
  const [eyedropperBusy, setEyedropperBusy] = useState(false);

  const eyedropperSupported = typeof window !== "undefined" && "EyeDropper" in window;

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const vendors = useMemo(
    () => [...new Set(records.map((r) => r.vendor))].sort((a, b) => a.localeCompare(b)),
    [records]
  );
  const vendorRecords = useMemo(
    () => (vendor ? records.filter((r) => r.vendor === vendor) : []),
    [records, vendor]
  );
  const threadBrands = useMemo(
    () => [...new Set(vendorRecords.map((r) => r.threadBrand))].sort((a, b) => a.localeCompare(b)),
    [vendorRecords]
  );
  const scopedRecords = useMemo(
    () => (threadBrand ? vendorRecords.filter((r) => r.threadBrand === threadBrand) : vendorRecords),
    [vendorRecords, threadBrand]
  );
  const readyToMatch = Boolean(vendor && threadBrand);

  function drawImage() {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setImageLoaded(false);
    setPicks([]);
    setZoom(1);
  }

  function handleImgLoad() {
    drawImage();
    const canvas = canvasRef.current;
    const containerWidth = scrollRef.current?.clientWidth;
    if (canvas && containerWidth) {
      // Never upscale a small image past its native size, only shrink a
      // large one down to fit — matches "fix inside the card" while still
      // showing small images at their real resolution.
      setBaseScale(Math.min(1, containerWidth / canvas.width));
    }
    setImageLoaded(true);
  }

  function addPick(hex, r, g, b, x, y) {
    setPicks((prev) => [...prev, { id: generateId(), hex, r, g, b, x, y }]);
  }

  function handleCanvasClick(e) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
    const [r, g, b] = canvas.getContext("2d").getImageData(x, y, 1, 1).data;
    addPick(rgbToHex(r, g, b), r, g, b, x, y);
  }

  async function handleEyedropper() {
    if (!eyedropperSupported) return;
    setEyedropperBusy(true);
    try {
      // eslint-disable-next-line no-undef -- feature-detected above
      const dropper = new window.EyeDropper();
      const result = await dropper.open();
      const { r, g, b } = hexToRgbTriplet(result.sRGBHex);
      addPick(result.sRGBHex, r, g, b, null, null);
    } catch {
      // user pressed Escape / cancelled — not an error
    } finally {
      setEyedropperBusy(false);
    }
  }

  // Replaces the palette with the image's own dominant colors — a fresh
  // detection each time, rather than appending, so re-running it (e.g.
  // after zooming) gives a clean result instead of a growing duplicate
  // list. Manual clicks and the eyedropper still add on top afterward.
  function handleAutoDetect() {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;
    const imageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    const dominant = extractDominantColors(imageData, { count: AUTO_DETECT_COUNT });
    setPicks(dominant.map(({ hex, r, g, b }) => ({ id: generateId(), hex, r, g, b, x: null, y: null })));
  }

  function removePick(id) {
    setPicks((prev) => prev.filter((p) => p.id !== id));
  }

  function clearPicks() {
    setPicks([]);
  }

  function resetAll() {
    setPicks([]);
    setZoom(1);
  }

  function changeImage() {
    fileInputRef.current?.click();
  }

  return (
    <div className="page color-picker-page">
      <header className="page-header">
        <h1>Color Picker</h1>
        <p>Upload a customer's image, pick colors from it, and find the closest matching thread.</p>
      </header>

      <div className="color-picker-layout">
        <section className="color-picker-image-panel">
          <div className="color-picker-image-panel__toolbar">
            <span className="color-picker-image-panel__title">
              {imageUrl ? "Uploaded Image" : "No image yet"}
            </span>
            {imageUrl && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={changeImage}>
                Change Image
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
          />

          {!imageUrl && (
            <div className="color-picker-dropzone">
              <p>Upload a product photo, logo, or mockup to sample colors from it.</p>
              <button type="button" className="btn btn--primary" onClick={changeImage}>
                Upload Image
              </button>
            </div>
          )}

          {imageUrl && (
            <>
              <div className="color-picker-canvas-scroll" ref={scrollRef}>
                <div className="color-picker-canvas-wrap">
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative source for canvas, never shown itself */}
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    onLoad={handleImgLoad}
                    style={{ display: "none" }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="color-picker-canvas"
                    style={
                      imageLoaded
                        ? {
                            width: canvasRef.current.width * baseScale * zoom,
                            height: canvasRef.current.height * baseScale * zoom,
                          }
                        : undefined
                    }
                    onClick={handleCanvasClick}
                  />
                  {imageLoaded &&
                    picks
                      .filter((p) => p.x !== null)
                      .map((p, i) => (
                        <span
                          key={p.id}
                          className="color-picker-marker"
                          style={{
                            left: `${(p.x / canvasRef.current.width) * 100}%`,
                            top: `${(p.y / canvasRef.current.height) * 100}%`,
                          }}
                          title={`${i + 1}: ${p.hex}`}
                        >
                          {i + 1}
                        </span>
                      ))}
                </div>
              </div>
              <p className="color-picker-hint">
                Click anywhere on the image to add its color, or use Auto-Detect Colors to find the main colors
                automatically.
              </p>

              <div className="color-picker-toolbar">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={handleAutoDetect}
                  disabled={!imageLoaded}
                  title="Replace the palette with this image's dominant colors"
                >
                  Auto-Detect Colors
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleEyedropper}
                  disabled={!eyedropperSupported || eyedropperBusy}
                  title={eyedropperSupported ? "Pick a color from anywhere on screen" : "Not supported in this browser"}
                >
                  Eyedropper
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
                  disabled={zoom >= MAX_ZOOM}
                >
                  Zoom In
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
                  disabled={zoom <= MIN_ZOOM}
                >
                  Zoom Out
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={resetAll}>
                  Reset
                </button>
              </div>
            </>
          )}
        </section>

        <section className="color-picker-palette-panel">
          <div className="color-picker-palette-panel__header">
            <h2>
              Picked Palette <span className="color-picker-palette-panel__count">{picks.length} colors</span>
            </h2>
            {picks.length > 0 && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={clearPicks}>
                Clear all
              </button>
            )}
          </div>

          <div className="color-picker-vendor-controls">
            {status === "ready" && (
              <>
                <VendorSelector
                  vendors={vendors}
                  value={vendor}
                  onChange={(v) => {
                    setVendor(v);
                    setThreadBrand("");
                  }}
                />
                <OptionSelector
                  id="color-picker-thread-chart"
                  label="Thread Chart"
                  allLabel="Select a thread chart..."
                  options={threadBrands}
                  value={threadBrand}
                  onChange={setThreadBrand}
                  disabled={!vendor}
                />
              </>
            )}
          </div>
          {!readyToMatch && (
            <p className="state-msg">Select a vendor and thread chart above to match picked colors to threads.</p>
          )}

          {picks.length === 0 && (
            <p className="color-picker-empty">No colors picked yet. Click the image to add one.</p>
          )}

          <ul className="color-picker-palette-list">
            {picks.map((pick, index) => {
              const matches = readyToMatch ? findClosestThreads(pick.hex, scopedRecords, MATCHES_PER_PICK) : [];
              return (
                <li className="color-picker-pick" key={pick.id}>
                  <div className="color-picker-pick__header">
                    <span className="color-picker-pick__index">{index + 1}</span>
                    <ColorSwatch hex={pick.hex} label="Selected color" sublabel={pick.hex.toUpperCase()} />
                    <span className="color-picker-pick__rgb">
                      RGB {pick.r}, {pick.g}, {pick.b}
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm color-picker-pick__remove"
                      onClick={() => removePick(pick.id)}
                      aria-label={`Remove picked color ${index + 1}`}
                    >
                      ✕
                    </button>
                  </div>

                  {readyToMatch && (
                    <div className="color-picker-pick__matches">
                      <span className="color-picker-pick__matches-label">Closest thread matches</span>
                      {matches.length === 0 && (
                        <p className="color-picker-empty color-picker-empty--sm">
                          No threads with a recorded color in this chart.
                        </p>
                      )}
                      <div className="color-picker-pick__matches-list">
                        {matches.map(({ record, distance }) => (
                          <div className="color-picker-match" key={record.id} title={`Distance: ${distance.toFixed(1)}`}>
                            <ColorSwatch
                              hex={record.threadHex}
                              label={record.threadColorName || record.threadCode}
                              sublabel={`${record.threadCode}${record.pmsCode ? ` · PMS ${record.pmsCode}` : ""}`}
                              size="sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
