"use client";

import { useEffect, useRef } from "react";

/**
 * Радиальная визуализация голоса («голосовые волны») — замена 3D-аватара.
 * Рисует на canvas центральный пульсирующий диск и расходящиеся из него лучи,
 * длина которых реагирует на звук:
 *  • speaking — амплитуда TTS-ответа клиента (analyser TTS-плеера);
 *  • recording — громкость микрофона ученика (analyser mic-потока);
 *  • idle/processing — мягкое «дыхание» без звука;
 *  • demo — синтетическая «речь» для промо-секции лендинга (без Web Audio).
 * Полностью клиентское; цвета берём из CSS-переменных бренда (тема-независимо).
 */

export type VoiceVisualizerState =
  | "idle"
  | "recording"
  | "processing"
  | "speaking";

const BARS = 64; // лучей по кругу (зеркалим левую/правую половины)

/** Прочитать CSS-переменную бренда как `r,g,b`, с запасным значением. */
function readRgb(varName: string, fallback: [number, number, number]) {
  if (typeof window === "undefined") return fallback;
  const hex = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
}

export function VoiceVisualizer({
  analyser = null,
  state = "idle",
  demo = false,
  className,
}: {
  /** Узел анализа активного звука (mic при записи, TTS при ответе); null — тишина. */
  analyser?: AnalyserNode | null;
  state?: VoiceVisualizerState;
  /** Промо-режим: синтетическая «речь» без реального звука. */
  demo?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Живые пропсы — через ref, чтобы не пересоздавать RAF-цикл на каждый рендер.
  const analyserRef = useRef(analyser);
  const stateRef = useRef(state);
  const demoRef = useRef(demo);
  analyserRef.current = analyser;
  stateRef.current = state;
  demoRef.current = demo;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let disposed = false;
    let dpr = 1;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const brand = readRgb("--color-brand", [244, 0, 58]);
    const brandLight = readRgb("--color-brand-light", [255, 122, 143]);

    const smoothed = new Float32Array(BARS); // сглаженные длины лучей
    let level = 0; // общий уровень (для пульса диска и свечения)
    let freq = new Uint8Array(0);
    let lastAnalyser: AnalyserNode | null = null;
    const start = performance.now();

    const draw = (nowMs: number) => {
      raf = requestAnimationFrame(draw);
      if (disposed || w === 0) return;
      const t = (nowMs - start) / 1000;
      const st = stateRef.current;
      const an = analyserRef.current;
      const isDemo = demoRef.current;
      const half = BARS / 2;

      // Целевые амплитуды по половине лучей, затем зеркалим.
      const targets = new Float32Array(half);
      const audioActive = !!an && (st === "speaking" || st === "recording");

      if (audioActive && an) {
        if (an !== lastAnalyser || freq.length !== an.frequencyBinCount) {
          freq = new Uint8Array(an.frequencyBinCount);
          lastAnalyser = an;
        }
        an.getByteFrequencyData(freq);
        // Голосовая энергия в низах/середине — берём первые ~2/3 бинов.
        const usable = Math.floor(freq.length * 0.66);
        for (let i = 0; i < half; i++) {
          const lo = Math.floor((i / half) * usable);
          const hi = Math.floor(((i + 1) / half) * usable);
          let sum = 0;
          let cnt = 0;
          for (let j = lo; j <= hi && j < freq.length; j++) {
            sum += freq[j] ?? 0;
            cnt++;
          }
          const v = cnt ? sum / cnt / 255 : 0;
          // лёгкий подъём высоких лучей, чтобы форма была живее
          targets[i] = Math.min(1, v * (1 + i / half) * 1.15);
        }
      } else {
        // Синтетика: демо — «речь», idle/processing — спокойное дыхание.
        const speech = isDemo
          ? Math.max(
              0,
              (Math.sin(t * 0.9) + Math.sin(t * 0.37 + 1)) / 2 > -0.2 ? 1 : 0.15,
            )
          : 0;
        const base = isDemo ? 0.18 : st === "processing" ? 0.14 : 0.1;
        for (let i = 0; i < half; i++) {
          const wobble =
            0.5 +
            0.5 *
              Math.sin(t * (1.4 + i * 0.12) + i * 0.6) *
              Math.sin(t * 0.7 + i * 0.25);
          const syll = isDemo ? 0.45 * (0.5 + 0.5 * Math.sin(t * 9 + i)) : 0;
          targets[i] = Math.min(1, base + wobble * (base + 0.12) + speech * syll);
        }
      }

      // Сглаживание (быстрый подъём, плавный спад) + зеркалирование.
      let sumLevel = 0;
      for (let i = 0; i < half; i++) {
        const cur = smoothed[i] ?? 0;
        const tgt = targets[i] ?? 0;
        const k = tgt > cur ? 0.35 : 0.12;
        const nv = cur + (tgt - cur) * k;
        smoothed[i] = nv;
        smoothed[BARS - 1 - i] = nv;
        sumLevel += nv;
      }
      level += (sumLevel / half - level) * 0.2;

      // ── Рисуем ──
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const unit = Math.min(w, h) / 2;
      const innerR = unit * 0.32; // радиус диска
      const gap = unit * 0.06;
      const maxLen = unit * 0.5;

      const [br, bg, bb] = brand;
      const [lr, lg, lb] = brandLight;

      // Расходящиеся кольца-«ряби» на пиках громкости.
      const ripple = (t * 0.35) % 1;
      const rippleAlpha = Math.max(0, level - 0.12) * 0.5;
      if (rippleAlpha > 0.02) {
        for (let k = 0; k < 2; k++) {
          const p = (ripple + k * 0.5) % 1;
          ctx.beginPath();
          ctx.arc(cx, cy, innerR + gap + p * maxLen, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${br},${bg},${bb},${rippleAlpha * (1 - p)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Лучи.
      const barW = Math.max(2, unit * 0.035);
      ctx.lineCap = "round";
      ctx.lineWidth = barW;
      for (let i = 0; i < BARS; i++) {
        const ang = (i / BARS) * Math.PI * 2 - Math.PI / 2;
        const len = gap + (smoothed[i] ?? 0) * maxLen;
        const r0 = innerR;
        const r1 = innerR + len;
        const x0 = cx + Math.cos(ang) * r0;
        const y0 = cy + Math.sin(ang) * r0;
        const x1 = cx + Math.cos(ang) * r1;
        const y1 = cy + Math.sin(ang) * r1;
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, `rgba(${br},${bg},${bb},0.95)`);
        g.addColorStop(1, `rgba(${lr},${lg},${lb},0.85)`);
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }

      // Центральный диск с мягким свечением и пульсом.
      const pulse = innerR * (0.86 + level * 0.28);
      ctx.save();
      ctx.shadowColor = `rgba(${br},${bg},${bb},${0.5 + level * 0.4})`;
      ctx.shadowBlur = unit * (0.25 + level * 0.4);
      const disc = ctx.createRadialGradient(
        cx - pulse * 0.25,
        cy - pulse * 0.3,
        pulse * 0.15,
        cx,
        cy,
        pulse,
      );
      disc.addColorStop(0, `rgba(${lr},${lg},${lb},1)`);
      disc.addColorStop(1, `rgba(${br},${bg},${bb},1)`);
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Блик внутри диска.
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      ctx.arc(cx - pulse * 0.28, cy - pulse * 0.32, pulse * 0.3, 0, Math.PI * 2);
      ctx.fill();
    };
    raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
