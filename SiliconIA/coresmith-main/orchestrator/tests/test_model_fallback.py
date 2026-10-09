# SiliconIA: model-fatigue failover tests for ClaudeLLM.
"""Covers the provider-agnostic fallback chain added to coresmith_llm:

* a mid-turn ``turn.failed`` is surfaced as an error, not as the partial text;
* capacity errors fail over to the next model and park the fatigued one;
* parked models are skipped (sticky) until their cooldown expires;
* unknown/forbidden model ids are skipped; ordinary failures are NOT retried.
"""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from orchestrator.langchain.agents import coresmith_llm
from orchestrator.langchain.agents.coresmith_llm import (
    ClaudeLLM,
    _classify_llm_failure,
    _parse_codex_json,
    _resolve_model,
)

CAPACITY = ("[ClaudeLLM error: codex CLI reported: Selected model is at capacity. "
            "Please try a different model.]")


@pytest.fixture(autouse=True)
def _codex_env(monkeypatch):
    monkeypatch.setenv("CORESMITH_LLM_PROVIDER", "codex")
    monkeypatch.setenv("CORESMITH_CODEX_MODEL", "gpt-5.6-sol")
    monkeypatch.setenv("CORESMITH_MODEL_FALLBACKS", "gpt-5.6-terra,gpt-5.5")
    monkeypatch.setenv("CORESMITH_MODEL_COOLDOWN_S", "300")
    coresmith_llm._MODEL_HEALTH.reset()
    yield
    coresmith_llm._MODEL_HEALTH.reset()


def _llm():
    with patch.object(coresmith_llm, "_find_codex_binary", return_value="/usr/bin/codex"):
        llm = ClaudeLLM(model="opus-5", timeout=10)
    llm._write_llm_event = lambda *a, **k: None  # keep tests off the event log
    return llm


def _scripted(llm, replies):
    """Make each underlying CLI call return the next reply and record its model."""
    seen: list[str] = []

    def fake_once(system, prompt, resume=None):
        seen.append(_resolve_model(llm.model, llm._provider))
        reply = replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    llm._generate_via_cli_once = fake_once
    return seen


def test_turn_failed_after_commentary_is_an_error():
    stdout = "\n".join(json.dumps(e) for e in [
        {"type": "thread.started", "thread_id": "t1"},
        {"type": "item.completed", "item": {"type": "agent_message",
                                            "text": "Locating the run's workspace files..."}},
        {"type": "turn.failed", "error": {"message": "Selected model is at capacity."}},
    ])
    text, _ = _parse_codex_json(stdout)
    assert text.startswith("[ClaudeLLM error: codex CLI reported: Selected model is at capacity.")
    assert "partial: Locating" in text


def test_completed_turn_keeps_answer():
    stdout = "\n".join(json.dumps(e) for e in [
        {"type": "item.completed", "item": {"type": "agent_message", "text": "done"}},
        {"type": "turn.completed", "usage": {"output_tokens": 3}},
    ])
    assert _parse_codex_json(stdout)[0] == "done"


@pytest.mark.parametrize("text,kind", [
    (CAPACITY, "capacity"),
    ("[ClaudeLLM error: HTTP 429 Too Many Requests]", "capacity"),
    ("[ClaudeLLM error: API Error: 529 overloaded_error]", "capacity"),
    ("[ClaudeLLM error: model 'gpt-9' not found]", "unavailable"),
    ("[ClaudeLLM error: codex CLI stalled after 1200s]", None),
    ("[ClaudeLLM error: stderr: path /x/y does not exist]", None),
])
def test_classifier(text, kind):
    assert _classify_llm_failure(text) == kind


def test_capacity_fails_over_and_is_sticky():
    llm = _llm()
    seen = _scripted(llm, [CAPACITY, "module ok"])
    assert llm._generate_via_cli("sys", "p") == "module ok"
    assert seen == ["gpt-5.6-sol", "gpt-5.6-terra"]
    # Next call starts on the healthy model; the fatigued one is parked.
    assert _resolve_model(llm.model, llm._provider) == "gpt-5.6-terra"
    seen2 = _scripted(llm, ["second ok"])
    assert llm._generate_via_cli("sys", "p") == "second ok"
    assert seen2 == ["gpt-5.6-terra"]


def test_cooldown_expiry_returns_to_primary(monkeypatch):
    llm = _llm()
    _scripted(llm, [CAPACITY, "ok"])
    llm._generate_via_cli("sys", "p")
    t0 = coresmith_llm._time_mod.monotonic()
    monkeypatch.setattr(coresmith_llm._time_mod, "monotonic", lambda: t0 + 301)
    assert _resolve_model(llm.model, llm._provider) == "gpt-5.6-sol"


def test_all_saturated_returns_last_error():
    llm = _llm()
    seen = _scripted(llm, [CAPACITY, CAPACITY, CAPACITY])
    assert llm._generate_via_cli("sys", "p") == CAPACITY
    assert seen == ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.5"]


def test_non_capacity_failure_is_not_retried():
    llm = _llm()
    stalled = "[ClaudeLLM error: codex CLI stalled after 1200s]"
    seen = _scripted(llm, [stalled])
    assert llm._generate_via_cli("sys", "p") == stalled
    assert seen == ["gpt-5.6-sol"]


def test_raised_capacity_exception_fails_over():
    llm = _llm()
    seen = _scripted(llm, [RuntimeError("503 Service Unavailable"), "ok"])
    assert llm._generate_via_cli("sys", "p") == "ok"
    assert seen == ["gpt-5.6-sol", "gpt-5.6-terra"]


def test_unrelated_exception_propagates():
    llm = _llm()
    _scripted(llm, [ValueError("bad prompt")])
    with pytest.raises(ValueError):
        llm._generate_via_cli("sys", "p")


def test_no_chain_is_single_call(monkeypatch):
    monkeypatch.delenv("CORESMITH_MODEL_FALLBACKS")
    llm = _llm()
    seen = _scripted(llm, [CAPACITY])
    assert llm._generate_via_cli("sys", "p") == CAPACITY
    assert len(seen) == 1


def test_provider_agnostic_claude_chain(monkeypatch):
    monkeypatch.setenv("CORESMITH_LLM_PROVIDER", "claude")
    monkeypatch.setenv("CORESMITH_MODEL", "opus-5")
    monkeypatch.setenv("CORESMITH_MODEL_FALLBACKS", "sonnet-5")
    with patch.object(coresmith_llm, "_find_claude_binary", return_value="/usr/bin/claude"):
        llm = ClaudeLLM(model="opus-5", timeout=10)
    llm._write_llm_event = lambda *a, **k: None
    seen = _scripted(llm, ["[ClaudeLLM error: API Error: 529 overloaded]", "ok"])
    assert llm._generate_via_cli("sys", "p") == "ok"
    assert seen == ["opus", "sonnet"]  # aliases resolved through _CLI_MODEL_MAP
