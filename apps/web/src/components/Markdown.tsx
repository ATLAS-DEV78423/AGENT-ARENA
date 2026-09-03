"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

/**
 * Renders agent/judge message content as markdown, styled to the app theme via
 * the `.md-content` rules in globals.css. Raw HTML in model output is escaped
 * (react-markdown default), so transcripts cannot inject markup.
 */
export function Markdown({
  content,
  tone = "default",
  className,
}: {
  content: string;
  tone?: "default" | "judge";
  className?: string;
}) {
  return (
    <div className={cn("md-content", tone === "judge" && "md-content-judge", className)}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
