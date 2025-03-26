import findDoubledPawns from "./FindDoubledPawns";
import findIsolatedPawns from "./FindIsolatedPawns";

const analyzePawnStructure = (ranks: string[]): string => {
  if (!ranks || ranks.length === 0) {
    return "Pawn structure: Unable to analyze";
  }

  try {
    // Count pawns by file for both colors
    const whitePawnFiles: string[] = [];
    const blackPawnFiles: string[] = [];

    for (let rank = 0; rank < 8; rank++) {
      if (!ranks[rank]) continue;

      for (const char of ranks[rank]) {
        if (/^\d$/.test(char)) {
          continue;
        } else {
          if (char === "P") {
            whitePawnFiles.push(String.fromCharCode(97 + rank)); // Convert to file letter (a-h)
          } else if (char === "p") {
            blackPawnFiles.push(String.fromCharCode(97 + rank));
          }
        }
      }
    }

    // Identify doubled pawns
    const whiteDoubledPawns = findDoubledPawns(whitePawnFiles);
    const blackDoubledPawns = findDoubledPawns(blackPawnFiles);

    // Identify isolated pawns (pawns with no friendly pawns on adjacent files)
    const whiteIsolatedPawns = findIsolatedPawns(whitePawnFiles);
    const blackIsolatedPawns = findIsolatedPawns(blackPawnFiles);

    let analysis = "Pawn structure analysis:";
    let hasFeatures = false;

    if (whiteDoubledPawns.length > 0) {
      analysis += `\n- White has doubled pawns on files: ${whiteDoubledPawns.join(
        ", "
      )}`;
      hasFeatures = true;
    }

    if (blackDoubledPawns.length > 0) {
      analysis += `\n- Black has doubled pawns on files: ${blackDoubledPawns.join(
        ", "
      )}`;
      hasFeatures = true;
    }

    if (whiteIsolatedPawns.length > 0) {
      analysis += `\n- White has isolated pawns on files: ${whiteIsolatedPawns.join(
        ", "
      )}`;
      hasFeatures = true;
    }

    if (blackIsolatedPawns.length > 0) {
      analysis += `\n- Black has isolated pawns on files: ${blackIsolatedPawns.join(
        ", "
      )}`;
      hasFeatures = true;
    }

    // If no special features found, provide basic pawn distribution
    if (!hasFeatures) {
      analysis +=
        "\n- Standard pawn structure with no doubled or isolated pawns";
      analysis += `\n- White pawns on files: ${
        [...new Set(whitePawnFiles)].sort().join(", ") || "none"
      }`;
      analysis += `\n- Black pawns on files: ${
        [...new Set(blackPawnFiles)].sort().join(", ") || "none"
      }`;
    }

    return analysis;
  } catch (error) {
    console.error("Error analyzing pawn structure:", error);
    return "Pawn structure: Error during analysis";
  }
};

export default analyzePawnStructure;
