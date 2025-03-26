const findIsolatedPawns = (pawnFiles: string[]): string[] => {
    if (!pawnFiles || pawnFiles.length === 0) {
      return [];
    }
  
    try {
      const uniqueFiles = [...new Set(pawnFiles)];
      return uniqueFiles.filter((file) => {
        const fileChar = file.charCodeAt(0);
        const prevFile = String.fromCharCode(fileChar - 1);
        const nextFile = String.fromCharCode(fileChar + 1);
  
        // Check if there are no pawns on adjacent files
        return (
          (fileChar <= 97 || !pawnFiles.includes(prevFile)) &&
          (fileChar >= 104 || !pawnFiles.includes(nextFile))
        );
      });
    } catch (error) {
      console.error("Error finding isolated pawns:", error);
      return [];
    }
  };

  export default findIsolatedPawns;
