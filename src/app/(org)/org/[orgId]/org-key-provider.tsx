"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  generateOrgKey,
  generateRecoveryCode,
  normalizeRecoveryCode,
  unwrapOrgKey,
  wrapOrgKey,
  type KdfParams,
} from "@/lib/org/crypto";
import { setupOrgKeyAction, saveOrgKeyWrapAction } from "../actions";

/**
 * Ключ организации в памяти вкладки (L2, docs/B2B-PLAN.md §5.2).
 *
 * Ключ живёт только в состоянии React: ни localStorage, ни sessionStorage,
 * ни cookie — закрыли вкладку, ключ исчез. Это осознанная цена: расшифровать
 * метки можно лишь после ввода фразы, зато украденный дамп браузера или базы
 * ничего не даёт.
 *
 * Кабинет полностью работоспособен и без ключа — тогда сотрудники видны по
 * кодам (acme-0042). Разблокировка нужна только чтобы видеть метки.
 */

export interface StoredWrap {
  kind: "admin" | "recovery";
  wrappedKey: string;
  kdfSalt: string;
  kdfParams: KdfParams;
}

/**
 * «owner-view» — кабинет открыт владельцем платформы. Подписи ему недоступны
 * по замыслу, а не потому, что он не ввёл фразу: ключа у него нет и завести
 * его он не может (см. layout и setupOrgKeyAction).
 */
type Status = "owner-view" | "not-configured" | "locked" | "unlocked";

interface OrgKeyContextValue {
  status: Status;
  orgKey: CryptoKey | null;
  /** Ввести парольную фразу или recovery-код и получить доступ к меткам. */
  unlock: (secret: string) => Promise<string | null>;
  /** Первичная настройка: генерирует ключ, возвращает recovery-код для показа. */
  setup: (passphrase: string) => Promise<{ recoveryCode: string } | { error: string }>;
  /** Сменить парольную фразу (ключ и метки остаются прежними). */
  changePassphrase: (next: string) => Promise<string | null>;
  lock: () => void;
}

const OrgKeyContext = createContext<OrgKeyContextValue>({
  status: "not-configured",
  orgKey: null,
  unlock: async () => "Контекст не инициализирован",
  setup: async () => ({ error: "Контекст не инициализирован" }),
  changePassphrase: async () => "Контекст не инициализирован",
  lock: () => {},
});

export function useOrgKey(): OrgKeyContextValue {
  return useContext(OrgKeyContext);
}

export function OrgKeyProvider({
  orgId,
  wraps,
  viewerIsOwner = false,
  children,
}: {
  orgId: string;
  wraps: StoredWrap[];
  viewerIsOwner?: boolean;
  children: React.ReactNode;
}) {
  const [orgKey, setOrgKey] = useState<CryptoKey | null>(null);
  const [configured, setConfigured] = useState(wraps.length > 0);

  const status: Status = viewerIsOwner
    ? "owner-view"
    : orgKey
      ? "unlocked"
      : configured
        ? "locked"
        : "not-configured";

  const unlock = useCallback(
    async (secret: string): Promise<string | null> => {
      const input = secret.trim();
      if (!input) return "Введите фразу или код восстановления";

      // Пробуем все обёртки: пользователь мог ввести и фразу, и recovery-код —
      // отдельного переключателя для этого не нужно.
      const candidates = [
        ...wraps.filter((w) => w.kind === "admin"),
        ...wraps.filter((w) => w.kind === "recovery"),
      ];

      for (const wrap of candidates) {
        const secretForWrap =
          wrap.kind === "recovery" ? normalizeRecoveryCode(input) : input;
        try {
          const key = await unwrapOrgKey(wrap, secretForWrap);
          setOrgKey(key);
          return null;
        } catch {
          // не эта обёртка — пробуем следующую
        }
      }
      return "Не подошла ни фраза, ни код восстановления";
    },
    [wraps],
  );

  const setup = useCallback(
    async (passphrase: string) => {
      const key = await generateOrgKey();
      const recoveryCode = generateRecoveryCode();

      const [admin, recovery] = await Promise.all([
        wrapOrgKey(key, passphrase),
        wrapOrgKey(key, normalizeRecoveryCode(recoveryCode)),
      ]);

      const res = await setupOrgKeyAction({ orgId, admin, recovery });
      if (!res.ok) return { error: res.error };

      setOrgKey(key);
      setConfigured(true);
      return { recoveryCode };
    },
    [orgId],
  );

  const changePassphrase = useCallback(
    async (next: string): Promise<string | null> => {
      if (!orgKey) return "Сначала введите текущую фразу";
      const wrap = await wrapOrgKey(orgKey, next);
      const res = await saveOrgKeyWrapAction({ orgId, kind: "admin", wrap });
      return res.ok ? null : res.error;
    },
    [orgId, orgKey],
  );

  const lock = useCallback(() => setOrgKey(null), []);

  const value = useMemo(
    () => ({ status, orgKey, unlock, setup, changePassphrase, lock }),
    [status, orgKey, unlock, setup, changePassphrase, lock],
  );

  return <OrgKeyContext.Provider value={value}>{children}</OrgKeyContext.Provider>;
}
