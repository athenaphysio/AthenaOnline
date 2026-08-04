"use client";

import type { ReactNode } from "react";
import styles from "./PickerCanvas.module.css";

export type PickerCanvasProps<TPickerItem, TCanvasItem> = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: { value: string; label: string }[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;

  pickerTitle?: string;
  pickerItems: TPickerItem[];
  getPickerItemKey: (item: TPickerItem) => string;
  renderPickerItem: (item: TPickerItem) => ReactNode;
  isAdded: (item: TPickerItem) => boolean;
  onAdd: (item: TPickerItem) => void;
  pickerEmptyMessage?: string;
  pickerExtra?: ReactNode;

  /** Optional ranked suggestions shown above the full list, each with a
   * short reason. Only shown while the search box is empty -- the instant
   * the clinician types a search, this is ignored and the plain full-library
   * results render as normal, so nothing is ever hidden. Selecting nothing
   * automatically -- it's a suggested order only, added the same way as any
   * other row.
   *
   * Pass an empty array (not undefined) when ranking genuinely ran and
   * found nothing worth surfacing -- that renders `topPicksEmptyMessage`
   * instead of silently showing nothing, so a real "no good match" reads
   * differently from ranking never having run (undefined) or having failed
   * (also leave undefined -- a failure should degrade silently to the plain
   * full library, not be reported as "no good match"). */
  topPicks?: { item: TPickerItem; reason: string }[];
  topPicksTitle?: string;
  topPicksLoading?: boolean;
  topPicksEmptyMessage?: string;

  canvasTitle?: string;
  canvasItems: TCanvasItem[];
  getCanvasItemKey: (item: TCanvasItem) => string;
  renderCanvasItem: (item: TCanvasItem, index: number) => ReactNode;
  canvasRowExtra?: (item: TCanvasItem, index: number) => ReactNode;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  onRemove: (index: number) => void;
  canvasEmptyMessage?: string;

  /** Optional: group canvas rows into labelled sections (e.g. by slot type).
   * The underlying order/move/remove callbacks still operate on the flat
   * `canvasItems` array by its real index -- grouping is a display concern
   * only. Sections render in `groupOrder`; any group not listed there falls
   * back to appearing in first-seen order after the listed ones. */
  groupCanvasBy?: (item: TCanvasItem) => string;
  groupOrder?: string[];
};

// Shared thumbnail for picker rows: a real image when one exists, otherwise
// a plain initial-letter swatch. Blocks/Workouts have no image of their
// own, so this fallback is what most rows will actually use.
export function PickerThumb({ src, label }: { src?: string | null; label: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={styles.thumb} />;
  }
  return <div className={styles.thumbFallback}>{label.charAt(0).toUpperCase()}</div>;
}

// Shared name + tag-chip body for a picker result row, so every builder's
// picker looks consistent without duplicating the markup/classes.
export function PickerResultBody({ name, tags }: { name: string; tags?: (string | null | undefined)[] }) {
  const realTags = (tags ?? []).filter((t): t is string => Boolean(t));
  return (
    <div className={styles.resultBody}>
      <div className={styles.resultName}>{name}</div>
      {realTags.length > 0 && (
        <div className={styles.resultTags}>
          {realTags.map((t, i) => (
            <span key={i} className={styles.tag}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PickerCanvas<TPickerItem, TCanvasItem>({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilter,
  onFilterChange,
  pickerTitle = "Add",
  pickerItems,
  getPickerItemKey,
  renderPickerItem,
  isAdded,
  onAdd,
  pickerEmptyMessage = "Nothing found.",
  pickerExtra,
  topPicks,
  topPicksTitle = "Suggested for this programme",
  topPicksLoading,
  topPicksEmptyMessage = "Nothing in your library scores highly for this — here's the full list.",
  canvasTitle = "In this build",
  canvasItems,
  getCanvasItemKey,
  renderCanvasItem,
  canvasRowExtra,
  onMoveUp,
  onMoveDown,
  onRemove,
  canvasEmptyMessage = "Nothing added yet.",
  groupCanvasBy,
  groupOrder,
}: PickerCanvasProps<TPickerItem, TCanvasItem>) {
  const showArrows = Boolean(onMoveUp && onMoveDown);

  function renderRow(item: TCanvasItem, index: number) {
    return (
      <div key={getCanvasItemKey(item)} className={styles.canvasRow}>
        <div className={styles.canvasRowMain}>
          <div className={styles.canvasRowName}>{renderCanvasItem(item, index)}</div>
          <div className={styles.canvasControls}>
            {showArrows && (
              <>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => onMoveUp?.(index)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => onMoveDown?.(index)}
                  disabled={index === canvasItems.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </>
            )}
            <button
              type="button"
              className={styles.iconButtonDanger}
              onClick={() => onRemove(index)}
              aria-label="Remove"
            >
              🗑
            </button>
          </div>
        </div>
        {canvasRowExtra && <div className={styles.extraContent}>{canvasRowExtra(item, index)}</div>}
      </div>
    );
  }

  let canvasBody: ReactNode;
  if (groupCanvasBy) {
    const byGroup = new Map<string, { item: TCanvasItem; index: number }[]>();
    canvasItems.forEach((item, index) => {
      const key = groupCanvasBy(item);
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push({ item, index });
    });
    const orderedKeys = [
      ...(groupOrder ?? []).filter((k) => byGroup.has(k)),
      ...Array.from(byGroup.keys()).filter((k) => !(groupOrder ?? []).includes(k)),
    ];
    canvasBody = (
      <>
        {orderedKeys.map((key) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div className={styles.paneTitle} style={{ fontSize: 13, marginBottom: 8 }}>
              {key}
            </div>
            <div className={styles.canvasList}>{byGroup.get(key)!.map(({ item, index }) => renderRow(item, index))}</div>
          </div>
        ))}
      </>
    );
  } else {
    canvasBody = <div className={styles.canvasList}>{canvasItems.map((item, index) => renderRow(item, index))}</div>;
  }

  return (
    <div className={styles.layout}>
      <div className={styles.pane}>
        <div className={styles.paneTitle}>{pickerTitle}</div>
        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            placeholder={searchPlaceholder ?? "Search…"}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {filters && filters.length > 0 && (
            <select
              className={styles.filterSelect}
              value={activeFilter ?? ""}
              onChange={(e) => onFilterChange?.(e.target.value)}
            >
              <option value="">All types</option>
              {filters.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {pickerExtra}
        {(() => {
          const showTopPicks = Boolean(topPicks && topPicks.length > 0 && !searchQuery.trim());
          const showEmptyNote = Boolean(
            topPicks && topPicks.length === 0 && !topPicksLoading && !searchQuery.trim()
          );
          const topKeys = new Set(showTopPicks ? topPicks!.map((p) => getPickerItemKey(p.item)) : []);
          const restItems = showTopPicks ? pickerItems.filter((item) => !topKeys.has(getPickerItemKey(item))) : pickerItems;

          function renderResultRow(item: TPickerItem, reason?: string) {
            const added = isAdded(item);
            const row = (
              <div className={styles.resultRow}>
                {renderPickerItem(item)}
                {added ? (
                  <span className={styles.addedBadge}>✓ Added</span>
                ) : (
                  <button type="button" className={styles.addButton} onClick={() => onAdd(item)}>
                    Add
                  </button>
                )}
              </div>
            );
            if (!reason) return row;
            return (
              <div>
                {row}
                <div className={styles.reasonLine}>{reason}</div>
              </div>
            );
          }

          return (
            <>
              {!searchQuery.trim() && topPicksLoading && (
                <div className={styles.rankingNotice}>Ranking your library…</div>
              )}
              {showTopPicks && (
                <div className={styles.results} style={{ marginBottom: 10 }}>
                  <div className={styles.suggestedLabel}>{topPicksTitle}</div>
                  {topPicks!.map((p) => (
                    <div key={getPickerItemKey(p.item)}>{renderResultRow(p.item, p.reason)}</div>
                  ))}
                  <div className={styles.suggestedLabel} style={{ marginTop: 4 }}>
                    Full library
                  </div>
                </div>
              )}
              {showEmptyNote && <div className={styles.rankingNotice}>{topPicksEmptyMessage}</div>}
              <div className={styles.results}>
                {restItems.length === 0 && <div className={styles.emptyState}>{pickerEmptyMessage}</div>}
                {restItems.map((item) => (
                  <div key={getPickerItemKey(item)}>{renderResultRow(item)}</div>
                ))}
              </div>
            </>
          );
        })()}
      </div>

      <div className={styles.pane}>
        <div className={styles.paneTitle}>{canvasTitle}</div>
        {canvasItems.length === 0 && <div className={styles.emptyState}>{canvasEmptyMessage}</div>}
        {canvasBody}
      </div>
    </div>
  );
}
