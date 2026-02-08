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
}

export default function Board({
  gameState,
  onPitClick,
  validMoves,
  animatingPit,
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

  return (
    <div className="board-wrapper">
      <div className="board">
        {/* Player 2 Store (left side — to Player 2's left) */}
        <div className="store store-p2">
          <span className="store-count">{pits[P2_STORE]}</span>
          <Shells count={pits[P2_STORE] ?? 0} inStore />
          <span className="store-label">PLAYER 2</span>
        </div>

        {/* Top row - Player 2's pits */}
        <div className="pit-row pit-row-top">
          {topRow.map((pitIndex) => (
            <div
              key={pitIndex}
              className={`pit${isClickable(pitIndex) ? " clickable" : ""}${
                animatingPit === pitIndex ? " animating" : ""
              }${lastMove === pitIndex ? " last-move" : ""}${
                isBurnt(pitIndex) ? " burnt" : ""
              }`}
              onClick={() => isClickable(pitIndex) && onPitClick(pitIndex)}
            >
              {isBurnt(pitIndex) ? (
                <span className="burnt-mark">X</span>
              ) : (
                <>
                  <span className="pit-count">{pits[pitIndex]}</span>
                  <Shells count={pits[pitIndex] ?? 0} />
                </>
              )}
            </div>
          ))}
        </div>

        {/* Bottom row - Player 1's pits */}
        <div className="pit-row pit-row-bottom">
          {bottomRow.map((pitIndex) => (
            <div
              key={pitIndex}
              className={`pit${isClickable(pitIndex) ? " clickable" : ""}${
                animatingPit === pitIndex ? " animating" : ""
              }${lastMove === pitIndex ? " last-move" : ""}${
                isBurnt(pitIndex) ? " burnt" : ""
              }`}
              onClick={() => isClickable(pitIndex) && onPitClick(pitIndex)}
            >
              {isBurnt(pitIndex) ? (
                <span className="burnt-mark">X</span>
              ) : (
                <>
                  <span className="pit-count">{pits[pitIndex]}</span>
                  <Shells count={pits[pitIndex] ?? 0} />
                </>
              )}
            </div>
          ))}
        </div>

        {/* Player 1 Store (right side — to Player 1's left) */}
        <div className="store store-p1">
          <span className="store-count">{pits[P1_STORE]}</span>
          <Shells count={pits[P1_STORE] ?? 0} inStore />
          <span className="store-label">PLAYER 1</span>
        </div>
      </div>
    </div>
  );
}
