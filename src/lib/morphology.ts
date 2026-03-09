/**
 * Morphology Code decoder for Greek NT (Robinson) and Hebrew OT (ETCBC)
 * Greek: https://github.com/morphgnt/robinson-morphological-codes
 * Hebrew: ETCBC dot-notation (e.g., "verb.qal.perf.p3.m.sg")
 */

const PART_OF_SPEECH: Record<string, string> = {
  N: "Noun",
  V: "Verb",
  ADJ: "Adjective",
  ADV: "Adverb",
  CONJ: "Conjunction",
  PREP: "Preposition",
  PRT: "Particle",
  INJ: "Interjection",
  T: "Article",
  D: "Demonstrative",
  K: "Correlative",
  I: "Interrogative",
  X: "Indefinite",
  Q: "Correlative/Interrogative",
  F: "Reflexive",
  S: "Possessive",
  P: "Personal",
  C: "Reciprocal",
  R: "Relative",
};

const PART_OF_SPEECH_KO: Record<string, string> = {
  N: "명사",
  V: "동사",
  ADJ: "형용사",
  ADV: "부사",
  CONJ: "접속사",
  PREP: "전치사",
  PRT: "불변화사",
  INJ: "감탄사",
  T: "관사",
  D: "지시사",
  K: "상관사",
  I: "의문사",
  X: "부정대명사",
  Q: "상관/의문사",
  F: "재귀대명사",
  S: "소유대명사",
  P: "인칭대명사",
  C: "상호대명사",
  R: "관계대명사",
};

const TENSE: Record<string, string> = {
  P: "Present", A: "Aorist", F: "Future", I: "Imperfect",
  X: "Perfect", Y: "Pluperfect",
};

const VOICE: Record<string, string> = {
  A: "Active", M: "Middle", P: "Passive",
  E: "Middle/Passive", D: "Middle Deponent", O: "Passive Deponent",
  N: "Middle/Passive Deponent",
};

const MOOD: Record<string, string> = {
  I: "Indicative", S: "Subjunctive", O: "Optative",
  M: "Imperative", N: "Infinitive", P: "Participle",
};

const CASE: Record<string, string> = {
  N: "Nominative", G: "Genitive", D: "Dative",
  A: "Accusative", V: "Vocative",
};

const CASE_KO: Record<string, string> = {
  N: "주격", G: "속격", D: "여격", A: "대격", V: "호격",
};

const NUMBER: Record<string, string> = { S: "Singular", P: "Plural" };

const GENDER: Record<string, string> = { M: "Masculine", F: "Feminine", N: "Neuter" };

const PERSON: Record<string, string> = { "1": "1st", "2": "2nd", "3": "3rd" };

export interface MorphologyInfo {
  pos: string;
  posKo: string;
  details: string;
  short: string;
}

export function decodeMorphology(code: string): MorphologyInfo {
  if (!code) return { pos: "", posKo: "", details: "", short: code };

  // ETCBC Hebrew format uses dots (e.g., "verb.qal.perf.p3.m.sg")
  if (code.includes(".")) {
    return decodeHebrewMorphology(code);
  }

  // Robinson Greek format uses dashes (e.g., "V-AAI-3S")
  // Split by '-' to get POS and features
  const parts = code.split("-");
  const posCode = parts[0];
  const features = parts.slice(1).join("-");

  const pos = PART_OF_SPEECH[posCode] ?? posCode;
  const posKo = PART_OF_SPEECH_KO[posCode] ?? posCode;

  if (!features) {
    return { pos, posKo, details: pos, short: posCode };
  }

  const detail: string[] = [pos];

  // Verb: Tense-Voice-Mood-Person-Number
  if (posCode === "V" && features.length >= 3) {
    const t = TENSE[features[0]];
    const v = VOICE[features[1]];
    const m = MOOD[features[2]];
    if (t) detail.push(t);
    if (v) detail.push(v);
    if (m) detail.push(m);
    if (features.length >= 4) {
      const p = PERSON[features[3]];
      if (p) detail.push(p + " Person");
    }
    if (features.length >= 5) {
      const n = NUMBER[features[4]];
      if (n) detail.push(n);
    }
  } else {
    // Noun/Adj/Article: Case-Number-Gender
    for (const ch of features) {
      const c = CASE[ch] ?? NUMBER[ch] ?? GENDER[ch] ?? null;
      if (c) detail.push(c);
    }
    // Check for suffix markers
    if (features.includes("-P")) detail.push("Proper");
    if (features.includes("-T")) detail.push("Title");
  }

  return {
    pos,
    posKo,
    details: detail.join(", "),
    short: `${posCode}-${features}`,
  };
}

// ── Hebrew ETCBC morphology ──

const HEBREW_POS: Record<string, [string, string]> = {
  verb: ["Verb", "동사"],
  subs: ["Noun", "명사"],
  nmpr: ["Proper Noun", "고유명사"],
  adjv: ["Adjective", "형용사"],
  advb: ["Adverb", "부사"],
  prep: ["Preposition", "전치사"],
  conj: ["Conjunction", "접속사"],
  prps: ["Personal Pronoun", "인칭대명사"],
  prde: ["Demonstrative Pronoun", "지시대명사"],
  prin: ["Interrogative Pronoun", "의문대명사"],
  intj: ["Interjection", "감탄사"],
  nega: ["Negative", "부정사"],
  inrg: ["Interrogative", "의문사"],
  art: ["Article", "관사"],
};

const HEBREW_STEM: Record<string, string> = {
  qal: "Qal", nif: "Niphal", piel: "Piel", pual: "Pual",
  hif: "Hiphil", hof: "Hophal", hit: "Hithpael",
  etpa: "Ethpaal", pael: "Pael", haf: "Haphel",
  shaf: "Shaphel", htpe: "Hithpeel", pasq: "Passive Qal",
};

const HEBREW_TENSE: Record<string, string> = {
  perf: "Perfect", impf: "Imperfect", wayq: "Wayyiqtol",
  impv: "Imperative", infc: "Inf. Construct", infa: "Inf. Absolute",
  ptca: "Participle Active", ptcp: "Participle Passive",
};

function decodeHebrewMorphology(code: string): MorphologyInfo {
  const parts = code.split(".");
  const posKey = parts[0];
  const [pos, posKo] = HEBREW_POS[posKey] ?? [posKey, posKey];

  const details: string[] = [pos];

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const stem = HEBREW_STEM[p];
    const tense = HEBREW_TENSE[p];
    if (stem) { details.push(stem); continue; }
    if (tense) { details.push(tense); continue; }
    // Person
    if (p === "p1") { details.push("1st Person"); continue; }
    if (p === "p2") { details.push("2nd Person"); continue; }
    if (p === "p3") { details.push("3rd Person"); continue; }
    // Gender
    if (p === "m") { details.push("Masculine"); continue; }
    if (p === "f") { details.push("Feminine"); continue; }
    if (p === "u") { details.push("Common"); continue; }
    // Number
    if (p === "sg") { details.push("Singular"); continue; }
    if (p === "pl") { details.push("Plural"); continue; }
    if (p === "du") { details.push("Dual"); continue; }
    // State
    if (p === "a") { details.push("Absolute"); continue; }
    if (p === "c") { details.push("Construct"); continue; }
    if (p === "d") { details.push("Determined"); continue; }
  }

  return { pos, posKo, details: details.join(", "), short: code };
}

/** Get a compact Korean morphology label */
export function getMorphLabel(code: string): string {
  // Hebrew ETCBC format
  if (code.includes(".")) {
    const parts = code.split(".");
    const [, posKo] = HEBREW_POS[parts[0]] ?? [parts[0], parts[0]];
    const stem = parts.find(p => HEBREW_STEM[p]);
    const tense = parts.find(p => HEBREW_TENSE[p]);
    if (stem && tense) return `${posKo} ${HEBREW_STEM[stem]} ${HEBREW_TENSE[tense]}`;
    if (stem) return `${posKo} ${HEBREW_STEM[stem]}`;
    return posKo;
  }

  // Greek Robinson format
  const parts = code.split("-");
  const posKo = PART_OF_SPEECH_KO[parts[0]] ?? parts[0];

  if (parts[0] === "V" && parts[1] && parts[1].length >= 3) {
    const t = TENSE[parts[1][0]] ?? "";
    const v = VOICE[parts[1][1]] ?? "";
    return `${posKo} ${t} ${v}`.trim();
  }

  if (parts[1]) {
    const caseStr = parts[1].split("").map(c => CASE_KO[c]).filter(Boolean).join(" ");
    if (caseStr) return `${posKo} ${caseStr}`;
  }

  return posKo;
}
