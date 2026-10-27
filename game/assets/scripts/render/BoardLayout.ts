/** Pure layout in the 390-wide design coordinate system; tray pages keep stable slot indices. */
export function boardLayout(height: number, safeTop: number, safeBottom: number,
    columns: number, rows: number, trayCount: number) {
    const gap = 6;
    const reservedBoardTop = safeTop + 82;
    const propsY = height - safeBottom - 38;
    const actionsY = propsY - 72;
    const pagerY = actionsY - 44;
    const trayBottom = pagerY - 20;
    const trayColumns = Math.min(6, Math.max(1, trayCount));
    let trayRows = Math.min(3, Math.max(1, Math.ceil(trayCount / trayColumns)));
    const boardSize = (visibleTrayRows: number) => {
        const trayHeight = visibleTrayRows * 44 + (visibleTrayRows - 1) * gap;
        const available = trayBottom - trayHeight - 40 - reservedBoardTop;
        return Math.min(columns <= 4 && rows <= 2 ? 68 : 52, (342 - (columns - 1) * gap) / columns,
            (available - (rows - 1) * gap) / rows);
    };
    while (trayRows > 1 && boardSize(trayRows) < 44) trayRows--;
    const cellSize = Math.max(24, boardSize(trayRows));
    const boardHeight = rows * cellSize + (rows - 1) * gap;
    const trayHeight = trayRows * 44 + (trayRows - 1) * gap;
    const trayTop = trayBottom - trayHeight;
    const boardTop = reservedBoardTop + Math.max(0, (trayTop - 40 - reservedBoardTop - boardHeight) / 2);
    return {
        cellSize, pitch: cellSize + gap, boardTop, boardHeight,
        boardStartX: 195 - (columns - 1) * (cellSize + gap) / 2,
        boardStartY: boardTop + cellSize / 2,
        trayColumns, trayRows, trayCellSize: 44, trayPitch: 50,
        trayTop, trayHeight, trayLabelY: trayTop - 18,
        slotsPerPage: trayColumns * trayRows, propsY, actionsY, pagerY,
        compact: cellSize < 44,
    };
}
