"use client";

/**
 * Bringing a JSON Resume file in (M2-T6).
 *
 * The other half of the export, and the half that makes it mean something:
 * a format you can only write to is a one-way door with a nicer sign on it.
 *
 * Replacing the whole document is destructive, so it is **undoable** — the
 * import goes through the normal history stack, and Ctrl+Z brings the
 * previous draft back. That is a better guarantee than a confirmation
 * dialog, which asks for a decision before the user can see the result.
 */

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/control";
import { fromJsonResume } from "@/lib/interop/json-resume";
import { useResumeStore } from "@/store/resume";

export function ImportJsonResume() {
  const importDocument = useResumeStore((state) => state.importDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setMessage({ tone: "error", text: "That file is not valid JSON." });
      return;
    }

    const result = fromJsonResume(parsed);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }

    importDocument(result.document);
    setMessage({
      tone: "ok",
      text: `Imported ${file.name}. Undo (Ctrl+Z) puts your previous draft back.`,
    });
    // Cleared so selecting the same file again re-triggers the change event.
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <Button variant="ghost" onClick={() => inputRef.current?.click()}>
        Import a JSON Resume file
      </Button>
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={
            message.tone === "error"
              ? "text-xs font-medium text-red-600 dark:text-red-400"
              : "text-xs text-zinc-600 dark:text-zinc-400"
          }
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
