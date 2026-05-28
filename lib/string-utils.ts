function scoreCandidates(
  inputStr: string,
  candidates: { id: string; name: string }[]
): { candidate: { id: string; name: string }; score: number }[] {
  const lowerInput = inputStr.toLowerCase().trim();
  const words = lowerInput.split(/\s+/).filter(w => w.length >= 3);

  return candidates.map(c => {
    const lowerName = c.name.toLowerCase();
    let score = 0;

    // Coverage: query wholly contained in product name.
    // Shorter product names score higher (13/14 = 93% vs 13/48 = 27%).
    if (lowerName.includes(lowerInput)) {
      score += 100 * (lowerInput.length / lowerName.length);
    }

    // Product name is entirely inside the query (very direct hit)
    if (lowerInput.includes(lowerName)) {
      score += 80;
    }

    // Word overlap: fraction of query words present in product name
    if (words.length > 0) {
      const matchedWords = words.filter(w => lowerName.includes(w));
      if (matchedWords.length > 0) {
        score += (matchedWords.length / words.length) * 40;
        // Shorter product names are more specific — reward them
        score += Math.max(0, 20 - lowerName.length / 5);
      }
    }

    // Levenshtein as soft tiebreaker only
    score -= getLevenshteinDistance(lowerInput, lowerName) * 0.1;

    return { candidate: c, score };
  });
}

export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const str1 = a.toLowerCase();
  const str2 = b.toLowerCase();

  for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/** Returns the single best match, preferring shorter/more direct product names. */
export function findBestMatch(
  inputStr: string,
  candidates: { id: string; name: string }[]
): { id: string; name: string } | null {
  if (candidates.length === 0) return null;

  const lowerInput = inputStr.toLowerCase().trim();
  const exact = candidates.find(c => c.name.toLowerCase() === lowerInput);
  if (exact) return exact;

  const scored = scoreCandidates(inputStr, candidates).sort((a, b) => b.score - a.score);
  return scored[0].score >= 5 ? scored[0].candidate : null;
}

/** Returns the top N candidates sorted by relevance score. Used for AI pre-filtering. */
export function findTopMatches(
  inputStr: string,
  candidates: { id: string; name: string }[],
  n: number
): { id: string; name: string }[] {
  return scoreCandidates(inputStr, candidates)
    .filter(s => s.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(s => s.candidate);
}
