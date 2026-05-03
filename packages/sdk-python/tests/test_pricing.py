import pytest
from llm_observatory._pricing import (
    ANTHROPIC_PRICING,
    OPENAI_PRICING,
    calculate_cost,
    calculate_openai_cost,
)


class TestCalculateCost:
    def test_sonnet_cost(self):
        # (1M input * $3) + (1M output * $15) = $18
        assert calculate_cost("claude-sonnet-4-6", 1_000_000, 1_000_000) == pytest.approx(18.0)

    def test_opus_cost(self):
        # (1M input * $15) + (1M output * $75) = $90
        assert calculate_cost("claude-opus-4-6", 1_000_000, 1_000_000) == pytest.approx(90.0)

    def test_haiku_cost(self):
        # (1M input * $0.80) + (1M output * $4.00) = $4.80
        assert calculate_cost("claude-haiku-4-5-20251001", 1_000_000, 1_000_000) == pytest.approx(4.80)

    def test_zero_tokens(self):
        assert calculate_cost("claude-sonnet-4-6", 0, 0) == 0.0

    def test_unknown_model_returns_zero(self):
        assert calculate_cost("unknown-model-xyz", 1_000_000, 1_000_000) == 0.0

    def test_partial_million_tokens(self):
        # 500k input + 100k output for sonnet: (0.5*3) + (0.1*15) = 1.5 + 1.5 = 3.0
        assert calculate_cost("claude-sonnet-4-6", 500_000, 100_000) == pytest.approx(3.0)

    def test_all_anthropic_models_have_valid_pricing(self):
        for model, pricing in ANTHROPIC_PRICING.items():
            assert pricing["input"] >= 0, f"{model} input price must be >= 0"
            assert pricing["output"] >= 0, f"{model} output price must be >= 0"


class TestCalculateOpenAICost:
    def test_gpt4o_cost(self):
        # (1M input * $2.50) + (1M output * $10.00) = $12.50
        assert calculate_openai_cost("gpt-4o", 1_000_000, 1_000_000) == pytest.approx(12.50)

    def test_gpt4o_mini_cost(self):
        assert calculate_openai_cost("gpt-4o-mini", 1_000_000, 1_000_000) == pytest.approx(0.75)

    def test_zero_tokens(self):
        assert calculate_openai_cost("gpt-4o", 0, 0) == 0.0

    def test_unknown_model_returns_zero(self):
        assert calculate_openai_cost("unknown-model-xyz", 1_000_000, 1_000_000) == 0.0

    def test_all_openai_models_have_valid_pricing(self):
        for model, pricing in OPENAI_PRICING.items():
            assert pricing["input"] >= 0, f"{model} input price must be >= 0"
            assert pricing["output"] >= 0, f"{model} output price must be >= 0"
