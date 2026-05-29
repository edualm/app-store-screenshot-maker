import { ChangeEvent, PointerEvent, useMemo, useRef, useState } from "react";

type DeviceKey = "iphone" | "ipadPortrait" | "ipadLandscape" | "mac" | "watch";
type BackgroundMode = "solid" | "gradient" | "image";
type BackgroundFit = "cover" | "contain" | "stretch";
type ScreenshotFit = "cover" | "contain" | "exact";
type Layer = "screenshot" | "text" | "frame";
type FontFamily =
  | "sf-pro-display"
  | "sf-pro-text"
  | "sf-compact"
  | "sf-mono"
  | "new-york"
  | "inter"
  | "system"
  | "arial"
  | "helvetica"
  | "georgia"
  | "times"
  | "courier";

type Rect = { x: number; y: number; width: number; height: number };
type DragState = {
  layer: Layer;
  clientX: number;
  clientY: number;
  originX: number;
  originY: number;
  screenshotOriginX: number | null;
  screenshotOriginY: number | null;
  width: number;
  height: number;
  snapX: boolean;
  snapY: boolean;
};

type DevicePreset = {
  key: DeviceKey;
  label: string;
  width: number;
  height: number;
  frameSrc: string;
  assetSize: { width: number; height: number };
  frameRect: Rect;
  screenMask: Rect & { radius: number };
  screenshotTarget?: Rect;
  screenshotFit: ScreenshotFit;
};

type ImageLayer = {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

type ScreenshotPlacement = {
  offsetX: number;
  offsetY: number;
};

type BackgroundState = {
  mode: BackgroundMode;
  color: string;
  gradient: string;
  imageSrc: string | null;
  imageFit: BackgroundFit;
};

type TextState = {
  content: string;
  fontFamily: FontFamily;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  color: string;
  accent: string;
  align: CanvasTextAlign;
  subtextContent: string;
  subtextFontFamily: FontFamily;
  subtextFontSize: number;
  subtextLineHeight: number;
  subtextColor: string;
  subtextGap: number;
};

type TextRenderOptions = {
  width: number;
  fontFamily: FontFamily;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
  color: string;
  accent: string;
  align: CanvasTextAlign;
};

type RichSegment = {
  text: string;
  bold: boolean;
  italic: boolean;
  accent: boolean;
};

type FrameState = {
  enabled: boolean;
  x: number;
  y: number;
  scale: number;
};

type SettingsFile = {
  version: 1;
  deviceKey: DeviceKey;
  background: BackgroundState;
  text: TextState;
  frame: FrameState;
  screenshotScale: number | null;
  screenshotPlacement: ScreenshotPlacement | null;
  showMask: boolean;
};

const PRESETS: Record<DeviceKey, DevicePreset> = {
  iphone: {
    key: "iphone",
    label: "iPhone",
    width: 1284,
    height: 2778,
    frameSrc: "/frames/iphone.webp",
    assetSize: { width: 1470, height: 3000 },
    frameRect: { x: 172, y: 680, width: 940, height: 1918 },
    screenMask: { x: 75, y: 66, width: 1320, height: 2868, radius: 118 },
    screenshotFit: "cover",
  },
  ipadPortrait: {
    key: "ipadPortrait",
    label: "iPad Portrait",
    width: 2048,
    height: 2732,
    frameSrc: "/frames/ipad.webp",
    assetSize: { width: 928, height: 1303 },
    frameRect: { x: 392, y: 740, width: 1264, height: 1775 },
    screenMask: { x: 46, y: 46, width: 835, height: 1212, radius: 32 },
    screenshotFit: "exact",
  },
  ipadLandscape: {
    key: "ipadLandscape",
    label: "iPad Landscape",
    width: 2732,
    height: 2048,
    frameSrc: "/frames/ipad-landscape.webp",
    assetSize: { width: 1470, height: 1126 },
    frameRect: { x: 360, y: 530, width: 2010, height: 1540 },
    screenMask: { x: 46, y: 47, width: 1376, height: 1032, radius: 28 },
    screenshotFit: "exact",
  },
  mac: {
    key: "mac",
    label: "Mac",
    width: 2560,
    height: 1600,
    frameSrc: "/frames/mac.webp",
    assetSize: { width: 3207, height: 1942 },
    frameRect: { x: 180, y: 330, width: 2200, height: 1332 },
    screenMask: { x: 325, y: 66, width: 2560, height: 1664, radius: 20 },
    screenshotTarget: { x: 325, y: 98, width: 2560, height: 1600 },
    screenshotFit: "contain",
  },
  watch: {
    key: "watch",
    label: "Apple Watch",
    width: 422,
    height: 514,
    frameSrc: "/frames/watch.webp",
    assetSize: { width: 500, height: 780 },
    frameRect: { x: 41, y: -8, width: 340, height: 530 },
    screenMask: { x: 63, y: 167, width: 374, height: 446, radius: 62 },
    screenshotFit: "cover",
  },
};

const DEFAULT_BACKGROUND: BackgroundState = {
  mode: "gradient",
  color: "#f4c7a1",
  gradient: "linear-gradient(145deg, #ffe1c7 0%, #e99879 52%, #7f6dff 100%)",
  imageSrc: null,
  imageFit: "cover",
};

const FONT_OPTIONS: { label: string; value: FontFamily; stack: string }[] = [
  {
    label: "SF Pro Display",
    value: "sf-pro-display",
    stack:
      '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    label: "SF Pro Text",
    value: "sf-pro-text",
    stack:
      '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    label: "SF Compact",
    value: "sf-compact",
    stack:
      '"SF Compact Display", "SF Compact Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    label: "SF Mono",
    value: "sf-mono",
    stack:
      '"SF Mono", "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, monospace',
  },
  {
    label: "New York",
    value: "new-york",
    stack: '"New York", "Times New Roman", Times, serif',
  },
  { label: "Inter", value: "inter", stack: "Inter, Arial, sans-serif" },
  {
    label: "System",
    value: "system",
    stack:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  { label: "Arial", value: "arial", stack: "Arial, sans-serif" },
  {
    label: "Helvetica",
    value: "helvetica",
    stack: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  { label: "Georgia", value: "georgia", stack: "Georgia, serif" },
  { label: "Times", value: "times", stack: '"Times New Roman", Times, serif' },
  {
    label: "Courier",
    value: "courier",
    stack: '"Courier New", Courier, monospace',
  },
];

const DEFAULT_TEXT: TextState = {
  content: "Show your app\nwith _*style*_",
  fontFamily: "sf-pro-display",
  x: 120,
  y: 168,
  width: 1044,
  fontSize: 106,
  lineHeight: 1.08,
  color: "#251812",
  accent: "#b95f45",
  align: "center",
  subtextContent: "Designed for every screen",
  subtextFontFamily: "sf-pro-text",
  subtextFontSize: 42,
  subtextLineHeight: 1.2,
  subtextColor: "#5e463d",
  subtextGap: 28,
};

const SNAP_DISTANCE = 12;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function App() {
  const [deviceKey, setDeviceKey] = useState<DeviceKey>("iphone");
  const [background, setBackground] =
    useState<BackgroundState>(DEFAULT_BACKGROUND);
  const [screenshot, setScreenshot] = useState<ImageLayer | null>(null);
  const [screenshotScale, setScreenshotScale] = useState<number | null>(null);
  const [screenshotPlacement, setScreenshotPlacement] =
    useState<ScreenshotPlacement | null>(null);
  const [text, setText] = useState<TextState>(DEFAULT_TEXT);
  const [frame, setFrame] = useState<FrameState>({
    enabled: true,
    x: 0,
    y: 0,
    scale: 1,
  });
  const [showMask, setShowMask] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const preset = PRESETS[deviceKey];
  const previewScale = useMemo(
    () => Math.min(1, 780 / preset.width, 820 / preset.height),
    [preset.height, preset.width],
  );
  const transformedFrameRect = transformFrameRect(preset.frameRect, frame);
  const transformedScreenRect = transformFrameMask(preset, frame);

  const stageBackground = getPreviewBackground(background);
  const gradientData = parseLinearGradient(background.gradient);

  function resetForDevice(nextKey: DeviceKey) {
    const nextPreset = PRESETS[nextKey];
    setDeviceKey(nextKey);
    setFrame({ enabled: true, x: 0, y: 0, scale: 1 });
    setText((current) => ({
      ...current,
      x: Math.round(nextPreset.width * 0.095),
      y: Math.round(nextPreset.height * 0.06),
      width: Math.round(nextPreset.width * 0.81),
      fontSize: Math.max(30, Math.round(nextPreset.width * 0.083)),
      subtextFontSize: Math.max(18, Math.round(nextPreset.width * 0.033)),
      subtextGap: Math.max(10, Math.round(nextPreset.width * 0.022)),
    }));
    setScreenshot((current) =>
      current
        ? applyScreenshotLayout(
            fitScreenshot(current, nextPreset, {
              enabled: true,
              x: 0,
              y: 0,
              scale: 1,
            }),
            screenshotScale,
            screenshotPlacement,
            nextPreset,
            {
              enabled: true,
              x: 0,
              y: 0,
              scale: 1,
            },
          )
        : null,
    );
  }

  async function handleScreenshotFile(file: File) {
    const image = await readImageFile(file);
    const fitted = fitScreenshot(image, preset, frame);
    setScreenshot(
      applyScreenshotLayout(
        fitted,
        screenshotScale,
        screenshotPlacement,
        preset,
        frame,
      ),
    );
  }

  async function handleBackgroundFile(file: File) {
    const image = await readImageFile(file);
    setBackground((current) => ({
      ...current,
      mode: "image",
      imageSrc: image.src,
    }));
  }

  function updateGradientAngle(angle: number) {
    setBackground((current) => ({
      ...current,
      gradient: formatLinearGradient(angle, gradientData.stops),
    }));
  }

  function updateGradientStop(
    index: number,
    updates: Partial<(typeof gradientData.stops)[number]>,
  ) {
    setBackground((current) => ({
      ...current,
      gradient: formatLinearGradient(
        gradientData.angle,
        gradientData.stops.map((stop, stopIndex) =>
          stopIndex === index ? { ...stop, ...updates } : stop,
        ),
      ),
    }));
  }

  function addGradientStop() {
    setBackground((current) => ({
      ...current,
      gradient: formatLinearGradient(gradientData.angle, [
        ...gradientData.stops,
        {
          color:
            gradientData.stops[gradientData.stops.length - 1]?.color ??
            "#ffffff",
          offset: 1,
        },
      ]),
    }));
  }

  function removeGradientStop(index: number) {
    if (gradientData.stops.length <= 2) return;
    setBackground((current) => ({
      ...current,
      gradient: formatLinearGradient(
        gradientData.angle,
        gradientData.stops.filter((_, stopIndex) => stopIndex !== index),
      ),
    }));
  }

  function getCanvasPoint(event: PointerEvent) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left) / previewScale,
      y: (event.clientY - rect.top) / previewScale,
    };
  }

  function startDrag(layer: Layer, event: PointerEvent) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const dragRect = getDragRect(
      layer,
      event.currentTarget.getBoundingClientRect(),
    );
    const origin = getDragOrigin(layer);
    setDrag({
      layer,
      clientX: event.clientX,
      clientY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      screenshotOriginX: screenshot?.x ?? null,
      screenshotOriginY: screenshot?.y ?? null,
      width: dragRect.width,
      height: dragRect.height,
      snapX: false,
      snapY: false,
    });
  }

  function continueDrag(event: PointerEvent) {
    if (!drag) return;
    const dx = (event.clientX - drag.clientX) / previewScale;
    const dy = (event.clientY - drag.clientY) / previewScale;
    let snapX = false;
    let snapY = false;
    if (drag.layer === "text") {
      const snapped = snapToCenter(
        {
          x: drag.originX + dx,
          y: drag.originY + dy,
          width: drag.width,
          height: drag.height,
        },
        preset,
        previewScale,
      );
      snapX = snapped.snapX;
      snapY = snapped.snapY;
      setText({ ...text, x: snapped.x, y: snapped.y });
    }
    if (drag.layer === "screenshot") {
      if (!screenshot) return;
      const snapped = snapToCenter(
        {
          x: drag.originX + dx,
          y: drag.originY + dy,
          width: getImageWidth(screenshot),
          height: getImageHeight(screenshot),
        },
        preset,
        previewScale,
      );
      snapX = snapped.snapX;
      snapY = snapped.snapY;
      const nextScreenshot = { ...screenshot, x: snapped.x, y: snapped.y };
      setScreenshot(nextScreenshot);
      setScreenshotPlacement(
        getScreenshotPlacement(nextScreenshot, nextScreenshot.scale, preset, frame),
      );
    }
    if (drag.layer === "frame") {
      const nextFrame = {
        ...frame,
        x: drag.originX + dx,
        y: drag.originY + dy,
      };
      const snapped = snapToCenter(
        transformFrameRect(preset.frameRect, nextFrame),
        preset,
        previewScale,
      );
      const snappedFrame = {
        ...nextFrame,
        x: snapped.x - preset.frameRect.x,
        y: snapped.y - preset.frameRect.y,
      };
      const appliedDx = snappedFrame.x - drag.originX;
      const appliedDy = snappedFrame.y - drag.originY;
      snapX = snapped.snapX;
      snapY = snapped.snapY;
      setFrame(snappedFrame);
      setScreenshot((current) =>
        current &&
        drag.screenshotOriginX !== null &&
        drag.screenshotOriginY !== null
          ? {
              ...current,
              x: drag.screenshotOriginX + appliedDx,
              y: drag.screenshotOriginY + appliedDy,
            }
          : current,
      );
    }
    setDrag({ ...drag, snapX, snapY });
  }

  function getDragRect(
    layer: Layer,
    fallbackRect: DOMRect,
  ): Pick<Rect, "width" | "height"> {
    if (layer === "text")
      return {
        width: fallbackRect.width / previewScale,
        height: fallbackRect.height / previewScale,
      };
    if (layer === "screenshot" && screenshot)
      return {
        width: getImageWidth(screenshot),
        height: getImageHeight(screenshot),
      };
    if (layer === "frame")
      return {
        width: transformedFrameRect.width,
        height: transformedFrameRect.height,
      };
    return {
      width: fallbackRect.width / previewScale,
      height: fallbackRect.height / previewScale,
    };
  }

  function getDragOrigin(layer: Layer) {
    if (layer === "text") return { x: text.x, y: text.y };
    if (layer === "screenshot" && screenshot)
      return { x: screenshot.x, y: screenshot.y };
    if (layer === "frame") return { x: frame.x, y: frame.y };
    return { x: 0, y: 0 };
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) void handleScreenshotFile(file);
  }

  async function exportPng() {
    const canvas = document.createElement("canvas");
    canvas.width = preset.width;
    canvas.height = preset.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    await drawBackground(ctx, preset, background);
    if (screenshot)
      await drawScreenshot(
        ctx,
        screenshot,
        frame.enabled ? transformedScreenRect : null,
        transformedScreenRect.radius,
      );
    if (frame.enabled)
      await drawFrame(ctx, preset.frameSrc, transformedFrameRect);
    await waitForFonts();
    await drawText(ctx, text);

    const link = document.createElement("a");
    link.download = `screenshot-${preset.key}-${preset.width}x${preset.height}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function exportSettings() {
    const settings: SettingsFile = {
      version: 1,
      deviceKey,
      background,
      text,
      frame,
      screenshotScale: screenshotScale ?? screenshot?.scale ?? null,
      screenshotPlacement:
        screenshotPlacement ??
        (screenshot
          ? getScreenshotPlacement(
              screenshot,
              screenshot.scale,
              preset,
              frame,
            )
          : null),
      showMask,
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `screenshot-maker-${preset.key}-settings.json`;
    link.href = href;
    link.click();
    URL.revokeObjectURL(href);
  }

  async function importSettingsFile(file: File) {
    try {
      const imported = parseSettingsFile(await file.text());
      setDeviceKey(imported.deviceKey);
      setBackground(imported.background);
      setText(imported.text);
      setFrame(imported.frame);
      setScreenshotScale(imported.screenshotScale);
      setScreenshotPlacement(imported.screenshotPlacement);
      setShowMask(imported.showMask);
      setScreenshot(null);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to import settings.",
      );
    }
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <header>
          <p className="eyebrow">Screenshot Maker</p>
          <h1>Compose export-ready app screenshots.</h1>
        </header>

        <section className="panel">
          <h2>Device</h2>
          <label>
            Preset
            <select
              value={deviceKey}
              onChange={(event) =>
                resetForDevice(event.target.value as DeviceKey)
              }
            >
              {Object.values(PRESETS).map((item) => (
                <option
                  key={item.key}
                  value={item.key}
                >{`${item.label} (${item.width} x ${item.height})`}</option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={frame.enabled}
              onChange={(event) =>
                setFrame((current) => ({
                  ...current,
                  enabled: event.target.checked,
                }))
              }
            />
            Show realistic device frame
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={showMask}
              onChange={(event) => setShowMask(event.target.checked)}
            />
            Show screen mask
          </label>
          <label>
            Frame scale
            <input
              type="range"
              min="0.65"
              max="1.35"
              step="0.01"
              value={frame.scale}
              onChange={(event) =>
                setFrame((current) => ({
                  ...current,
                  scale: Number(event.target.value),
                }))
              }
            />
          </label>
        </section>

        <section className="panel">
          <h2>Background</h2>
          <label>
            Mode
            <select
              value={background.mode}
              onChange={(event) =>
                setBackground((current) => ({
                  ...current,
                  mode: event.target.value as BackgroundMode,
                }))
              }
            >
              <option value="solid">Solid color</option>
              <option value="gradient">Gradient</option>
              <option value="image">Image</option>
            </select>
          </label>
          {background.mode === "solid" ? (
            <label>
              Solid color
              <input
                type="color"
                value={background.color}
                onChange={(event) =>
                  setBackground((current) => ({
                    ...current,
                    color: event.target.value,
                  }))
                }
              />
            </label>
          ) : null}
          {background.mode === "gradient" ? (
            <div className="gradient-picker">
              <div
                className="gradient-preview"
                style={{ background: background.gradient }}
                aria-label="Gradient preview"
              />
              <label>
                Angle
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={gradientData.angle}
                  onChange={(event) =>
                    updateGradientAngle(Number(event.target.value))
                  }
                />
              </label>
              <input
                className="gradient-angle-input"
                type="number"
                min="0"
                max="360"
                value={Math.round(gradientData.angle)}
                onChange={(event) =>
                  updateGradientAngle(clamp(Number(event.target.value), 0, 360))
                }
                aria-label="Gradient angle in degrees"
              />
              {gradientData.stops.map((stop, index) => (
                <div className="gradient-stop" key={index}>
                  <label>
                    Color {index + 1}
                    <input
                      type="color"
                      value={toHexColor(stop.color)}
                      onChange={(event) =>
                        updateGradientStop(index, { color: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Position
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(stop.offset * 100)}
                      onChange={(event) =>
                        updateGradientStop(index, {
                          offset: Number(event.target.value) / 100,
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={gradientData.stops.length <= 2}
                    onClick={() => removeGradientStop(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ghost-button"
                onClick={addGradientStop}
              >
                Add color stop
              </button>
            </div>
          ) : null}
          {background.mode === "image" ? (
            <>
              <label>
                Background image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    void handleFileInput(event, handleBackgroundFile)
                  }
                />
              </label>
              <label>
                Image fit
                <select
                  value={background.imageFit}
                  onChange={(event) =>
                    setBackground((current) => ({
                      ...current,
                      imageFit: event.target.value as BackgroundFit,
                    }))
                  }
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="stretch">Stretch</option>
                </select>
              </label>
            </>
          ) : null}
        </section>

        <section className="panel">
          <h2>Screenshot</h2>
          <label>
            Upload screenshot
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                void handleFileInput(event, handleScreenshotFile)
              }
            />
          </label>
          <label>
            Screenshot scale
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.01"
              value={screenshot?.scale ?? screenshotScale ?? 1}
              disabled={!screenshot}
              onChange={(event) => {
                const nextScale = Number(event.target.value);
                setScreenshotScale(nextScale);
                setScreenshot((current) => {
                  if (!current) return current;
                  return applyScreenshotLayout(
                    fitScreenshot(current, preset, frame),
                    nextScale,
                    screenshotPlacement,
                    preset,
                    frame,
                  );
                });
              }}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setScreenshot((current) => {
                if (!current) return current;
                const fitted = fitScreenshot(current, preset, frame);
                setScreenshotScale(fitted.scale);
                setScreenshotPlacement(null);
                return fitted;
              })
            }
            disabled={!screenshot}
          >
            Fit screenshot
          </button>
        </section>

        <section className="panel">
          <h2>Text</h2>
          <label>
            Overlay text
            <textarea
              rows={4}
              value={text.content}
              onChange={(event) =>
                setText((current) => ({
                  ...current,
                  content: event.target.value,
                }))
              }
            />
          </label>
          <div className="grid-two">
            <label>
              Font
              <select
                value={text.fontFamily}
                onChange={(event) =>
                  setText((current) => ({
                    ...current,
                    fontFamily: event.target.value as FontFamily,
                  }))
                }
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Size
              <input
                type="number"
                value={text.fontSize}
                onChange={(event) =>
                  setText((current) => ({
                    ...current,
                    fontSize: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
          <div className="grid-two">
            <label>
              Line
              <input
                type="number"
                min="0.8"
                max="2"
                step="0.01"
                value={text.lineHeight}
                onChange={(event) =>
                  setText((current) => ({
                    ...current,
                    lineHeight: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              Gap
              <input
                type="number"
                min="0"
                step="1"
                value={text.subtextGap}
                onChange={(event) =>
                  setText((current) => ({
                    ...current,
                    subtextGap: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
          <div className="grid-two">
            <label>
              Text color
              <input
                type="color"
                value={text.color}
                onChange={(event) =>
                  setText((current) => ({
                    ...current,
                    color: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Accent
              <input
                type="color"
                value={text.accent}
                onChange={(event) =>
                  setText((current) => ({
                    ...current,
                    accent: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <label>
            Subtext
            <textarea
              rows={3}
              value={text.subtextContent}
              onChange={(event) =>
                setText((current) => ({
                  ...current,
                  subtextContent: event.target.value,
                }))
              }
            />
          </label>
          <div className="grid-two">
            <label>
              Subtext font
              <select
                value={text.subtextFontFamily}
                onChange={(event) =>
                  setText((current) => ({
                    ...current,
                    subtextFontFamily: event.target.value as FontFamily,
                  }))
                }
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subtext size
              <input
                type="number"
                value={text.subtextFontSize}
                onChange={(event) =>
                  setText((current) => ({
                    ...current,
                    subtextFontSize: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
          <div className="grid-two">
            <label>
              Subtext line
              <input
                type="number"
                min="0.8"
                max="2"
                step="0.01"
                value={text.subtextLineHeight}
                onChange={(event) =>
                  setText((current) => ({
                    ...current,
                    subtextLineHeight: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              Subtext color
              <input
                type="color"
                value={text.subtextColor}
                onChange={(event) =>
                  setText((current) => ({
                    ...current,
                    subtextColor: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <label>
            Width
            <input
              type="range"
              min="120"
              max={preset.width}
              step="1"
              value={text.width}
              onChange={(event) =>
                setText((current) => ({
                  ...current,
                  width: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Align
            <select
              value={text.align}
              onChange={(event) =>
                setText((current) => ({
                  ...current,
                  align: event.target.value as CanvasTextAlign,
                }))
              }
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </section>

        <div className="export-actions">
          <button
            className="export"
            type="button"
            onClick={() => void exportPng()}
          >
            Export PNG
          </button>
          <button type="button" onClick={exportSettings}>
            Export Settings
          </button>
          <label className="import-settings">
            Import Settings
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) =>
                void handleFileInput(event, importSettingsFile)
              }
            />
          </label>
        </div>
      </aside>

      <section className="workspace">
        <div className="toolbar">
          <strong>{preset.label}</strong>
          <span>
            {preset.width} x {preset.height}px
          </span>
          <span>Drag text, screenshot, or frame directly on the canvas.</span>
        </div>
        <div
          ref={stageRef}
          className="stage"
          style={{
            width: preset.width * previewScale,
            height: preset.height * previewScale,
            background: stageBackground,
          }}
          onPointerMove={continueDrag}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          {background.mode === "image" && background.imageSrc ? (
            <img
              className={`background-image fit-${background.imageFit}`}
              src={background.imageSrc}
              alt=""
              draggable={false}
            />
          ) : null}
          {!screenshot ? (
            <div
              className="drop-hint"
              style={{ transform: `scale(${previewScale})` }}
            >
              Drop a screenshot here
            </div>
          ) : null}
          {drag?.snapX ? <div className="snap-guide snap-guide-x" /> : null}
          {drag?.snapY ? <div className="snap-guide snap-guide-y" /> : null}
          {screenshot && frame.enabled ? (
            <div
              className="screen-clip"
              style={{
                left: transformedScreenRect.x * previewScale,
                top: transformedScreenRect.y * previewScale,
                width: transformedScreenRect.width * previewScale,
                height: transformedScreenRect.height * previewScale,
                borderRadius: transformedScreenRect.radius * previewScale,
              }}
            >
              <img
                className="screenshot-layer clipped"
                src={screenshot.src}
                alt="Dropped screenshot"
                draggable={false}
                style={{
                  left: (screenshot.x - transformedScreenRect.x) * previewScale,
                  top: (screenshot.y - transformedScreenRect.y) * previewScale,
                  width: getImageWidth(screenshot) * previewScale,
                  height: getImageHeight(screenshot) * previewScale,
                }}
                onPointerDown={(event) => startDrag("screenshot", event)}
              />
            </div>
          ) : null}
          {screenshot && !frame.enabled ? (
            <img
              className="screenshot-layer"
              src={screenshot.src}
              alt="Dropped screenshot"
              draggable={false}
              style={{
                left: screenshot.x * previewScale,
                top: screenshot.y * previewScale,
                width: getImageWidth(screenshot) * previewScale,
                height: getImageHeight(screenshot) * previewScale,
              }}
              onPointerDown={(event) => startDrag("screenshot", event)}
            />
          ) : null}
          {frame.enabled ? (
            <img
              className="frame-layer"
              src={preset.frameSrc}
              alt={`${preset.label} frame`}
              draggable={false}
              style={{
                left: transformedFrameRect.x * previewScale,
                top: transformedFrameRect.y * previewScale,
                width: transformedFrameRect.width * previewScale,
                height: transformedFrameRect.height * previewScale,
              }}
              onPointerDown={(event) => startDrag("frame", event)}
            />
          ) : null}
          {showMask && frame.enabled ? (
            <div
              className="mask-debug"
              style={{
                left: transformedScreenRect.x * previewScale,
                top: transformedScreenRect.y * previewScale,
                width: transformedScreenRect.width * previewScale,
                height: transformedScreenRect.height * previewScale,
                borderRadius: transformedScreenRect.radius * previewScale,
              }}
            />
          ) : null}
          <div
            className="text-layer"
            style={{
              left: text.x * previewScale,
              top: text.y * previewScale,
              width: text.width * previewScale,
              textAlign: text.align as "left" | "center" | "right",
            }}
            onPointerDown={(event) => startDrag("text", event)}
          >
            <div
              className="text-main"
              style={{
                color: text.color,
                fontFamily: getFontStack(text.fontFamily),
                fontSize: text.fontSize * previewScale,
                fontWeight: 800,
                letterSpacing: `${-0.055 * text.fontSize * previewScale}px`,
                lineHeight: text.lineHeight,
              }}
            >
              {renderRichText(text.content, text.accent)}
            </div>
            {text.subtextContent.trim() ? (
              <div
                className="text-subtext"
                style={{
                  color: text.subtextColor,
                  fontFamily: getFontStack(text.subtextFontFamily),
                  fontSize: text.subtextFontSize * previewScale,
                  fontWeight: 700,
                  letterSpacing: `${-0.025 * text.subtextFontSize * previewScale}px`,
                  lineHeight: text.subtextLineHeight,
                  marginTop: text.subtextGap * previewScale,
                }}
              >
                {renderRichText(text.subtextContent, text.accent)}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function transformFrameRect(rect: Rect, frame: FrameState): Rect {
  return {
    x: rect.x + frame.x,
    y: rect.y + frame.y,
    width: rect.width * frame.scale,
    height: rect.height * frame.scale,
  };
}

function snapToCenter(rect: Rect, preset: DevicePreset, previewScale: number) {
  const threshold = SNAP_DISTANCE / previewScale;
  const centeredX = (preset.width - rect.width) / 2;
  const centeredY = (preset.height - rect.height) / 2;
  const snapX =
    Math.abs(rect.x + rect.width / 2 - preset.width / 2) <= threshold;
  const snapY =
    Math.abs(rect.y + rect.height / 2 - preset.height / 2) <= threshold;
  return {
    x: snapX ? centeredX : rect.x,
    y: snapY ? centeredY : rect.y,
    snapX,
    snapY,
  };
}

function transformFrameMask(
  preset: DevicePreset,
  frame: FrameState,
): Rect & { radius: number } {
  const mask = preset.screenMask;
  const rect = transformFrameRelativeRect(mask, preset, frame);
  const scaleX = preset.frameRect.width / preset.assetSize.width;
  const scaleY = preset.frameRect.height / preset.assetSize.height;
  return {
    ...rect,
    radius: mask.radius * Math.min(scaleX, scaleY) * frame.scale,
  };
}

function transformFrameRelativeRect(
  rect: Rect,
  preset: DevicePreset,
  frame: FrameState,
): Rect {
  const frameRect = preset.frameRect;
  const scaleX = frameRect.width / preset.assetSize.width;
  const scaleY = frameRect.height / preset.assetSize.height;
  return {
    x: frameRect.x + frame.x + rect.x * scaleX * frame.scale,
    y: frameRect.y + frame.y + rect.y * scaleY * frame.scale,
    width: rect.width * scaleX * frame.scale,
    height: rect.height * scaleY * frame.scale,
  };
}

function fitScreenshot(
  image: ImageLayer,
  preset: DevicePreset,
  frame: FrameState,
): ImageLayer {
  const target = frame.enabled
    ? preset.screenshotTarget
      ? transformFrameRelativeRect(preset.screenshotTarget, preset, frame)
      : transformFrameMask(preset, frame)
    : {
        x: preset.width * 0.085,
        y: preset.height * 0.33,
        width: preset.width * 0.83,
        height: preset.height * 0.58,
      };
  if (frame.enabled && preset.screenshotFit === "exact") {
    return {
      ...image,
      scale: target.width / image.naturalWidth,
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height,
    };
  }
  const scale =
    frame.enabled && preset.screenshotFit === "cover"
      ? Math.max(
          target.width / image.naturalWidth,
          target.height / image.naturalHeight,
        )
      : Math.min(
          target.width / image.naturalWidth,
          target.height / image.naturalHeight,
        );
  return {
    ...image,
    scale,
    x: target.x + (target.width - image.naturalWidth * scale) / 2,
    y: target.y + (target.height - image.naturalHeight * scale) / 2,
    width: image.naturalWidth * scale,
    height: image.naturalHeight * scale,
  };
}

function resizeScreenshot(
  image: ImageLayer | null,
  scale: number,
  preset: DevicePreset,
  frame: FrameState,
): ImageLayer | null {
  if (!image) return null;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  if (frame.enabled && preset.screenshotTarget) {
    const target = transformFrameRelativeRect(
      preset.screenshotTarget,
      preset,
      frame,
    );
    return {
      ...image,
      scale,
      x: target.x + (target.width - width) / 2,
      y: target.y + (target.height - height) / 2,
      width,
      height,
    };
  }
  return {
    ...image,
    scale,
    width,
    height,
  };
}

function applyScreenshotScale(
  image: ImageLayer,
  scale: number | null,
  preset: DevicePreset,
  frame: FrameState,
) {
  if (scale === null) return image;
  return resizeScreenshot(image, scale, preset, frame) ?? image;
}

function applyScreenshotLayout(
  image: ImageLayer,
  scale: number | null,
  placement: ScreenshotPlacement | null,
  preset: DevicePreset,
  frame: FrameState,
) {
  return applyScreenshotPlacement(
    applyScreenshotScale(image, scale, preset, frame),
    placement,
  );
}

function applyScreenshotPlacement(
  image: ImageLayer,
  placement: ScreenshotPlacement | null,
) {
  return placement
    ? { ...image, x: image.x + placement.offsetX, y: image.y + placement.offsetY }
    : image;
}

function getScreenshotPlacement(
  image: ImageLayer,
  scale: number,
  preset: DevicePreset,
  frame: FrameState,
): ScreenshotPlacement {
  const fitted = applyScreenshotScale(fitScreenshot(image, preset, frame), scale, preset, frame);
  return {
    offsetX: image.x - fitted.x,
    offsetY: image.y - fitted.y,
  };
}

function getImageWidth(image: ImageLayer) {
  return image.width ?? image.naturalWidth * image.scale;
}

function getImageHeight(image: ImageLayer) {
  return image.height ?? image.naturalHeight * image.scale;
}

async function handleFileInput(
  event: ChangeEvent<HTMLInputElement>,
  handler: (file: File) => Promise<void>,
) {
  const file = event.target.files?.[0];
  if (file) await handler(file);
  event.target.value = "";
}

function parseSettingsFile(value: string): SettingsFile {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) throw new Error("Settings file is not valid JSON.");
  const settings = parsed as Partial<SettingsFile>;
  if (settings.version !== 1)
    throw new Error("Unsupported settings file version.");
  if (!isDeviceKey(settings.deviceKey))
    throw new Error("Settings file has an invalid device preset.");
  if (!isBackgroundState(settings.background))
    throw new Error("Settings file has invalid background settings.");
  const text = normalizeTextState(settings.text);
  if (!text) throw new Error("Settings file has invalid text settings.");
  if (!isFrameState(settings.frame))
    throw new Error("Settings file has invalid frame settings.");
  if (
    settings.screenshotScale !== undefined &&
    settings.screenshotScale !== null &&
    typeof settings.screenshotScale !== "number"
  )
    throw new Error("Settings file has invalid screenshot scale settings.");
  if (
    settings.screenshotPlacement !== undefined &&
    settings.screenshotPlacement !== null &&
    !isScreenshotPlacement(settings.screenshotPlacement)
  )
    throw new Error("Settings file has invalid screenshot placement settings.");
  if (typeof settings.showMask !== "boolean")
    throw new Error("Settings file has invalid mask settings.");
  return {
    ...settings,
    text,
    screenshotScale: settings.screenshotScale ?? null,
    screenshotPlacement: settings.screenshotPlacement ?? null,
  } as SettingsFile;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDeviceKey(value: unknown): value is DeviceKey {
  return typeof value === "string" && value in PRESETS;
}

function isBackgroundState(value: unknown): value is BackgroundState {
  if (!isRecord(value)) return false;
  return (
    isBackgroundMode(value.mode) &&
    typeof value.color === "string" &&
    typeof value.gradient === "string" &&
    (typeof value.imageSrc === "string" || value.imageSrc === null) &&
    isBackgroundFit(value.imageFit)
  );
}

function isBackgroundMode(value: unknown): value is BackgroundMode {
  return value === "solid" || value === "gradient" || value === "image";
}

function isBackgroundFit(value: unknown): value is BackgroundFit {
  return value === "cover" || value === "contain" || value === "stretch";
}

function isScreenshotPlacement(value: unknown): value is ScreenshotPlacement {
  if (!isRecord(value)) return false;
  return typeof value.offsetX === "number" && typeof value.offsetY === "number";
}

function normalizeTextState(value: unknown): TextState | null {
  if (!isBaseTextState(value)) return null;
  return {
    ...value,
    fontFamily: isFontFamily(value.fontFamily)
      ? value.fontFamily
      : DEFAULT_TEXT.fontFamily,
    subtextContent:
      typeof value.subtextContent === "string"
        ? value.subtextContent
        : DEFAULT_TEXT.subtextContent,
    subtextFontFamily: isFontFamily(value.subtextFontFamily)
      ? value.subtextFontFamily
      : DEFAULT_TEXT.subtextFontFamily,
    subtextFontSize:
      typeof value.subtextFontSize === "number"
        ? value.subtextFontSize
        : DEFAULT_TEXT.subtextFontSize,
    subtextLineHeight:
      typeof value.subtextLineHeight === "number"
        ? value.subtextLineHeight
        : DEFAULT_TEXT.subtextLineHeight,
    subtextColor:
      typeof value.subtextColor === "string"
        ? value.subtextColor
        : DEFAULT_TEXT.subtextColor,
    subtextGap:
      typeof value.subtextGap === "number"
        ? value.subtextGap
        : DEFAULT_TEXT.subtextGap,
  };
}

function isBaseTextState(
  value: unknown,
): value is Omit<
  TextState,
  | "fontFamily"
  | "subtextContent"
  | "subtextFontFamily"
  | "subtextFontSize"
  | "subtextLineHeight"
  | "subtextColor"
  | "subtextGap"
> &
  Partial<TextState> {
  if (!isRecord(value)) return false;
  return (
    typeof value.content === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    typeof value.fontSize === "number" &&
    typeof value.lineHeight === "number" &&
    typeof value.color === "string" &&
    typeof value.accent === "string" &&
    isCanvasTextAlign(value.align)
  );
}

function isFontFamily(value: unknown): value is FontFamily {
  return (
    typeof value === "string" &&
    FONT_OPTIONS.some((font) => font.value === value)
  );
}

function isCanvasTextAlign(value: unknown): value is CanvasTextAlign {
  return value === "left" || value === "center" || value === "right";
}

function isFrameState(value: unknown): value is FrameState {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === "boolean" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.scale === "number"
  );
}

function readImageFile(file: File): Promise<ImageLayer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = String(reader.result);
      const image = new Image();
      image.onload = () =>
        resolve({
          src,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          x: 0,
          y: 0,
          width: image.naturalWidth,
          height: image.naturalHeight,
          scale: 1,
        });
      image.onerror = reject;
      image.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function getPreviewBackground(background: BackgroundState) {
  if (background.mode === "solid") return background.color;
  if (background.mode === "gradient") return background.gradient;
  return background.color;
}

async function waitForFonts() {
  if ("fonts" in document) await document.fonts.ready;
}

function renderRichText(value: string, accent: string) {
  return value.split("\n").map((line, lineIndex) => (
    <span className="rich-line" key={lineIndex}>
      {parseRichSegments(line).map((segment, segmentIndex) => (
        <span
          key={segmentIndex}
          style={{
            color: segment.accent ? accent : undefined,
            fontStyle: segment.italic ? "italic" : undefined,
            fontWeight: segment.bold ? 900 : undefined,
          }}
        >
          {segment.text}
        </span>
      ))}
    </span>
  ));
}

function parseRichSegments(line: string) {
  const parts: RichSegment[] = [];
  let bold = false;
  let italic = false;
  let accent = false;
  let buffer = "";
  const pushBuffer = () => {
    if (!buffer) return;
    parts.push({ text: buffer, bold, italic, accent });
    buffer = "";
  };
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "*") {
      pushBuffer();
      if (line[index + 1] === "*") {
        bold = !bold;
        index += 1;
      } else {
        italic = !italic;
      }
    } else if (char === "_") {
      pushBuffer();
      accent = !accent;
    } else {
      buffer += char;
    }
  }
  pushBuffer();
  return parts;
}

async function drawBackground(
  ctx: CanvasRenderingContext2D,
  preset: DevicePreset,
  background: BackgroundState,
) {
  ctx.fillStyle = background.color;
  ctx.fillRect(0, 0, preset.width, preset.height);
  if (background.mode === "gradient") {
    const gradientData = parseLinearGradient(background.gradient);
    const points = gradientPoints(
      preset.width,
      preset.height,
      gradientData.angle,
    );
    const gradient = ctx.createLinearGradient(
      points.x0,
      points.y0,
      points.x1,
      points.y1,
    );
    gradientData.stops.forEach((stop) =>
      gradient.addColorStop(stop.offset, stop.color),
    );
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, preset.width, preset.height);
  }
  if (background.mode === "image" && background.imageSrc) {
    const image = await loadImage(background.imageSrc);
    drawImageFit(
      ctx,
      image,
      { x: 0, y: 0, width: preset.width, height: preset.height },
      background.imageFit,
    );
  }
}

async function drawScreenshot(
  ctx: CanvasRenderingContext2D,
  screenshot: ImageLayer,
  clip: Rect | null,
  radius: number,
) {
  const image = await loadImage(screenshot.src);
  ctx.save();
  if (clip) {
    roundedRect(ctx, clip.x, clip.y, clip.width, clip.height, radius);
    ctx.clip();
  }
  ctx.drawImage(
    image,
    screenshot.x,
    screenshot.y,
    getImageWidth(screenshot),
    getImageHeight(screenshot),
  );
  ctx.restore();
}

async function drawFrame(
  ctx: CanvasRenderingContext2D,
  src: string,
  rect: Rect,
) {
  const image = await loadImage(src);
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
}

async function drawText(ctx: CanvasRenderingContext2D, text: TextState) {
  const mainHeight = drawRichTextBlock(ctx, text.content, text.x, text.y, {
    width: text.width,
    fontFamily: text.fontFamily,
    fontSize: text.fontSize,
    fontWeight: 800,
    letterSpacing: -0.055 * text.fontSize,
    lineHeight: text.lineHeight,
    color: text.color,
    accent: text.accent,
    align: text.align,
  });
  if (!text.subtextContent.trim()) return;
  drawRichTextBlock(
    ctx,
    text.subtextContent,
    text.x,
    text.y + mainHeight + text.subtextGap,
    {
      width: text.width,
      fontFamily: text.subtextFontFamily,
      fontSize: text.subtextFontSize,
      fontWeight: 700,
      letterSpacing: -0.025 * text.subtextFontSize,
      lineHeight: text.subtextLineHeight,
      color: text.subtextColor,
      accent: text.accent,
      align: text.align,
    },
  );
}

function drawRichTextBlock(
  ctx: CanvasRenderingContext2D,
  content: string,
  x: number,
  startY: number,
  options: TextRenderOptions,
) {
  if (!content.trim()) return 0;
  setCanvasLetterSpacing(ctx, options.letterSpacing);
  const lines = content.split("\n");
  const lineHeight = options.fontSize * options.lineHeight;
  let y = startY;
  ctx.textBaseline = "top";
  for (const rawLine of lines) {
    const wrapped = wrapRichLine(ctx, parseRichSegments(rawLine), options);
    for (const line of wrapped) {
      const lineWidth = line.reduce((sum, segment) => {
        ctx.font = getTextFont(options, segment);
        return sum + ctx.measureText(segment.text).width;
      }, 0);
      let lineX = x;
      if (options.align === "center")
        lineX = x + (options.width - lineWidth) / 2;
      if (options.align === "right") lineX = x + options.width - lineWidth;
      for (const segment of line) {
        ctx.font = getTextFont(options, segment);
        ctx.fillStyle = segment.accent ? options.accent : options.color;
        ctx.fillText(segment.text, lineX, y);
        lineX += ctx.measureText(segment.text).width;
      }
      y += lineHeight;
    }
  }
  return y - startY;
}

function setCanvasLetterSpacing(ctx: CanvasRenderingContext2D, value: number) {
  const ctxWithLetterSpacing = ctx as CanvasRenderingContext2D & {
    letterSpacing?: string;
  };
  ctxWithLetterSpacing.letterSpacing = `${value}px`;
}

function wrapRichLine(
  ctx: CanvasRenderingContext2D,
  segments: RichSegment[],
  options: TextRenderOptions,
) {
  const tokens = segments.flatMap((segment) =>
    segment.text
      .split(/(\s+)/)
      .filter(Boolean)
      .map((token) => ({ ...segment, text: token })),
  );
  const lines: RichSegment[][] = [[]];
  let currentWidth = 0;
  for (const token of tokens) {
    ctx.font = getTextFont(options, token);
    const tokenWidth = ctx.measureText(token.text).width;
    if (
      currentWidth + tokenWidth > options.width &&
      lines[lines.length - 1].length > 0 &&
      token.text.trim()
    ) {
      lines.push([]);
      currentWidth = 0;
    }
    lines[lines.length - 1].push(token);
    currentWidth += tokenWidth;
  }
  return lines;
}

function getTextFont(
  options: Pick<TextRenderOptions, "fontFamily" | "fontSize" | "fontWeight">,
  segment: Pick<RichSegment, "bold" | "italic">,
) {
  return `${segment.italic ? "italic " : ""}${segment.bold ? 900 : options.fontWeight} ${options.fontSize}px ${getFontStack(options.fontFamily)}`;
}

function getFontStack(fontFamily: FontFamily) {
  return (
    FONT_OPTIONS.find((font) => font.value === fontFamily)?.stack ??
    FONT_OPTIONS[0].stack
  );
}

function parseLinearGradient(value: string) {
  const match = value.match(/linear-gradient\((.*)\)/i);
  if (!match)
    return {
      angle: 145,
      stops: [
        { color: "#ffe1c7", offset: 0 },
        { color: "#7f6dff", offset: 1 },
      ],
    };
  const parts = splitGradientParts(match[1]);
  const first = parts[0]?.trim() ?? "";
  const angle = first.endsWith("deg") ? Number.parseFloat(first) : 180;
  const colorParts = first.endsWith("deg") ? parts.slice(1) : parts;
  const parsed = colorParts.map((part, index) => {
    const colorMatch = part.match(
      /#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+/,
    );
    const stopMatch = part.match(/(?:^|\s)(\d+(?:\.\d+)?)%/);
    return {
      color: colorMatch?.[0] ?? (index === 0 ? "#ffe1c7" : "#7f6dff"),
      offset: stopMatch
        ? clamp(Number.parseFloat(stopMatch[1]) / 100, 0, 1)
        : index / Math.max(colorParts.length - 1, 1),
    };
  });
  return {
    angle,
    stops:
      parsed.length >= 2
        ? parsed
        : [
            { color: "#ffe1c7", offset: 0 },
            { color: "#7f6dff", offset: 1 },
          ],
  };
}

function formatLinearGradient(
  angle: number,
  stops: ReturnType<typeof parseLinearGradient>["stops"],
) {
  const sortedStops = [...stops].sort((a, b) => a.offset - b.offset);
  return `linear-gradient(${Math.round(angle)}deg, ${sortedStops
    .map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`)
    .join(", ")})`;
}

function toHexColor(value: string) {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  return "#ffffff";
}

function splitGradientParts(value: string) {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function gradientPoints(width: number, height: number, cssAngle: number) {
  const radians = ((cssAngle - 90) * Math.PI) / 180;
  const x = Math.cos(radians);
  const y = Math.sin(radians);
  const length = Math.abs(width * x) + Math.abs(height * y);
  const cx = width / 2;
  const cy = height / 2;
  return {
    x0: cx - (x * length) / 2,
    y0: cy - (y * length) / 2,
    x1: cx + (x * length) / 2,
    y1: cy + (y * length) / 2,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: Rect,
  fit: BackgroundFit,
) {
  if (fit === "stretch") {
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    return;
  }
  const scale =
    fit === "cover"
      ? Math.max(
          rect.width / image.naturalWidth,
          rect.height / image.naturalHeight,
        )
      : Math.min(
          rect.width / image.naturalWidth,
          rect.height / image.naturalHeight,
        );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(
    image,
    rect.x + (rect.width - width) / 2,
    rect.y + (rect.height - height) / 2,
    width,
    height,
  );
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export default App;
