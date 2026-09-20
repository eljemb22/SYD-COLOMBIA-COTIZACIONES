import { QuoteItem } from '../types';

export interface TablePageChunk {
  pageIndex: number; // 0-based
  pageNumber: number; // 1-based table page
  globalPageNumber: number; // 1-based overall doc page (e.g. 2, 3...)
  items: QuoteItem[];
  startIndex: number; // 0-based index in quoteItems array
  isLastTablePage: boolean;
  canFitConditions: boolean;
}

/**
 * Accurately estimates the rendered pixel height for a single quote item row inside the table,
 * considering character length of name, accessories, brand, and model with exact line wrapping.
 */
export function estimateItemRowHeight(item: QuoteItem, baseFontSize: number = 10): number {
  // Title / item name lines (fits ~36 uppercase characters per line in Description column)
  const nameChars = item.name ? item.name.length : 0;
  const nameLines = Math.max(1, Math.ceil(nameChars / 36));
  const titleHeight = nameLines * (baseFontSize * 1.25);

  // Accessories lines (fits ~46 uppercase characters per line in Description column)
  let accHeight = 0;
  if (item.accessories && item.accessories.length > 0) {
    let accTotalChars = 14; // "ACCESORIOS: "
    for (const acc of item.accessories) {
      accTotalChars += (acc.name?.length || 0) + (acc.quantity > 1 ? 7 : 0) + 2;
    }
    const accLines = Math.max(1, Math.ceil(accTotalChars / 46));
    const accFontSize = Math.max(7.5, baseFontSize - 1.5);
    accHeight = accLines * (accFontSize * 1.25) + 4;
  }

  // Model & Brand lines (fits ~10 chars per line in brand, ~11 chars in model)
  const modelChars = item.model ? item.model.length : 0;
  const modelLines = Math.ceil(modelChars / 11);
  const brandChars = item.brand ? item.brand.length : 0;
  const brandLines = Math.ceil(brandChars / 9);
  const sideLines = Math.max(modelLines, brandLines);
  let sideHeight = 0;
  if (sideLines > 1) {
    sideHeight = sideLines * (baseFontSize * 1.2);
  }

  // Combine components with padding (6px top/bottom padding + borders)
  const contentHeight = Math.max(titleHeight + accHeight, sideHeight);
  const totalRowHeight = contentHeight + 10;

  return Math.max(32, Math.round(totalRowHeight));
}

/**
 * Intelligent pagination algorithm that maximizes the usable area on every Letter-sized page
 * without ever touching or overlapping the letterhead footer.
 * 
 * Usable vertical budget breakdown on a 1056px Letter page:
 * - Top margin (subirBajar): typically ~140-155px
 * - Footer safety line: Footer text and Icontec/IQNet certification logos begin at ~865px.
 *   So the table must end strictly at or before 848px.
 * - Usable total table space: (848px - customTopMargin)
 * - Table header height: ~32px
 * - Totals row + Total in words box (last page only): ~78px
 */
export function chunkQuoteItemsForPages(
  items: QuoteItem[],
  customTopMargin: number = 150,
  fontSize: number = 10
): TablePageChunk[] {
  if (!items || items.length === 0) {
    return [
      {
        pageIndex: 0,
        pageNumber: 1,
        globalPageNumber: 2,
        items: [],
        startIndex: 0,
        isLastTablePage: true,
        canFitConditions: true,
      },
    ];
  }

  // Target bottom limit: 848px on a 1056px page leaves a comfortable, clean 18px safety buffer before Icontec/IQNet logos (~865px)
  const footerSafetyY = 848;
  const usableTotalHeight = Math.max(380, footerSafetyY - customTopMargin);
  const tableHeaderHeight = 32;
  const totalsSectionHeight = 78; // Totals footer row + "VALOR TOTAL EN LETRAS" box
  const conditionsSectionHeight = 410; // "CONDICIONES COMERCIALES" block + warranty + signature

  // Max body height allowed on a normal (non-last) page
  const maxNormalBodyHeight = usableTotalHeight - tableHeaderHeight;
  // Max body height allowed on the last page with totals and amount in words
  const maxLastPageBodyHeight = maxNormalBodyHeight - totalsSectionHeight;

  const pages: TablePageChunk[] = [];
  let currentChunk: QuoteItem[] = [];
  let currentChunkHeight = 0;
  let currentStartIndex = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowHeight = estimateItemRowHeight(item, fontSize);
    const isLastItem = i === items.length - 1;

    // Determine current limit: if this item were the last item in the quote, check if totals fit
    const limit = isLastItem ? maxLastPageBodyHeight : maxNormalBodyHeight;

    if (currentChunk.length > 0 && currentChunkHeight + rowHeight > limit) {
      // Chunk has reached capacity; push current page
      pages.push({
        pageIndex: pages.length,
        pageNumber: pages.length + 1,
        globalPageNumber: pages.length + 2,
        items: currentChunk,
        startIndex: currentStartIndex,
        isLastTablePage: false,
        canFitConditions: false,
      });

      // Start new chunk with the current item
      currentChunk = [item];
      currentChunkHeight = rowHeight;
      currentStartIndex = i;
    } else {
      currentChunk.push(item);
      currentChunkHeight += rowHeight;
    }
  }

  if (currentChunk.length > 0) {
    // Check if commercial conditions and signature can fit on this final table page
    const totalRequiredHeightWithConditions =
      tableHeaderHeight + currentChunkHeight + totalsSectionHeight + conditionsSectionHeight;
    const canFit = totalRequiredHeightWithConditions <= usableTotalHeight;

    pages.push({
      pageIndex: pages.length,
      pageNumber: pages.length + 1,
      globalPageNumber: pages.length + 2,
      items: currentChunk,
      startIndex: currentStartIndex,
      isLastTablePage: true,
      canFitConditions: canFit,
    });
  }

  // Ensure last table page flag and conditions fitting flag are accurately set
  pages.forEach((p, idx) => {
    p.isLastTablePage = idx === pages.length - 1;
    if (!p.isLastTablePage) {
      p.canFitConditions = false;
    }
  });

  return pages;
}
