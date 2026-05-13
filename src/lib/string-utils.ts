export function getLevenshteinDistance(a: string, b: string): number {
  const matrix = [];
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
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1) // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export function findBestMatch(inputStr: string, candidates: {id: string, name: string}[]): {id: string, name: string} | null {
  if (candidates.length === 0) return null;
  
  let bestMatch = null;
  let lowestDistance = Infinity;

  // Sometimes products are typed with just partial words, e.g. "jesus" for "vida de jesus"
  // So we check substring first for high confidence
  const lowerInput = inputStr.toLowerCase().trim();
  
  // Exact or Substring match
  const exactOrSub = candidates.find(c => c.name.toLowerCase() === lowerInput || c.name.toLowerCase().includes(lowerInput) || lowerInput.includes(c.name.toLowerCase()));
  if (exactOrSub) return exactOrSub;

  for (const candidate of candidates) {
    const distance = getLevenshteinDistance(inputStr, candidate.name);
    if (distance < lowestDistance) {
      lowestDistance = distance;
      bestMatch = candidate;
    }
  }

  // If the string is totally different but it's the best Levenshtein, we might still accept it.
  // We can just return the best match.
  return bestMatch;
}
