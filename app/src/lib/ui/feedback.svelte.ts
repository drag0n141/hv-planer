/** Kurze Rückmeldungen (Toasts) und Rückfragen, als Ersatz für alert()/confirm(). */

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "ok";
}

export interface ConfirmRequest {
  title: string;
  text: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

class Feedback {
  toasts = $state<Toast[]>([]);
  pending = $state<ConfirmRequest | null>(null);
  private seq = 0;

  toast(text: string, kind: Toast["kind"] = "info") {
    const id = ++this.seq;
    this.toasts.push({ id, text, kind });
    setTimeout(() => this.dismiss(id), kind === "error" ? 6000 : 3500);
  }
  error(e: unknown) {
    this.toast(e instanceof Error ? e.message : String(e), "error");
  }
  dismiss(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  confirm(title: string, text: string, { confirmLabel = "OK", danger = false } = {}): Promise<boolean> {
    return new Promise((resolve) => {
      this.pending = { title, text, confirmLabel, danger, resolve };
    });
  }
  answer(ok: boolean) {
    this.pending?.resolve(ok);
    this.pending = null;
  }
}

export const feedback = new Feedback();
