import warnings

# Cost per million tokens (USD) — April 2026
ANTHROPIC_PRICING: dict[str, dict[str, float]] = {
    "claude-opus-4-6":             {"input": 15.00, "output": 75.00},
    "claude-sonnet-4-6":           {"input":  3.00, "output": 15.00},
    "claude-haiku-4-5-20251001":   {"input":  0.80, "output":  4.00},
    "claude-3-5-sonnet-20241022":  {"input":  3.00, "output": 15.00},
    "claude-3-5-haiku-20241022":   {"input":  0.80, "output":  4.00},
    "claude-3-opus-20240229":      {"input": 15.00, "output": 75.00},
    "claude-3-haiku-20240307":     {"input":  0.25, "output":  1.25},
}

OPENAI_PRICING: dict[str, dict[str, float]] = {
    "gpt-4o":        {"input":  2.50, "output": 10.00},
    "gpt-4o-mini":   {"input":  0.15, "output":  0.60},
    "gpt-4-turbo":   {"input": 10.00, "output": 30.00},
    "gpt-4":         {"input": 30.00, "output": 60.00},
    "gpt-3.5-turbo": {"input":  0.50, "output":  1.50},
    "o1":            {"input": 15.00, "output": 60.00},
    "o1-mini":       {"input":  3.00, "output": 12.00},
    "o3-mini":       {"input":  1.10, "output":  4.40},
    "o3":            {"input": 10.00, "output": 40.00},
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = ANTHROPIC_PRICING.get(model)
    if not pricing:
        warnings.warn(
            f'[LLM Observatory] Unknown Anthropic model pricing: "{model}" — cost recorded as $0',
            stacklevel=3,
        )
        return 0.0
    return (input_tokens / 1_000_000) * pricing["input"] + \
           (output_tokens / 1_000_000) * pricing["output"]


def calculate_openai_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = OPENAI_PRICING.get(model)
    if not pricing:
        warnings.warn(
            f'[LLM Observatory] Unknown OpenAI model pricing: "{model}" — cost recorded as $0',
            stacklevel=3,
        )
        return 0.0
    return (input_tokens / 1_000_000) * pricing["input"] + \
           (output_tokens / 1_000_000) * pricing["output"]
