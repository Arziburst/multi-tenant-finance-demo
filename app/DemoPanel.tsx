"use client";

import { useState, useEffect } from "react";
import Header from "./components/Header";
import HeaderActions from "./components/HeaderActions";
import StepBlock from "./components/StepBlock";
import BootstrapStep from "./components/steps/BootstrapStep";
import TransactionsStep from "./components/steps/TransactionsStep";
import ProposeStep from "./components/steps/ProposeStep";
import ConfirmStep from "./components/steps/ConfirmStep";

const API_BASE = "";

export default function DemoPanel() {
  const [secret, setSecret] = useState("1234567890");
  const [token, setToken] = useState("");
  const [question, setQuestion] = useState(
    "Recategorize my Starbucks transactions to Coffee",
  );
  const [provider, setProvider] = useState<"openai" | "claude">("claude");
  const [proposalId, setProposalId] = useState("");
  const [confirmFlag, setConfirmFlag] = useState(true);

  const [resetRes, setResetRes] = useState("");
  const [bootstrapRes, setBootstrapRes] = useState("");
  const [transactionsRes, setTransactionsRes] = useState("");
  const [proposeRes, setProposeRes] = useState("");
  const [confirmRes, setConfirmRes] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setCategories([]);
      return;
    }
    fetch(`${API_BASE}/api/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data?.categories) ? data.categories : []))
      .catch(() => setCategories([]));
  }, [token]);

  function clearAfterReset() {
    setToken("");
    setProposalId("");
    setBootstrapRes("");
    setTransactionsRes("");
    setProposeRes("");
    setConfirmRes("");
  }

  async function runReset() {
    setLoading("reset");
    setResetRes("");
    try {
      const r = await fetch(`${API_BASE}/api/demo/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await r.json().catch(() => ({}));
      setResetRes(JSON.stringify(data, null, 2));
      if (r.ok && data.status === "reset_ok") clearAfterReset();
    } catch (e) {
      setResetRes(String(e));
    } finally {
      setLoading(null);
    }
  }

  async function runBootstrap() {
    setLoading("bootstrap");
    setBootstrapRes("");
    try {
      const r = await fetch(`${API_BASE}/api/demo/bootstrap`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await r.json().catch(() => ({}));
      setBootstrapRes(JSON.stringify(data, null, 2));
      if (data.token_user_a) setToken(data.token_user_a);
    } catch (e) {
      setBootstrapRes(String(e));
    } finally {
      setLoading(null);
    }
  }

  async function runTransactions() {
    setLoading("transactions");
    setTransactionsRes("");
    try {
      const r = await fetch(`${API_BASE}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));
      setTransactionsRes(JSON.stringify(data, null, 2));
    } catch (e) {
      setTransactionsRes(String(e));
    } finally {
      setLoading(null);
    }
  }

  async function runPropose() {
    setLoading("propose");
    setProposeRes("");
    try {
      const r = await fetch(`${API_BASE}/api/ai/propose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, provider }),
      });
      const data = await r.json().catch(() => ({}));
      setProposeRes(JSON.stringify(data, null, 2));
      if (data.proposal_id) setProposalId(data.proposal_id);
    } catch (e) {
      setProposeRes(String(e));
    } finally {
      setLoading(null);
    }
  }

  async function runConfirm() {
    setLoading("confirm");
    setConfirmRes("");
    try {
      const r = await fetch(`${API_BASE}/api/ai/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ proposal_id: proposalId, confirm: confirmFlag }),
      });
      const data = await r.json().catch(() => ({}));
      setConfirmRes(JSON.stringify(data, null, 2));
    } catch (e) {
      setConfirmRes(String(e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <Header>
        <HeaderActions
          secret={secret}
          setSecret={setSecret}
          loading={loading}
          resetRes={resetRes}
          onReset={runReset}
          onCloseModal={() => setResetRes("")}
        />
      </Header>
      <div className="demo-panel">
        <StepBlock title="1. Bootstrap">
          <BootstrapStep
            secret={secret}
            setSecret={setSecret}
            loading={loading}
            response={bootstrapRes}
            onRun={runBootstrap}
          />
        </StepBlock>
        <StepBlock title="2. Transactions">
          <TransactionsStep
            token={token}
            setToken={setToken}
            loading={loading}
            response={transactionsRes}
            onRun={runTransactions}
          />
        </StepBlock>
        <StepBlock title="3. AI Propose">
          <ProposeStep
            token={token}
            question={question}
            setQuestion={setQuestion}
            provider={provider}
            setProvider={setProvider}
            loading={loading}
            response={proposeRes}
            onRun={runPropose}
            categories={categories}
          />
        </StepBlock>
        <StepBlock title="4. AI Confirm">
          <ConfirmStep
            token={token}
            proposalId={proposalId}
            setProposalId={setProposalId}
            confirmFlag={confirmFlag}
            setConfirmFlag={setConfirmFlag}
            loading={loading}
            response={confirmRes}
            onRun={runConfirm}
          />
        </StepBlock>
      </div>
    </>
  );
}
