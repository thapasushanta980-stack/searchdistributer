import { lazyClient } from "@/lib/lazyClient";
import type { EnquiryTarget } from "./EnquiryDialog";

export type { EnquiryTarget };

const enquiry = lazyClient<{ target: EnquiryTarget | null; onClose: () => void }>(() => import("./EnquiryDialog").then((m) => ({ default: m.EnquiryDialog })));
export const LazyEnquiryDialog = enquiry.Component;
export const preloadEnquiryDialog = enquiry.preload;

const lead = lazyClient<{ type: import("@sd/shared").LeadType }>(() => import("./LeadForm").then((m) => ({ default: m.LeadForm })));
export const LazyLeadForm = lead.Component;

const response = lazyClient<{ target: import("./RequirementResponseDialog").ResponseTarget | null; onClose: () => void }>(() =>
  import("./RequirementResponseDialog").then((m) => ({ default: m.RequirementResponseDialog })),
);
export const LazyResponseDialog = response.Component;
export const preloadResponseDialog = response.preload;

const wizard = lazyClient<object>(() => import("./RequirementWizard").then((m) => ({ default: m.RequirementWizard })));
export const LazyRequirementWizard = wizard.Component;
