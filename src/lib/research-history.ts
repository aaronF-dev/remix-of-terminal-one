// Firestore-backed research history. Each user's analyses, comparisons, and
// agent runs are stored under users/{uid}/research/{docId} so the full
// payload follows them across devices and sessions and can be re-rendered
// without re-running the AI.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type HistoryEntry =
  | {
      kind: "analysis";
      id: string;
      createdAt: string;
      symbol: string;
      name: string;
      summary: string;
      confidence: "low" | "medium" | "high";
      fetchedAt: string;
      payload?: unknown;
    }
  | {
      kind: "comparison";
      id: string;
      createdAt: string;
      symbols: string[];
      winner: string;
      summary: string;
      fetchedAt: string;
      payload?: unknown;
    }
  | {
      kind: "agent";
      id: string;
      createdAt: string;
      agentKind: string;
      agentName: string;
      symbol: string;
      name: string;
      summary: string;
      fetchedAt: string;
      payload?: unknown;
    };

type NewEntry =
  | Omit<Extract<HistoryEntry, { kind: "analysis" }>, "id" | "createdAt">
  | Omit<Extract<HistoryEntry, { kind: "comparison" }>, "id" | "createdAt">
  | Omit<Extract<HistoryEntry, { kind: "agent" }>, "id" | "createdAt">;

const MAX = 200;

function userCol(uid: string) {
  return collection(db, "users", uid, "research");
}

function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function dedupeId(entry: NewEntry): string {
  if (entry.kind === "analysis") return `analysis_${entry.symbol}`;
  if (entry.kind === "comparison") return `comparison_${[...entry.symbols].sort().join("-")}`;
  return `agent_${entry.agentKind}_${entry.symbol}`;
}

// Firestore rejects `undefined`. Recursively strip it so we don't blow up
// when an AI payload omits an optional field.
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export async function addHistory(entry: NewEntry): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  const id = dedupeId(entry);
  const ref = doc(userCol(uid), id);
  await setDoc(
    ref,
    stripUndefined({
      ...entry,
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
    }),
  );
}

export async function removeHistory(id: string): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  await deleteDoc(doc(userCol(uid), id));
}

export async function clearHistory(): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  const snap = await getDocs(userCol(uid));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export function subscribeHistory(
  uid: string,
  cb: (entries: HistoryEntry[]) => void,
): () => void {
  const q = query(userCol(uid), orderBy("createdAt", "desc"), limit(MAX));
  return onSnapshot(
    q,
    (snap) => {
      const out: HistoryEntry[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<HistoryEntry, "id">;
        out.push({ ...(data as HistoryEntry), id: d.id });
      });
      cb(out);
    },
    () => cb([]),
  );
}

export async function getHistoryEntry(id: string): Promise<HistoryEntry | null> {
  const uid = currentUid();
  if (!uid) return null;
  const snap = await getDoc(doc(userCol(uid), id));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Omit<HistoryEntry, "id">), id: snap.id } as HistoryEntry;
}
