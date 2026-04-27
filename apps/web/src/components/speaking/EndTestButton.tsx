"use client";

import { useState } from "react";

interface Props {
  onConfirm: () => void;
  disabled?: boolean;
}

export function EndTestButton({ onConfirm, disabled }: Props) {
  const [showing, setShowing] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setShowing(true)}
        disabled={disabled}
        className="rounded-full bg-ink text-white text-sm font-extrabold px-5 py-2 hover:bg-ink/90 transition disabled:opacity-40"
      >
        结束测试
      </button>
      {showing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white border-2 border-ink/10 p-6 text-center stitched-card">
            <p className="text-base font-extrabold text-ink">确认结束本次测试?</p>
            <p className="mt-1 text-sm font-medium text-ink/65">尚未完成的部分将计为 0 分。</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowing(false)}
                className="rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-bold hover:bg-ink/5 transition"
              >
                继续测试
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowing(false);
                  onConfirm();
                }}
                className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-extrabold text-white hover:bg-red-500 transition"
              >
                结束
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
