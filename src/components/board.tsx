import type { KeyboardEvent } from "react";
import { P1_STORE, P2_STORE, P1_PITS, P2_PITS } from "../game/sungka-engine";
import type { GameState } from "../game/sungka-engine";

interface ShellsProps {
  count: number;
  inStore?: boolean;
}

function Shells({ count, inStore = false }: ShellsProps) {
  const maxVisible = inStore ? 30 : 15;
  const visible = Math.min(count, maxVisible);
  return (
    <div className={inStore ? "store-shells" : "pit-shells"}>
      {Array.from({ length: visible }, (_, i) => (
        <div key={i} className={`shell${inStore ? " in-store" : ""}`} />
      ))}
    </div>
  );
}

interface BoardProps {
  gameState: GameState;
  onPitClick: (pitIndex: number) => void;
  validMoves: number[];
  animatingPit: number | null;
  playerOneLabel?: string;
  playerTwoLabel?: string;
}

export default function Board({
  gameState,
  onPitClick,
  validMoves,
  animatingPit,
  playerOneLabel = "Player 1",
  playerTwoLabel = "Player 2",
}: BoardProps) {
  const { pits, lastMove } = gameState;
  const burntPits = gameState.burntPits;

  // Player 2's pits go left to right across the top (indices 15 down to 9)
  const topRow = [...P2_PITS].reverse();
  // Player 1's pits go left to right across the bottom (indices 1 to 7)
  const bottomRow = [...P1_PITS];

  const isClickable = (pitIndex: number): boolean => {
    return validMoves.includes(pitIndex);
  };

  const isBurnt = (pitIndex: number): boolean => {
    return burntPits.includes(pitIndex);
  };

  const getPitAriaLabel = (pitIndex: number): string => {
    const shells = pits[pitIndex] ?? 0;
    const owner = pitIndex >= 9 ? playerTwoLabel : playerOneLabel;

    if (isBurnt(pitIndex)) {
      return `${owner} pit ${pitIndex}, burnt and unavailable`;
    }

    const action = isClickable(pitIndex)
      ? "Press Enter or Space to play this pit"
      : "Not playable right now";

    return `${owner} pit ${pitIndex}, ${shells} shell${shells === 1 ? "" : "s"}. ${action}`;
  };

  const handlePitKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    pitIndex: number,
  ): void => {
    if (!isClickable(pitIndex)) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPitClick(pitIndex);
    }
  };

  const renderPit = (pitIndex: number) => (
    <div
      key={pitIndex}
      className={`pit${isClickable(pitIndex) ? " clickable" : ""}${
        animatingPit === pitIndex ? " animating" : ""
      }${lastMove === pitIndex ? " last-move" : ""}${
        isBurnt(pitIndex) ? " burnt" : ""
      }`}
      role="button"
      tabIndex={isClickable(pitIndex) ? 0 : -1}
      aria-label={getPitAriaLabel(pitIndex)}
      aria-disabled={!isClickable(pitIndex)}
      onClick={() => isClickable(pitIndex) && onPitClick(pitIndex)}
      onKeyDown={(event) => handlePitKeyDown(event, pitIndex)}
    >
      {isBurnt(pitIndex) ? (
        <span className="burnt-mark" aria-hidden="true">
          X
        </span>
      ) : (
        <>
          <span className="pit-count">{pits[pitIndex]}</span>
          <Shells count={pits[pitIndex] ?? 0} />
        </>
      )}
    </div>
  );

  return (
    <div className="board-wrapper">
      <div className="board" role="group" aria-label="Sungka board">
        {/* Player 2 Store (left side — to Player 2's left) */}
        <div
          className="store store-p2"
          aria-label={`${playerTwoLabel} store, ${pits[P2_STORE] ?? 0} shells`}
        >
          <span className="store-count">{pits[P2_STORE]}</span>
          <Shells count={pits[P2_STORE] ?? 0} inStore />
          <span className="store-label">PLAYER 2</span>
        </div>

        {/* Top row - Player 2's pits */}
        <div
          className="pit-row pit-row-top"
          role="group"
          aria-label={`${playerTwoLabel} pits`}
        >
          {topRow.map((pitIndex) => renderPit(pitIndex))}
        </div>

        {/* Bottom row - Player 1's pits */}
        <div
          className="pit-row pit-row-bottom"
          role="group"
          aria-label={`${playerOneLabel} pits`}
        >
          {bottomRow.map((pitIndex) => renderPit(pitIndex))}
        </div>

        {/* Player 1 Store (right side — to Player 1's left) */}
        <div
          className="store store-p1"
          aria-label={`${playerOneLabel} store, ${pits[P1_STORE] ?? 0} shells`}
        >
          <span className="store-count">{pits[P1_STORE]}</span>
          <Shells count={pits[P1_STORE] ?? 0} inStore />
          <span className="store-label">PLAYER 1</span>
        </div>
      </div>
    </div>
  );
}
