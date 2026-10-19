import { ArrowRight, ClipboardList, Handshake, MessageCircle, Search, Store, Factory, UserRoundSearch, ListChecks } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { openQuickRequirement } from "@/components/layout/QuickRequirementPrompt";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FLOWS = {
  brands: {
    tab: "For brands and manufacturers",
    icon: Factory,
    steps: [
      { icon: ClipboardList, title: "Tell us what you make", text: "List your company or send a quick requirement: products, target cities and the terms you offer." },
      { icon: UserRoundSearch, title: "Get found and matched", text: "Distributors find you by category and location, and our team suggests partners who fit." },
      { icon: MessageCircle, title: "Talk directly", text: "Interested distributors reach you by enquiry or WhatsApp. No middleman in the conversation." },
      { icon: Handshake, title: "Appoint your distributor", text: "Compare candidates and agree the terms that work for your business." },
    ],
    cta: { label: "Find distributors", intent: "FIND_DISTRIBUTORS" as const },
    link: { to: "/register", label: "List your company" },
  },
  distributors: {
    tab: "For distributors and dealers",
    icon: Store,
    steps: [
      { icon: Search, title: "Search opportunities", text: "Browse brands and manufacturers by category, location and investment range." },
      { icon: ListChecks, title: "Compare what's offered", text: "Check products, coverage, minimum orders, margins and the support each brand provides." },
      { icon: MessageCircle, title: "Enquire or chat", text: "Send an enquiry or open a WhatsApp chat with the brand in one tap." },
      { icon: Handshake, title: "Start distributing", text: "Agree terms with the brand directly and grow your portfolio." },
    ],
    cta: { label: "Find distributorships", intent: "BECOME_DISTRIBUTOR" as const },
    link: { to: "/leads", label: "See current opportunities" },
  },
};
type Flow = keyof typeof FLOWS;

/** Two audiences, two journeys: tabs switch between the brand and the distributor path. */
export function HowItWorks() {
  const [flow, setFlow] = useState<Flow>("brands");
  const f = FLOWS[flow];
  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Who are you?" className="inline-flex flex-wrap gap-1 rounded-button bg-background p-1">
        {(Object.keys(FLOWS) as Flow[]).map((k) => {
          const Icon = FLOWS[k].icon;
          return (
            <button
              key={k}
              id={`how-tab-${k}`}
              role="tab"
              aria-selected={flow === k}
              aria-controls="how-panel"
              onClick={() => setFlow(k)}
              className={cn("flex min-h-11 items-center gap-2 rounded-[8px] px-4 text-sm font-semibold transition-colors", flow === k ? "bg-surface text-ink shadow-sm" : "text-body hover:text-ink")}
            >
              <Icon className="h-4 w-4" aria-hidden /> {FLOWS[k].tab}
            </button>
          );
        })}
      </div>
      <div id="how-panel" role="tabpanel" aria-labelledby={`how-tab-${flow}`}>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {f.steps.map((s, i) => (
            <li key={s.title} className="relative rounded-card border border-line bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 text-base">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => openQuickRequirement(f.cta.intent)}>
            {f.cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to={f.link.to}>{f.link.label}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
