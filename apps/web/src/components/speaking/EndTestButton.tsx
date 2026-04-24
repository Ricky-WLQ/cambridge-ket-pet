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
        className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
      >
        结束测试
      </button>
      {showing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm rounded-xl bg-neutral-950 p-6 text-center shadow-xl">
            <p className="text-base text-neutral-100">确认结束本次测试?</p>
            <p className="mt-1 text-sm text-neutral-400">尚未完成的部分将计为 0 分。</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowing(false)}
                className="rounded px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-800"
              >
                继续测试
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowing(false);
                  onConfirm();
                }}
                className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-500"
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
