type EditHandlers = {
  isDirty: () => boolean;
  save: () => Promise<void>;
};

export type UnsavedChangesPrompt = {
  open: boolean;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onStay: () => void;
  saving: boolean;
};

type PromptListener = (prompt: UnsavedChangesPrompt | null) => void;

let editHandlers: EditHandlers | null = null;
let promptListener: PromptListener | null = null;
let pendingProceed: (() => void) | null = null;
let allowLeave = false;

export function setProfileEditHandlers(handlers: EditHandlers | null): void {
  editHandlers = handlers;
  if (!handlers) allowLeave = false;
}

export function subscribeUnsavedPrompt(listener: PromptListener): () => void {
  promptListener = listener;
  return () => {
    if (promptListener === listener) promptListener = null;
  };
}

function emitPrompt(saving: boolean) {
  promptListener?.({
    open: true,
    saving,
    onSave: () => handleSaveAndLeave(),
    onDiscard: () => handleDiscardAndLeave(),
    onStay: () => {
      pendingProceed = null;
      promptListener?.(null);
    },
  });
}

async function handleSaveAndLeave() {
  if (!editHandlers) return;
  emitPrompt(true);
  try {
    await editHandlers.save();
    allowLeave = true;
    promptListener?.(null);
    const proceed = pendingProceed;
    pendingProceed = null;
    proceed?.();
  } catch {
    emitPrompt(false);
  }
}

function handleDiscardAndLeave() {
  allowLeave = true;
  promptListener?.(null);
  const proceed = pendingProceed;
  pendingProceed = null;
  proceed?.();
}

/** Call before changing routes while profile edit may have unsaved changes. */
export function attemptNavigation(proceed: () => void): void {
  if (editHandlers?.isDirty() && !allowLeave) {
    pendingProceed = proceed;
    emitPrompt(false);
    return;
  }
  proceed();
}

export function resetProfileEditLeaveFlag(): void {
  allowLeave = false;
}
