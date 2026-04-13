"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EMOJI_CATEGORIES, QUICK_EMOJIS } from "@/lib/emojiCategories";

type EmojiStripProps = {
  onInsert: (emoji: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Optional class for the expand/collapse button (e.g. text-cyan-700 for journal, text-primary-600 for modals). */
  expandButtonClass?: string;
  /** Optional focus ring color for emoji buttons (e.g. focus:ring-cyan-500 for journal). Default focus:ring-primary-500 */
  buttonFocusRingClass?: string;
  /** When "cyan", tabs use cyan styling to match journal page. Default "primary". */
  tabVariant?: "primary" | "cyan";
};

export function EmojiStrip({
  onInsert,
  expanded,
  onToggleExpand,
  expandButtonClass = "text-primary-600 hover:text-primary-700 hover:underline",
  buttonFocusRingClass = "focus:ring-primary-500",
  tabVariant = "primary",
}: EmojiStripProps) {
  const [emojiCategoryTab, setEmojiCategoryTab] = useState(EMOJI_CATEGORIES[0].id);
  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === emojiCategoryTab);
  const tabActiveClass =
    tabVariant === "cyan"
      ? "bg-cyan-600 text-white border border-cyan-500"
      : "bg-primary-200 text-primary-900 border border-primary-400";
  const tabInactiveClass =
    tabVariant === "cyan"
      ? "bg-cyan-50/80 text-cyan-800 hover:bg-cyan-100 border border-transparent"
      : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent";

  return (
    <div className="mb-1">
      {expanded ? (
        <>
          <div className="flex flex-wrap gap-1 mb-2 border-b border-gray-200 pb-1.5">
            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setEmojiCategoryTab(cat.id)}
                className={`px-2 py-1 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 ${buttonFocusRingClass} ${
                  emojiCategoryTab === cat.id ? tabActiveClass : tabInactiveClass
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
            {(currentCategory?.emojis ?? []).map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onInsert(emoji)}
                onMouseDown={(e) => e.preventDefault()}
                className={`w-8 h-8 rounded-lg border border-gray-300 bg-white text-lg leading-none hover:bg-gray-50 focus:outline-none focus:ring-2 ${buttonFocusRingClass}`}
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onInsert(emoji)}
              onMouseDown={(e) => e.preventDefault()}
              className={`w-8 h-8 rounded-lg border border-gray-300 bg-white text-lg leading-none hover:bg-gray-50 focus:outline-none focus:ring-2 ${buttonFocusRingClass}`}
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onToggleExpand}
        className={`mt-1.5 flex items-center gap-1 text-xs focus:outline-none focus:ring-2 focus:ring-offset-1 rounded ${buttonFocusRingClass} ${expandButtonClass}`}
        aria-expanded={expanded}
      >
        {expanded ? (
          <>Fewer emojis <ChevronUp className="w-3.5 h-3.5 inline" /></>
        ) : (
          <>More emojis <ChevronDown className="w-3.5 h-3.5 inline" /></>
        )}
      </button>
    </div>
  );
}
