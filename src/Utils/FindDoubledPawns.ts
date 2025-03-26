const findDoubledPawns = (pawnFiles: string[]): string[] => {
  if (!pawnFiles || pawnFiles.length === 0) {
    return [];
  }

  try {
    const fileCounts: { [key: string]: number } = {};
    pawnFiles.forEach((file) => {
      fileCounts[file] = (fileCounts[file] || 0) + 1;
    });

    return Object.keys(fileCounts).filter((file) => fileCounts[file] > 1);
  } catch (error) {
    console.error("Error finding doubled pawns:", error);
    return [];
  }
};



export default findDoubledPawns;
