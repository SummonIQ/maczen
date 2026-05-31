"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { getAnalytics } from "@summoniq/signalsplash-client-sdk";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  const isSubmitting = state === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("submitting");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await response.json();
      if (!response.ok) {
        setState("error");
        setError(data.error || "Could not send your message.");
        getAnalytics()?.track("contact_form_error", { error: data.error });
        return;
      }

      setState("success");
      getAnalytics()?.track("contact_form_submitted");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setState("error");
      setError("Network error while sending your message.");
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white/95 p-6 shadow-lg sm:p-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-600 text-white">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Send us a message</h2>
          <p className="text-sm text-muted-foreground">
            We typically reply within 1 business day.
          </p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            maxLength={160}
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="message"
            className="mb-1.5 block text-sm font-medium"
          >
            Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            minLength={10}
            maxLength={4000}
            rows={6}
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            placeholder="How can we help?"
          />
        </div>

        {state === "error" && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {state === "success" && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Message sent. Thanks for reaching out.
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send message"
          )}
        </button>
      </form>
    </div>
  );
}
