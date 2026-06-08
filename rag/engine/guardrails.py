# rag/engine/guardrails.py

FORBIDDEN_PATTERNS = [
    "ignore previous instructions",
    "disregard your system prompt",
    "you are now",
    "act as if",
    "pretend you are",
    "do anything now",
    "jailbreak",
    "bypass restrictions",
    "no restrictions",
    "without any filters",
]

RISKY_ROLE_PATTERNS = [
    "you have no ethics",
    "you have no limits",
    "you are a hacker",
    "you are an attacker",
    "you can do illegal",
    "help with illegal",
]

def check_guardrails(role: str = "", constraints: str = "") -> dict:
    combined = (role + " " + constraints).lower()

    violations = []

    for pattern in FORBIDDEN_PATTERNS:
        if pattern in combined:
            violations.append(f"Forbidden instruction detected: '{pattern}'")

    for pattern in RISKY_ROLE_PATTERNS:
        if pattern in combined:
            violations.append(f"Risky role assignment detected: '{pattern}'")

    if len(combined.strip()) > 3000:
        violations.append("Prompt exceeds maximum allowed length (3000 chars).")

    if violations:
        return {
            "passed": False,
            "violations": violations,
            "message": "Guardrails check failed. Please review and fix the issues below."
        }

    return {
        "passed": True,
        "violations": [],
        "message": "Guardrails check passed. Settings can be saved."
    }