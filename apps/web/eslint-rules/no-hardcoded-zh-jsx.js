/**
 * Reports any JSX text node containing Chinese characters not in the
 * Cambridge term allowlist. Forces components to use t.* keys for
 * user-visible strings.
 *
 * Allowlist: Cambridge term names + technical names that are not subject
 * to localization (e.g., "Leo", "Aria").
 *
 * Phase A: severity = "warn".
 * Phase L: severity flipped to "error" once apps/web/src is migration-clean.
 *
 * Source: docs/superpowers/specs/2026-04-29-ket-pet-redesign-design.md §5.3
 */
"use strict";

const ALLOWED = new Set([
  "KET",
  "PET",
  "A2 Key",
  "B1 Preliminary",
  "Reading",
  "Listening",
  "Writing",
  "Speaking",
  "Vocab",
  "Grammar",
  "Mina",
  "Leo",
  "Aria",
]);

const CHINESE = /[一-鿿]/;

function isAllowedFragment(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (!CHINESE.test(trimmed)) return true;
  if (ALLOWED.has(trimmed)) return true;
  return false;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hardcoded Chinese characters in JSX text; require t.* keys",
      recommended: false,
    },
    schema: [],
    messages: {
      hardcoded:
        "Hardcoded Chinese in JSX: {{text}}. Move it into apps/web/src/i18n/zh-CN.ts under a t.* key.",
    },
  },
  create(context) {
    return {
      JSXText(node) {
        const text = node.value;
        if (!isAllowedFragment(text)) {
          context.report({
            node,
            messageId: "hardcoded",
            data: { text: text.trim().slice(0, 50) },
          });
        }
      },
      Literal(node) {
        const parent = node.parent;
        if (!parent || parent.type !== "JSXExpressionContainer") return;
        if (typeof node.value !== "string") return;
        if (!isAllowedFragment(node.value)) {
          context.report({
            node,
            messageId: "hardcoded",
            data: { text: node.value.trim().slice(0, 50) },
          });
        }
      },
    };
  },
};
