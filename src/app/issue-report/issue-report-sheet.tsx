"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { IssueDraft, IssueReportPreview, IssueReportType, ReportedIssue } from "@/core";
import { previewIssue, submitIssue } from "./actions";
import { capturePage, currentPage, prepareAttachment, REPORT_UI_ATTRIBUTE } from "./capture";

interface ImageFile {
  file: File;
  /** Object URL for showing it. */
  src: string;
}

type Step = { name: "editing" } | { name: "previewing"; draft: IssueDraft } | { name: "sent"; issue: ReportedIssue };

const MAX_ATTACHMENTS = 5;

const buttonClass = "rounded-lg px-4 py-3 text-base font-medium disabled:opacity-60";
const primaryClass = `${buttonClass} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`;
const secondaryClass = `${buttonClass} border border-zinc-300 dark:border-zinc-700`;

/**
 * The owner's "Report issue" control: a floating button that captures the page (private elements
 * masked) and opens a sheet to describe a bug or idea, preview the issue, and post it to GitHub.
 */
export function IssueReportSheet({ repository }: { repository: string }) {
  const params = useParams();
  const dialog = useRef<HTMLDialogElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [step, setStep] = useState<Step>({ name: "editing" });
  const [type, setType] = useState<IssueReportType>("bug");
  const [description, setDescription] = useState("");
  const [capture, setCapture] = useState<ImageFile | null>(null);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [includeCapture, setIncludeCapture] = useState(true);
  const [attachments, setAttachments] = useState<ImageFile[]>([]);
  const [page, setPage] = useState<IssueReportPreview["page"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Object URLs live until their image is replaced or removed.
  useEffect(() => () => void (capture && URL.revokeObjectURL(capture.src)), [capture]);

  async function open() {
    setCapturing(true);
    setPage(currentPage(params ?? {}));
    try {
      const blob = await capturePage();
      setCapture(imageFile(new File([blob], "page.png", { type: "image/png" })));
      setCaptureFailed(false);
    } catch (captureError) {
      console.error("Page capture failed", captureError);
      setCapture(null);
      setCaptureFailed(true);
    } finally {
      setCapturing(false);
    }
    setError(null);
    if (step.name !== "editing") setStep({ name: "editing" });
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
  }

  function reset() {
    setStep({ name: "editing" });
    setType("bug");
    setDescription("");
    setIncludeCapture(true);
    attachments.forEach((a) => URL.revokeObjectURL(a.src));
    setAttachments([]);
    setError(null);
  }

  function images(): { kind: "page-capture" | "attachment"; file: File }[] {
    return [
      ...(capture && includeCapture ? [{ kind: "page-capture" as const, file: capture.file }] : []),
      ...attachments.map((a) => ({ kind: "attachment" as const, file: a.file })),
    ];
  }

  function report(): IssueReportPreview {
    return {
      type,
      description,
      page: page ?? currentPage(params ?? {}),
      images: images().map(({ kind, file }) => ({ kind, name: file.name, contentType: file.type })),
    };
  }

  function showPreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewIssue(report());
      if ("error" in result) setError(result.error);
      else setStep({ name: "previewing", draft: result.draft });
    });
  }

  function submit() {
    setError(null);
    const formData = new FormData();
    formData.set("report", JSON.stringify(report()));
    images().forEach(({ file }, index) => formData.set(`image-${index}`, file));
    startTransition(async () => {
      try {
        const result = await submitIssue(formData);
        if ("error" in result) setError(result.error);
        else setStep({ name: "sent", issue: result.issue });
      } catch {
        setError("Couldn't send the report. Check your connection and try again.");
      }
    });
  }

  async function attach(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = MAX_ATTACHMENTS - attachments.length;
    if (files.length > room) setError(`At most ${MAX_ATTACHMENTS} attached images.`);
    const added: ImageFile[] = [];
    for (const file of [...files].slice(0, room)) {
      try {
        added.push(imageFile(await prepareAttachment(file)));
      } catch {
        setError(`${file.name} couldn't be read as an image.`);
      }
    }
    setAttachments((previous) => [...previous, ...added]);
  }

  function removeAttachment(index: number) {
    URL.revokeObjectURL(attachments[index].src);
    setAttachments((previous) => previous.filter((_, i) => i !== index));
  }

  return (
    <div {...{ [REPORT_UI_ATTRIBUTE]: "" }}>
      <button
        type="button"
        aria-label="Report issue"
        onClick={open}
        disabled={capturing}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {capturing ? <Spinner /> : <ReportIcon />}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="issue-report-title"
        onClose={() => step.name === "sent" && reset()}
        className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-2xl bg-white p-0 text-zinc-900 backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-2xl dark:bg-zinc-900 dark:text-zinc-100"
      >
        <div className="flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-4">
            <h2 id="issue-report-title" className="text-lg font-semibold">
              {step.name === "previewing" ? "Check before sending" : "Report an issue"}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="-mr-2 flex size-11 items-center justify-center rounded-full text-2xl text-zinc-600 dark:text-zinc-300"
            >
              ×
            </button>
          </div>

          {step.name === "editing" && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                showPreview();
              }}
            >
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 font-medium">Type</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["bug", "idea"] as const).map((option) => (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-300 py-3 has-checked:border-zinc-900 has-checked:bg-zinc-900 has-checked:text-white dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-100 dark:has-checked:text-zinc-900"
                    >
                      <input
                        type="radio"
                        name="issue-type"
                        value={option}
                        checked={type === option}
                        onChange={() => setType(option)}
                        className="sr-only"
                      />
                      {option === "bug" ? "Bug" : "Idea"}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-1">
                <label htmlFor="issue-description" className="font-medium">
                  Description
                </label>
                <textarea
                  id="issue-description"
                  required
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={type === "bug" ? "What went wrong? What did you expect?" : "What would help?"}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-base dark:border-zinc-700"
                />
                <p className="text-sm text-zinc-600 dark:text-zinc-400">The first line becomes the issue title.</p>
              </div>

              <section className="flex flex-col gap-2" aria-labelledby="issue-capture-heading">
                <h3 id="issue-capture-heading" className="font-medium">
                  Page capture
                </h3>
                {capture ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                    <img
                      src={capture.src}
                      alt="Capture of this page, private content masked"
                      className={`max-h-56 w-fit rounded-lg border border-zinc-200 object-contain object-left-top dark:border-zinc-700 ${includeCapture ? "" : "opacity-40"}`}
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={includeCapture}
                        onChange={(event) => setIncludeCapture(event.target.checked)}
                        className="size-5"
                      />
                      Include the page capture <span className="text-zinc-600 dark:text-zinc-400">(private content masked)</span>
                    </label>
                  </>
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {captureFailed ? "This page couldn't be captured. Attach a screenshot instead." : "No capture."}
                  </p>
                )}
              </section>

              <section className="flex flex-col gap-2" aria-labelledby="issue-attachments-heading">
                <h3 id="issue-attachments-heading" className="font-medium">
                  Attached images <span className="font-normal text-zinc-500">(optional, not masked)</span>
                </h3>
                {attachments.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {attachments.map((attachment, index) => (
                      <li key={attachment.src} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                        <img
                          src={attachment.src}
                          alt={`Attachment ${index + 1}`}
                          className="size-20 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                        />
                        <button
                          type="button"
                          aria-label={`Remove attachment ${index + 1}`}
                          onClick={() => removeAttachment(index)}
                          className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {attachments.length < MAX_ATTACHMENTS && (
                  <label className={`${secondaryClass} w-fit cursor-pointer`}>
                    Attach images
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        void attach(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
              </section>

              <ErrorMessage error={error} />
              <button type="submit" disabled={pending} className={primaryClass}>
                {pending ? "Preparing preview…" : "Preview"}
              </button>
            </form>
          )}

          {step.name === "previewing" && (
            <div className="flex flex-col gap-4">
              <div role="note" className="rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800">
                <strong>This will be public.</strong> Issues on {repository} can be read by anyone. Private content is
                masked in the page capture.
              </div>
              {attachments.length > 0 && (
                <div
                  role="note"
                  className="rounded-lg border-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100"
                >
                  <strong>Attached images are not masked.</strong> Check they show nothing private before sending.
                </div>
              )}

              <section data-testid="issue-preview" aria-label="Issue preview" className="flex flex-col gap-2">
                <p className="text-lg font-semibold break-words">{step.draft.title}</p>
                <ul aria-label="Labels" className="flex flex-wrap gap-2">
                  {step.draft.labels.map((label) => (
                    <li key={label} className="rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
                      {label}
                    </li>
                  ))}
                </ul>
                <pre className="max-h-72 overflow-auto rounded-lg bg-zinc-100 p-3 font-mono text-xs whitespace-pre-wrap break-words dark:bg-zinc-800">
                  {step.draft.body}
                </pre>
                {images().length > 0 && (
                  <ul aria-label="Images to upload" className="flex flex-wrap gap-2">
                    {capture && includeCapture && (
                      <li>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                        <img
                          src={capture.src}
                          alt="Page capture to upload, private content masked"
                          className="max-h-56 rounded-lg border border-zinc-200 dark:border-zinc-700"
                        />
                      </li>
                    )}
                    {attachments.map((attachment, index) => (
                      <li key={attachment.src}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                        <img
                          src={attachment.src}
                          alt={`Attachment ${index + 1} to upload, not masked`}
                          className="max-h-56 rounded-lg border-2 border-amber-500"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <ErrorMessage error={error} />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    setStep({ name: "editing" });
                  }}
                  className={secondaryClass}
                >
                  Back
                </button>
                <button type="button" disabled={pending} onClick={submit} className={primaryClass}>
                  {pending ? "Sending…" : "Submit issue"}
                </button>
              </div>
            </div>
          )}

          {step.name === "sent" && (
            <div className="flex flex-col gap-4">
              <p role="status">
                Created{" "}
                <a
                  href={step.issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-700 underline dark:text-blue-400"
                >
                  issue #{step.issue.number}
                </a>
                . It&apos;s waiting for triage.
              </p>
              <button type="button" onClick={close} className={primaryClass}>
                Done
              </button>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}

function imageFile(file: File): ImageFile {
  return { file, src: URL.createObjectURL(file) };
}

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {error}
    </p>
  );
}

function ReportIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v11H8l-4 4V5Z" />
      <path strokeLinecap="round" d="M12 8v3.5M12 14h.01" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
