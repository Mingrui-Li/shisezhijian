/** Pure layout in the 390-wide design space; every tray home keeps its original page/slot. */
export function boardLayout(height: number, safeTop: number, safeBottom: number,
    columns: number, rows: number, trayCount: number) {
    const gap = 6;
    const reservedBoardTop = safeTop + 92;
    const propsY = height - safeBottom - 38;
    const actionsY = propsY - 72;
    // Footer buttons remain in a predictable location; the puzzle is a single centered group above them.
    const groupLimitBottom = actionsY - 32;
    const trayColumns = Math.min(6, Math.max(1, trayCount));
    let trayRows = Math.min(3, Math.max(1, Math.ceil(trayCount / trayColumns)));
    const trayGap = rows >= 5 ? 32 : 44;
    const maxCellSize = columns <= 4 && rows <= 2 ? 68 : 52;
    const boardSize = (visibleTrayRows: number) => {
        const trayHeight = visibleTrayRows * 44 + (visibleTrayRows - 1) * gap;
        const hasPages = trayCount > trayColumns * visibleTrayRows;
        const available = groupLimitBottom - reservedBoardTop - trayHeight - trayGap - (hasPages ? 44 : 0);
        return Math.min(maxCellSize, (342 - (columns - 1) * gap) / columns,
            (available - (rows - 1) * gap) / rows);
    };
    while (trayRows > 1 && boardSize(trayRows) < 44) trayRows--;
    const cellSize = Math.max(24, boardSize(trayRows));
    const boardWidth = columns * cellSize + (columns - 1) * gap;
    const boardHeight = rows * cellSize + (rows - 1) * gap;
    const trayHeight = trayRows * 44 + (trayRows - 1) * gap;
    const trayWidth = trayColumns * 44 + (trayColumns - 1) * gap;
    const slotsPerPage = trayColumns * trayRows;
    const hasPages = trayCount > slotsPerPage;
    const groupHeight = boardHeight + trayGap + trayHeight;
    const completeHeight = groupHeight + (hasPages ? 44 : 0);
    const groupTop = reservedBoardTop + Math.max(0,
        (groupLimitBottom - reservedBoardTop - completeHeight) / 2);
    const trayTop = groupTop + boardHeight + trayGap;
    return {
        cellSize, pitch: cellSize + gap, boardTop: groupTop, boardHeight, boardWidth,
        boardStartX: 195 - (columns - 1) * (cellSize + gap) / 2,
        boardStartY: groupTop + cellSize / 2,
        trayColumns, trayRows, trayCellSize: 44, trayPitch: 50,
        trayTop, trayHeight, trayWidth, trayGap, trayLabelY: trayTop - 18,
        slotsPerPage, propsY, actionsY, pagerY: trayTop + trayHeight + 24,
        groupTop, groupHeight, groupWidth: Math.max(boardWidth, trayWidth),
        compact: cellSize < 44,
    };
}
