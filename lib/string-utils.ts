export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const str1 = a.toLowerCase();
  const str2 = b.toLowerCase();

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1)
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export function findBestMatch(inputStr: string, candidates: {id: string, name: string}[]): {id: string, name: string} | null {
  if (candidates.length === 0) return null;

  let bestMatch: {id: string, name: string} | null = null;
  let lowestDistance = Infinity;

  const lowerInput = inputStr.toLowerCase().trim();

  const exactOrSub = candidates.find(c => c.name.toLowerCase() === lowerInput || c.name.toLowerCase().includes(lowerInput) || lowerInput.includes(c.name.toLowerCase()));
  if (exactOrSub) return exactOrSub;

  const words = lowerInput.split(" ").filter(w => w.length >= 3);
  const wordMatch = candidates.find(c =>
    words.some(w => c.name.toLowerCase().includes(w))
  );
  if (wordMatch) return wordMatch;

  for (const candidate of candidates) {
    const distance = getLevenshteinDistance(inputStr, candidate.name);
    if (distance < lowestDistance) {
      lowestDistance = distance;
      bestMatch = candidate;
    }
  }

  const threshold = Math.floor(lowerInput.length * 0.4);
  if (lowestDistance > threshold) return null;

  return bestMatch;
}
