import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getConversationsApi } from "../../lib/api";
import { Skeleton, EmptyState } from "../../components/ui/Feedback";

export function ConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    getConversationsApi()
      .then((payload) => {
        const items = payload.conversations || [];
        setConversations(items);
        setSelectedId(items[0]?.id || "");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return conversations.filter((item) => {
      const matchesSearch = !search || `${item.title} ${item.source}`.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "All" || item.source === filter;
      return matchesSearch && matchesFilter;
    });
  }, [conversations, search, filter]);

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;

  return (
    <DashboardShell eyebrow="Conversations" title="Conversation history" description="View conversations, search them, filter them, and inspect full chat details.">
      <div className="flex flex-wrap gap-2">
        <input className="min-w-60 rounded-full border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink outline-none placeholder:text-mute" placeholder="Search conversations" value={search} onChange={(e) => setSearch(e.target.value)} />
        {["All", "Website widget", "Dashboard"].map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={filter === item ? "rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary" : "rounded-full border border-hairline px-4 py-3 text-sm text-body"}>{item}</button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-4">
          <div className="space-y-3">
            {loading ? <Skeleton className="h-72" /> : filtered.length ? filtered.map((item) => (
              <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-2xl border px-4 py-4 text-left ${selected?.id === item.id ? "border-primary/30 bg-primary/10" : "border-hairline bg-canvas"}`}>
                <p className="text-sm font-medium text-ink-strong">{item.title}</p>
                <p className="mt-1 text-xs text-body">{item.source} · {item.messages?.length || 0} messages</p>
              </button>
            )) : <EmptyState title="No conversations" description="Conversation history appears here once chats are stored." />}
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-strong">Conversation Details</p>
          <div className="mt-4 space-y-3 rounded-2xl border border-hairline bg-canvas p-4 text-sm text-body">
            {selected ? (
              <>
                <p><span className="text-ink-strong">Title:</span> {selected.title}</p>
                <p><span className="text-ink-strong">Source:</span> {selected.source}</p>
                <div className="space-y-2 pt-2">
                  {(selected.messages || []).map((msg) => (
                    <div key={msg.id} className={`rounded-xl px-3 py-2 ${msg.role === "user" ? "bg-primary/10 text-ink-strong" : "bg-canvas-soft"}`}>
                      <span className="text-[10px] uppercase tracking-[0.28em] text-primary">{msg.role}</span>
                      <p className="mt-1">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p>Select a conversation to inspect messages.</p>
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
