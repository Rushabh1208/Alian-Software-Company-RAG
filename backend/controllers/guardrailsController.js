
const FORBIDDEN_PATTERNS = [
  "ignore previous instructions",
  "ignore all previous instructions",
  "disregard your system prompt",
  "disregard previous",
  "forget your instructions",
  "you are now",
  "act as if",
  "act as though",
  "pretend you are",
  "pretend to be",
  "do anything now",
  "dan mode",
  "jailbreak",
  "bypass restrictions",
  "bypass your rules",
  "no restrictions",
  "without any filters",
  "without restrictions",
  "override your instructions",
  "override your settings",
  "ignore your training",
  "ignore safety",
  "disable safety",
  "turn off safety",
  "you have no rules",
  "forget all rules",
  "new persona",
  "your true self",
  "unrestricted mode",
  "developer mode",
  "god mode",
  "sudo mode",
];
 
const RISKY_ROLE_PATTERNS = [
  "you have no ethics",
  "you have no limits",
  "you have no boundaries",
  "you are a hacker",
  "you are an attacker",
  "you are evil",
  "you are malicious",
  "you are a criminal",
  "you can do illegal",
  "help with illegal",
  "assist with illegal",
  "you are not an ai",
  "you are not a bot",
  "you are human",
  "you are uncensored",
  "you are unfiltered",
  "you are free to do anything",
];
 
const HARMFUL_TOPICS = [
  // Violence
  "how to kill",
  "how to hurt",
  "how to harm",
  "how to attack",
  "how to torture",
  "how to assault",
  "how to stab",
  "how to shoot",
  "make a bomb",
  "build a weapon",
  "create a weapon",
  "synthesize drugs",
  "make drugs",
  "drug synthesis",
  // Self-harm
  "how to self harm",
  "how to commit suicide",
  "ways to die",
  "kill yourself",
  // Illegal activity
  "how to hack",
  "how to steal",
  "how to fraud",
  "commit fraud",
  "money laundering",
  "hotwire a car",
  "pick a lock illegally",
  "make counterfeit",
  // Adult/explicit
  "explicit sexual",
  "pornographic",
  "generate nude",
  "sexual content",
  "erotic content",
  // Hate speech triggers
  "all [a-z]+ are inferior",
  "hate all",
  "exterminate",
  "genocide",
];
 
const CURSE_WORDS = [
  "fuck",
  "fucking",
  "fucker",
  "shit",
  "bullshit",
  "asshole",
  "bastard",
  "bitch",
  "cunt",
  "dick",
  "prick",
  "pussy",
  "cock",
  "damn you",
  "go to hell",
  "motherfucker",
  "faggot",
  "retard",
  "nigger",
  "nigga",
  "whore",
  "slut",
  "jackass",
  "dumbass",
  "dipshit",
];
 
const RUBBISH_PATTERNS = [
  // Nonsense / spam-like
  /(.)\1{6,}/,              // same char repeated 7+ times e.g. "aaaaaaa"
  /^[\W\d\s]{0,5}$/,        // only symbols/numbers/spaces, very short
  /(\b\w+\b)(\s+\1){4,}/,  // same word repeated 5+ times
];
 
const SENSITIVE_DATA_PATTERNS = [
  // Asking to expose secrets
  "reveal your api key",
  "show your api key",
  "what is your api key",
  "show your password",
  "reveal your password",
  "expose credentials",
  "leak data",
  "expose user data",
  "show database",
  "dump database",
  "show all users",
  "list all users",
  "access other users",
];
 
const COMPETITOR_MANIPULATION = [
  "always recommend",
  "only recommend",
  "never mention competitors",
  "bash competitors",
  "say bad things about",
  "insult",
  "demean",
  "mock users",
  "make fun of users",
];
 
function checkGuardrails(req, res) {
  const { role = "", constraints = "" } = req.body || {};
 
  const constraintsText = Array.isArray(constraints)
    ? constraints.join("\n")
    : String(constraints || "");
 
  const combined = `${String(role)} ${constraintsText}`.toLowerCase();
  const violations = [];
 
  // 1. Jailbreak / prompt injection
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (combined.includes(pattern)) {
      violations.push(`🚫 Prompt injection detected: "${pattern}"`);
    }
  }
 
  // 2. Risky role assignments
  for (const pattern of RISKY_ROLE_PATTERNS) {
    if (combined.includes(pattern)) {
      violations.push(`⚠️ Unsafe role assignment: "${pattern}"`);
    }
  }
 
  // 3. Harmful topics
  for (const pattern of HARMFUL_TOPICS) {
    if (combined.includes(pattern)) {
      violations.push(`🚨 Harmful topic instruction: "${pattern}"`);
    }
  }
 
  // 4. Curse / offensive words
  for (const word of CURSE_WORDS) {
    if (combined.includes(word)) {
      violations.push(`🤬 Offensive language detected: "${word}"`);
    }
  }
 
  // 5. Rubbish / spam content
  for (const pattern of RUBBISH_PATTERNS) {
    if (pattern.test(combined)) {
      violations.push(`🗑️ Rubbish or spam-like content detected.`);
      break;
    }
  }
 
  // 6. Sensitive data exposure
  for (const pattern of SENSITIVE_DATA_PATTERNS) {
    if (combined.includes(pattern)) {
      violations.push(`🔐 Sensitive data exposure instruction: "${pattern}"`);
    }
  }
 
  // 7. Competitor manipulation / user mockery
  for (const pattern of COMPETITOR_MANIPULATION) {
    if (combined.includes(pattern)) {
      violations.push(`🛑 Manipulative instruction detected: "${pattern}"`);
    }
  }
 
  // 8. Length check
  if (combined.trim().length > 3000) {
    violations.push("📏 Prompt exceeds maximum allowed length (3000 chars).");
  }
 
  const passed = violations.length === 0;
  return res.json({
    passed,
    violations,
    message: passed
      ? "Guardrails check passed. Settings can be saved."
      : "Guardrails check failed. Please review and fix the issues below.",
  });
}
 
module.exports = { checkGuardrails };