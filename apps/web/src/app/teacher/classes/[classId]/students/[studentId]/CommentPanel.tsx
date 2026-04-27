"use client";

import { useState } from "react";
import {
  createCommentAction,
  deleteCommentAction,
} from "@/lib/commentActions";

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorId: string;
};

type Props = {
  classId: string;
  studentId: string;
  currentUserId: string;
  comments: CommentItem[];
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommentPanel({
  classId,
  studentId,
  currentUserId,
  comments,
}: Props) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = 1000 - body.length;

  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-white p-5 stitched-card">
      <div className="mb-3 text-sm font-extrabold">留言给学生</div>

      <form
        action={async (fd) => {
          setError(null);
          setSubmitting(true);
          try {
            await createCommentAction(fd);
            setBody(""); // cleared on success via revalidation
          } catch (e) {
            setError(e instanceof Error ? e.message : "发送失败");
          } finally {
            setSubmitting(false);
          }
        }}
        className="space-y-2"
      >
        <input type="hidden" name="classId" value={classId} />
        <input type="hidden" name="targetUserId" value={studentId} />
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={1000}
          required
          placeholder="写一条只有这位学生能看到的留言（作为老师对学生的反馈、鼓励、提醒等）"
          className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition"
        />
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-ink/40">
            剩余 {remaining} 字 · 学生将在「历史记录」页面看到
          </div>
          <button
            type="submit"
            disabled={submitting || body.trim().length === 0}
            className="rounded-full bg-ink px-3 py-1.5 text-sm font-extrabold text-white transition hover:bg-ink/90 disabled:opacity-50"
          >
            {submitting ? "发送中…" : "发送留言"}
          </button>
        </div>
        {error && (
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}
      </form>

      {comments.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="text-xs font-bold text-ink/55">
            已发送 {comments.length} 条
          </div>
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border-2 border-ink/10 bg-cream-tint p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-ink/55">
                      {c.authorName} · {formatDateTime(c.createdAt)}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">
                      {c.body}
                    </p>
                  </div>
                  {c.authorId === currentUserId && (
                    <form action={deleteCommentAction}>
                      <input type="hidden" name="commentId" value={c.id} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-full border-2 border-ink/15 bg-white px-2 py-0.5 text-xs font-bold text-ink/55 hover:bg-red-50 hover:text-red-700 transition"
                      >
                        删除
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
