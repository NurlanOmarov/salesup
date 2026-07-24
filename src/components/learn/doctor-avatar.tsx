"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Говорящая 3D-голова AI-клиента для голосового симулятора. Грузит GLB-аватар
 * (MetaPerson: ARKit-блендшейпы + виземы), кадрирует по «голова+плечи» и анимирует:
 *  • липсинк — амплитудой звука TTS (analyser) по морфам jawOpen/aa, RU-фонемного
 *    тайминга у провайдеров нет (см. lib/ai/voice.ts), поэтому ведём по громкости;
 *  • idle — моргание eyeBlink* и микро-покачивание кости Head.
 * Всё клиентское (Three.js), грузится только в голосовом режиме через next/dynamic —
 * бандл остальных страниц не растёт (CLAUDE.md, правило 10).
 */

const MOUTH_MORPHS = ["jawOpen", "aa"] as const; // ведём амплитудой
const BLINK_MORPHS = ["eyeBlinkLeft", "eyeBlinkRight"] as const;

/** Сила открытия рта по каждому морфу при максимальной громкости (0..1). */
const MOUTH_GAIN: Record<string, number> = { jawOpen: 0.55, aa: 0.35 };

export function DoctorAvatar({
  src,
  analyser,
  speaking,
  demo = false,
}: {
  src: string;
  /** Узел анализа звука TTS; null — пока озвучки не было (только idle). */
  analyser: AnalyserNode | null;
  speaking: boolean;
  /** Демо-режим (для промо-ролика): синтетическая «речь» без звука. */
  demo?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Живые значения пробрасываем в RAF через ref, чтобы не пересоздавать сцену.
  const analyserRef = useRef<AnalyserNode | null>(analyser);
  const speakingRef = useRef(speaking);
  const demoRef = useRef(demo);
  analyserRef.current = analyser;
  speakingRef.current = speaking;
  demoRef.current = demo;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let raf = 0;
    const width = mount.clientWidth || 240;
    const height = mount.clientHeight || 280;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(24, width / height, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // Свет: мягкая заливка + ключевой спереди-сверху + контровой сзади.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.5, 1.2, 1.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd0ff, 0.7);
    rim.position.set(-0.8, 0.6, -1.2);
    scene.add(rim);

    // Морфы по имени → список ссылок на массивы влияний (рот в нескольких мешах: лицо+зубы).
    const morphs = new Map<string, { influences: number[]; index: number }[]>();
    let headBone: THREE.Object3D | null = null;
    const headBaseRot = new THREE.Euler();

    const setMorph = (name: string, value: number) => {
      const targets = morphs.get(name);
      if (!targets) return;
      for (const t of targets) t.influences[t.index] = value;
    };

    new GLTFLoader().load(
      src,
      (gltf) => {
        if (disposed) {
          renderer.dispose();
          return;
        }
        const model = gltf.scene;
        scene.add(model);

        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
            const dict = mesh.morphTargetDictionary;
            const infl = mesh.morphTargetInfluences;
            for (const name of [...MOUTH_MORPHS, ...BLINK_MORPHS]) {
              const idx = dict[name];
              if (idx !== undefined) {
                const arr = morphs.get(name) ?? [];
                arr.push({ influences: infl, index: idx });
                morphs.set(name, arr);
              }
            }
          }
          if (obj.name === "Head") {
            headBone = obj;
            headBaseRot.copy(obj.rotation);
          }
        });

        // Кадрируем «голова+плечи». Кость Head — у основания черепа, лицо заметно
        // выше, поэтому цель поднимаем; камера отодвинута дальше, чтобы плечи
        // полностью влезали по ширине (иначе срез по бокам в светлой теме).
        const headPos = new THREE.Vector3();
        (headBone ?? model).getWorldPosition(headPos);
        const center = headPos.y + 0.04; // примерно уровень лица
        camera.position.set(headPos.x, center, headPos.z + 1.2);
        camera.lookAt(headPos.x, center, headPos.z);
      },
      undefined,
      (err) => console.error("Не удалось загрузить аватар:", err),
    );

    // Состояние анимации рта (сглаживание: быстрый attack, плавный release).
    let mouth = 0;
    let nextBlink = 1.2;
    let blink = 0; // 0..1 фаза моргания
    const clock = new THREE.Clock();
    const buf = new Uint8Array(1024);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      const t = clock.elapsedTime;

      // Липсинк по громкости TTS.
      let level = 0;
      const an = analyserRef.current;
      if (demoRef.current) {
        // Синтетическая «речь» для промо-ролика: слоги + смысловые паузы.
        const syll = 0.5 + 0.5 * Math.sin(t * 9);
        const gate = (Math.sin(t * 0.9) + Math.sin(t * 0.37 + 1)) / 2 > -0.15 ? 1 : 0;
        level = Math.max(0, syll * gate) * 0.7; // мягче, чтобы рот не распахивался
      } else if (speakingRef.current && an) {
        const n = Math.min(buf.length, an.fftSize);
        an.getByteTimeDomainData(buf.subarray(0, n));
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const v = ((buf[i] ?? 128) - 128) / 128;
          sum += v * v;
        }
        level = Math.min(1, Math.sqrt(sum / n) * 3.2);
      }
      // attack 0.06s / release 0.14s
      const k = level > mouth ? 1 - Math.exp(-dt / 0.06) : 1 - Math.exp(-dt / 0.14);
      mouth += (level - mouth) * k;
      for (const name of MOUTH_MORPHS) setMorph(name, mouth * (MOUTH_GAIN[name] ?? 0.5));

      // Моргание.
      nextBlink -= dt;
      if (blink > 0) {
        blink -= dt / 0.13; // ~130мс на цикл
        if (blink < 0) blink = 0;
      } else if (nextBlink <= 0) {
        blink = 1;
        nextBlink = 2.5 + Math.random() * 3.5;
      }
      const blinkVal = Math.sin(Math.max(0, Math.min(1, blink)) * Math.PI);
      for (const name of BLINK_MORPHS) setMorph(name, blinkVal);

      // Микро-покачивание головы + лёгкое «оживление» при речи.
      if (headBone) {
        const amp = speakingRef.current || demoRef.current ? 0.05 : 0.025;
        headBone.rotation.y = headBaseRot.y + Math.sin(t * 0.7) * amp;
        headBone.rotation.x = headBaseRot.x + Math.sin(t * 0.9 + 1) * amp * 0.5 + mouth * 0.03;
      }

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        }
      });
    };
  }, [src]);

  return <div ref={mountRef} className="h-full min-h-[280px] w-full" aria-hidden />;
}
