/**
 * Skills outside software, owned (ROADMAP F5).
 *
 * The vocabulary the match engine reads was O*NET's technology list plus the
 * ninety engineering terms in `curated.ts`. Probed on 2026-09-29, *none* of
 * "patient care", "BLS", "lesson planning", "data entry", "payroll", "IFRS",
 * "cash handling" or "OSHA" resolved to anything — so a nurse, a teacher or an
 * administrative assistant pasted into the keyword scanner matched nothing,
 * and the cover-letter composer had nothing to build an alignment paragraph
 * from. The scanner page said so honestly; this is the fix rather than the
 * disclaimer.
 *
 * The same probe found a second gap that hit technical roles too: O*NET names
 * products with their vendor — "Dassault Systemes SolidWorks", "Intuit
 * QuickBooks" — and carries no short form, so the word people actually write,
 * "SolidWorks", resolved to nothing. The products at the end of this file are
 * the ones that gap mattered most for.
 *
 * And one false positive: "canvas" resolved to **Canva** through the plural
 * fold (drop the "s", land on something real). A teacher listing the Canvas
 * LMS was credited with a graphics tool. `canvas-lms` claims the word first.
 *
 * ## The rules `curated.ts` states, and two more
 *
 * - **Judge an alias from the posting's side.** A term the report lists came
 *   from the posting, so an alias that means something else in another field
 *   puts a wrong requirement on screen: "charting" in a front-end posting
 *   would read "Clinical documentation", "vitals" in Core Web Vitals would
 *   read "Vital signs", "ACA" is also the Affordable Care Act. Those are out;
 *   where a word is shared but means the same thing — "triage", "audit",
 *   "onboarding" — the canonical is the neutral word.
 *
 * - No alias that is an everyday word on its own: not "epic", "tally",
 *   "lean", "workday", "concur", "send". A false match tells someone they
 *   meet a requirement they do not, which is worse than a miss. So a few
 *   products carry a qualified name — "Epic EHR", "Tally ERP" — and a posting
 *   that says only "Epic" is missed, deliberately.
 * - No soft skills. "Communication" and "teamwork" are in every posting;
 *   weighting them as skills would drown the terms that distinguish one job
 *   from another.
 * - `domain.test.ts` holds all of it: unique terms across every curated
 *   entry, no alias in the common-word list, and each field's example resume
 *   matching an invented posting for its own role.
 */

import type { CuratedSkill } from "./curated";

export const DOMAIN_SKILLS: readonly CuratedSkill[] = [
  /* ---------------------------------------------------------------- */
  /* Healthcare                                                        */
  /* ---------------------------------------------------------------- */
  {
    id: "registered-nurse",
    canonical: "Registered Nurse",
    aliases: ["rn", "rn license", "rn licensure", "registered nurse license"],
    category: "healthcare",
  },
  {
    id: "basic-life-support",
    canonical: "Basic Life Support",
    aliases: ["bls", "bls certification", "bls certified"],
    category: "healthcare",
  },
  {
    id: "acls",
    canonical: "Advanced Cardiac Life Support",
    aliases: ["acls", "acls certification", "acls certified"],
    category: "healthcare",
  },
  {
    id: "pals",
    canonical: "Pediatric Advanced Life Support",
    aliases: ["pals certification", "paediatric advanced life support"],
    category: "healthcare",
  },
  {
    id: "cpr",
    canonical: "CPR",
    aliases: ["cardiopulmonary resuscitation", "cpr certification", "cpr certified"],
    category: "healthcare",
  },
  {
    id: "patient-care",
    canonical: "Patient care",
    aliases: [
      "direct patient care",
      "bedside care",
      "patient centred care",
      "patient centered care",
    ],
    category: "healthcare",
  },
  {
    id: "patient-assessment",
    canonical: "Patient assessment",
    aliases: ["nursing assessment", "health assessment", "clinical assessment"],
    category: "healthcare",
  },
  {
    id: "medication-administration",
    canonical: "Medication administration",
    aliases: ["administering medication", "administering medications", "med administration"],
    category: "healthcare",
  },
  {
    id: "iv-therapy",
    canonical: "IV therapy",
    aliases: ["intravenous therapy", "iv insertion", "iv cannulation", "iv starts"],
    category: "healthcare",
  },
  {
    id: "wound-care",
    canonical: "Wound care",
    aliases: ["wound management", "wound dressing"],
    category: "healthcare",
  },
  {
    id: "telemetry",
    canonical: "Telemetry",
    aliases: ["telemetry monitoring", "cardiac monitoring"],
    category: "healthcare",
  },
  {
    id: "triage",
    canonical: "Triage",
    aliases: ["patient triage", "triaging"],
    category: "healthcare",
  },
  {
    id: "infection-control",
    canonical: "Infection control",
    aliases: ["infection prevention", "infection prevention and control"],
    category: "healthcare",
  },
  {
    id: "care-planning",
    canonical: "Care planning",
    aliases: ["care plans", "care plan", "nursing care plans"],
    category: "healthcare",
  },
  {
    id: "patient-education",
    canonical: "Patient education",
    aliases: ["patient teaching"],
    category: "healthcare",
  },
  {
    id: "discharge-planning",
    canonical: "Discharge planning",
    aliases: ["discharge coordination"],
    category: "healthcare",
  },
  {
    id: "critical-care",
    canonical: "Critical care",
    aliases: ["intensive care", "icu", "critical care nursing"],
    category: "healthcare",
  },
  {
    id: "medical-surgical-nursing",
    canonical: "Medical-surgical nursing",
    aliases: ["med surg", "medical surgical", "medical surgical nursing"],
    category: "healthcare",
  },
  {
    id: "pediatric-nursing",
    canonical: "Pediatrics",
    aliases: ["pediatric nursing", "paediatric nursing", "paediatrics"],
    category: "healthcare",
  },
  {
    id: "clinical-documentation",
    canonical: "Clinical documentation",
    aliases: ["nursing documentation", "medical charting", "clinical charting"],
    category: "healthcare",
  },
  {
    id: "electronic-health-records",
    canonical: "Electronic health records",
    aliases: ["ehr", "emr", "electronic medical records", "ehr systems"],
    category: "healthcare",
  },
  {
    id: "epic-ehr",
    canonical: "Epic EHR",
    aliases: ["epic emr", "epic systems", "epic hyperspace"],
    category: "healthcare",
  },
  {
    id: "cerner",
    canonical: "Cerner",
    aliases: ["cerner powerchart", "cerner millennium", "oracle health"],
    category: "healthcare",
  },
  {
    id: "meditech",
    canonical: "MEDITECH",
    aliases: ["meditech expanse"],
    category: "healthcare",
  },
  {
    id: "hipaa",
    canonical: "HIPAA",
    aliases: ["hipaa compliance"],
    category: "healthcare",
  },
  {
    id: "phlebotomy",
    canonical: "Phlebotomy",
    aliases: ["venipuncture", "blood draws"],
    category: "healthcare",
  },
  {
    id: "vital-signs",
    canonical: "Vital signs",
    aliases: ["vital signs monitoring", "monitoring vital signs"],
    category: "healthcare",
  },
  {
    id: "medical-terminology",
    canonical: "Medical terminology",
    aliases: [],
    category: "healthcare",
  },
  {
    id: "sepsis-management",
    canonical: "Sepsis management",
    aliases: ["sepsis protocols", "sepsis protocol", "sepsis bundle"],
    category: "healthcare",
  },
  {
    id: "patient-safety",
    canonical: "Patient safety",
    aliases: ["fall prevention", "falls prevention"],
    category: "healthcare",
  },
  {
    id: "preceptorship",
    canonical: "Preceptorship",
    aliases: ["precepting", "preceptor", "precepted"],
    category: "healthcare",
  },

  /* ---------------------------------------------------------------- */
  /* Education                                                          */
  /* ---------------------------------------------------------------- */
  {
    id: "lesson-planning",
    canonical: "Lesson planning",
    aliases: ["lesson plans", "lesson plan", "planning lessons"],
    category: "education",
  },
  {
    id: "classroom-management",
    canonical: "Classroom management",
    aliases: ["behaviour management", "behavior management"],
    category: "education",
  },
  {
    id: "curriculum-design",
    canonical: "Curriculum design",
    aliases: ["curriculum development", "curriculum planning", "scheme of work", "schemes of work"],
    category: "education",
  },
  {
    id: "differentiated-instruction",
    canonical: "Differentiated instruction",
    aliases: ["differentiated teaching", "differentiated learning"],
    category: "education",
  },
  {
    id: "student-assessment",
    canonical: "Student assessment",
    aliases: [
      "assessment moderation",
      "formative assessment",
      "summative assessment",
      "marking and assessment",
    ],
    category: "education",
  },
  {
    id: "individualized-education-program",
    canonical: "Individualized Education Programs",
    aliases: [
      "iep",
      "ieps",
      "individualized education plan",
      "individualised education plan",
      "education health and care plan",
      "ehcp",
    ],
    category: "education",
  },
  {
    id: "special-education",
    canonical: "Special education",
    aliases: ["special educational needs", "sped", "sen support", "sendco", "senco"],
    category: "education",
  },
  {
    id: "safeguarding",
    canonical: "Safeguarding",
    aliases: ["child protection", "safeguarding children", "designated safeguarding lead"],
    category: "education",
  },
  {
    id: "qualified-teacher-status",
    canonical: "Qualified Teacher Status",
    aliases: ["qts"],
    category: "education",
  },
  {
    id: "teaching-license",
    canonical: "Teaching license",
    aliases: [
      "teaching licence",
      "teaching credential",
      "teacher certification",
      "teaching certification",
    ],
    category: "education",
  },
  {
    id: "bachelor-of-education",
    canonical: "Bachelor of Education",
    aliases: ["b.ed", "b. ed"],
    category: "education",
  },
  {
    id: "english-as-a-second-language",
    canonical: "English as a Second Language",
    aliases: ["esl", "eal", "esol", "tesol", "tefl", "english language learners"],
    category: "education",
  },
  {
    id: "early-childhood-education",
    canonical: "Early childhood education",
    aliases: ["early childhood", "eyfs", "early years foundation stage"],
    category: "education",
  },
  {
    id: "canvas-lms",
    canonical: "Canvas LMS",
    aliases: ["canvas", "instructure canvas"],
    category: "education",
  },
  {
    id: "learning-management-systems",
    canonical: "Learning management systems",
    aliases: ["lms", "learning management system"],
    category: "education",
  },
  {
    id: "parent-communication",
    canonical: "Parent communication",
    aliases: [
      "parent teacher conferences",
      "parent engagement",
      "parents evening",
      "parents evenings",
    ],
    category: "education",
  },
  {
    id: "intervention-planning",
    canonical: "Intervention planning",
    aliases: ["academic intervention", "targeted intervention", "intervention groups"],
    category: "education",
  },
  {
    id: "tutoring",
    canonical: "Tutoring",
    aliases: ["one to one tutoring", "small group tutoring"],
    category: "education",
  },

  /* ---------------------------------------------------------------- */
  /* Office and administration                                          */
  /* ---------------------------------------------------------------- */
  {
    id: "calendar-management",
    canonical: "Calendar management",
    aliases: ["diary management", "calendar coordination", "scheduling appointments"],
    category: "office",
  },
  {
    id: "data-entry",
    canonical: "Data entry",
    aliases: [],
    category: "office",
  },
  {
    id: "minute-taking",
    canonical: "Minute taking",
    aliases: ["taking minutes", "meeting minutes"],
    category: "office",
  },
  {
    id: "travel-coordination",
    canonical: "Travel coordination",
    aliases: ["travel arrangements", "travel booking", "travel planning"],
    category: "office",
  },
  {
    id: "records-management",
    canonical: "Records management",
    aliases: ["filing systems", "record keeping", "recordkeeping"],
    category: "office",
  },
  {
    id: "office-administration",
    canonical: "Office administration",
    aliases: ["office management", "office operations"],
    category: "office",
  },
  {
    id: "front-desk",
    canonical: "Front desk operations",
    aliases: ["front desk", "front desk management"],
    category: "office",
  },
  {
    id: "procurement",
    canonical: "Procurement",
    aliases: ["purchasing", "supplier management", "vendor management", "supplier negotiation"],
    category: "office",
  },
  {
    id: "event-planning",
    canonical: "Event planning",
    aliases: ["event coordination", "event management"],
    category: "office",
  },
  {
    id: "microsoft-office",
    canonical: "Microsoft Office",
    aliases: ["ms office", "microsoft office suite", "office suite"],
    category: "office",
  },
  {
    id: "microsoft-365",
    canonical: "Microsoft 365",
    aliases: ["office 365", "m365", "o365"],
    category: "office",
  },
  {
    id: "microsoft-word",
    canonical: "Microsoft Word",
    aliases: ["ms word"],
    category: "office",
  },
  {
    id: "microsoft-outlook",
    canonical: "Microsoft Outlook",
    aliases: ["ms outlook"],
    category: "office",
  },
  {
    id: "sharepoint",
    canonical: "SharePoint",
    aliases: ["microsoft sharepoint", "sharepoint online"],
    category: "office",
  },
  {
    id: "google-workspace",
    canonical: "Google Workspace",
    aliases: ["g suite", "gsuite", "google docs", "google sheets"],
    category: "office",
  },
  {
    id: "sap-concur",
    canonical: "SAP Concur",
    aliases: ["concur expense", "concur travel"],
    category: "office",
  },

  /* ---------------------------------------------------------------- */
  /* Finance and accounting                                             */
  /* ---------------------------------------------------------------- */
  {
    id: "bookkeeping",
    canonical: "Bookkeeping",
    aliases: ["book keeping"],
    category: "finance",
  },
  {
    id: "accounts-payable",
    canonical: "Accounts payable",
    aliases: ["accounts payable processing", "payables"],
    category: "finance",
  },
  {
    id: "accounts-receivable",
    canonical: "Accounts receivable",
    aliases: ["receivables"],
    category: "finance",
  },
  {
    id: "payroll",
    canonical: "Payroll",
    aliases: ["payroll processing", "payroll administration"],
    category: "finance",
  },
  {
    id: "account-reconciliation",
    canonical: "Reconciliation",
    aliases: [
      "account reconciliation",
      "reconciliations",
      "bank reconciliation",
      "bank reconciliations",
      "balance sheet reconciliation",
    ],
    category: "finance",
  },
  {
    id: "month-end-close",
    canonical: "Month-end close",
    aliases: [
      "month end close",
      "month end closing",
      "period end close",
      "year end close",
      "financial close",
    ],
    category: "finance",
  },
  {
    id: "financial-reporting",
    canonical: "Financial reporting",
    aliases: ["financial statements", "statutory reporting", "statutory accounts"],
    category: "finance",
  },
  {
    id: "budgeting",
    canonical: "Budgeting",
    aliases: ["budget management", "budget planning", "budgeting and forecasting"],
    category: "finance",
  },
  {
    id: "financial-forecasting",
    canonical: "Forecasting",
    aliases: ["financial forecasting", "cash flow forecasting"],
    category: "finance",
  },
  {
    id: "financial-modelling",
    canonical: "Financial modelling",
    aliases: ["financial modeling", "financial models"],
    category: "finance",
  },
  {
    id: "variance-analysis",
    canonical: "Variance analysis",
    aliases: [],
    category: "finance",
  },
  {
    id: "gaap",
    canonical: "GAAP",
    aliases: ["us gaap", "generally accepted accounting principles"],
    category: "finance",
  },
  {
    id: "ifrs",
    canonical: "IFRS",
    aliases: ["international financial reporting standards"],
    category: "finance",
  },
  {
    id: "ind-as",
    canonical: "Ind AS",
    aliases: ["indian accounting standards"],
    category: "finance",
  },
  {
    id: "vat",
    canonical: "VAT",
    aliases: ["value added tax", "vat returns"],
    category: "finance",
  },
  {
    id: "gst",
    canonical: "GST",
    aliases: ["goods and services tax", "gst returns", "gst filing", "gst compliance"],
    category: "finance",
  },
  {
    id: "tds",
    canonical: "TDS",
    aliases: ["tax deducted at source", "tds returns"],
    category: "finance",
  },
  {
    id: "tax-preparation",
    canonical: "Tax preparation",
    aliases: ["tax returns", "tax filing", "income tax returns"],
    category: "finance",
  },
  {
    id: "auditing",
    canonical: "Auditing",
    aliases: ["audit", "internal audit", "external audit", "audits"],
    category: "finance",
  },
  {
    id: "group-consolidation",
    canonical: "Group consolidation",
    aliases: ["financial consolidation", "group accounts"],
    category: "finance",
  },
  {
    id: "quickbooks",
    canonical: "QuickBooks",
    aliases: ["quickbooks online", "intuit quickbooks"],
    category: "finance",
  },
  {
    id: "xero",
    canonical: "Xero",
    aliases: [],
    category: "finance",
  },
  {
    id: "netsuite",
    canonical: "NetSuite",
    aliases: ["oracle netsuite", "netsuite erp"],
    category: "finance",
  },
  {
    id: "sap",
    canonical: "SAP",
    aliases: ["sap erp", "sap s/4hana", "s/4hana", "sap fico", "sap ecc"],
    category: "finance",
  },
  {
    id: "tally-erp",
    canonical: "Tally ERP",
    aliases: ["tallyprime", "tally prime", "tally erp 9", "tally erp9"],
    category: "finance",
  },
  {
    id: "cpa",
    canonical: "CPA",
    aliases: ["certified public accountant"],
    category: "finance",
  },
  {
    id: "chartered-accountant",
    canonical: "Chartered Accountant",
    aliases: ["chartered accountancy", "icai"],
    category: "finance",
  },
  {
    id: "acca",
    canonical: "ACCA",
    aliases: ["association of chartered certified accountants"],
    category: "finance",
  },

  /* ---------------------------------------------------------------- */
  /* Retail, hospitality and customer service                           */
  /* ---------------------------------------------------------------- */
  {
    id: "customer-service",
    canonical: "Customer service",
    aliases: ["customer support", "client service", "customer care"],
    category: "retail",
  },
  {
    id: "point-of-sale",
    canonical: "Point of sale",
    aliases: ["pos", "pos systems", "point of sale systems", "epos"],
    category: "retail",
  },
  {
    id: "cash-handling",
    canonical: "Cash handling",
    aliases: ["handling cash", "till management"],
    category: "retail",
  },
  {
    id: "inventory-management",
    canonical: "Inventory management",
    aliases: ["inventory control", "stock control", "stock management"],
    category: "retail",
  },
  {
    id: "visual-merchandising",
    canonical: "Merchandising",
    aliases: ["visual merchandising", "planograms"],
    category: "retail",
  },
  {
    id: "loss-prevention",
    canonical: "Loss prevention",
    aliases: ["shrink control", "shrinkage control", "shrink reduction"],
    category: "retail",
  },
  {
    id: "food-safety",
    canonical: "Food safety",
    aliases: ["food hygiene", "haccp", "servsafe"],
    category: "retail",
  },
  {
    id: "upselling",
    canonical: "Upselling",
    aliases: ["cross selling", "upsell"],
    category: "retail",
  },
  {
    id: "staff-scheduling",
    canonical: "Staff scheduling",
    aliases: ["rostering", "rota management", "shift scheduling", "workforce scheduling"],
    category: "retail",
  },
  {
    id: "p-and-l-management",
    canonical: "P&L management",
    aliases: ["p&l", "profit and loss", "p&l responsibility"],
    category: "retail",
  },
  {
    id: "conflict-resolution",
    canonical: "Conflict resolution",
    aliases: ["de escalation", "complaint resolution", "complaint handling", "handling complaints"],
    category: "retail",
  },
  {
    id: "zendesk",
    canonical: "Zendesk",
    aliases: [],
    category: "retail",
  },
  {
    id: "crm",
    canonical: "CRM",
    aliases: ["crm systems", "customer relationship management"],
    category: "retail",
  },

  /* ---------------------------------------------------------------- */
  /* People and HR                                                      */
  /* ---------------------------------------------------------------- */
  {
    id: "recruiting",
    canonical: "Recruiting",
    aliases: ["recruitment", "talent acquisition", "full cycle recruiting"],
    category: "hr",
  },
  {
    id: "onboarding",
    canonical: "Onboarding",
    aliases: ["employee onboarding", "onboarding coordination", "new hire onboarding"],
    category: "hr",
  },
  {
    id: "employee-relations",
    canonical: "Employee relations",
    aliases: [],
    category: "hr",
  },
  {
    id: "performance-management",
    canonical: "Performance management",
    aliases: ["performance reviews", "performance appraisals"],
    category: "hr",
  },
  {
    id: "compensation-and-benefits",
    canonical: "Compensation and benefits",
    aliases: [
      "compensation & benefits",
      "benefits administration",
      "compensation planning",
      "compensation banding",
    ],
    category: "hr",
  },
  {
    id: "hris",
    canonical: "HRIS",
    aliases: ["human resources information system", "hr information systems"],
    category: "hr",
  },
  {
    id: "workday-hcm",
    canonical: "Workday HCM",
    aliases: ["workday hris", "workday financials"],
    category: "hr",
  },
  {
    id: "adp",
    canonical: "ADP",
    aliases: ["adp workforce now", "adp payroll"],
    category: "hr",
  },
  {
    id: "employment-law",
    canonical: "Employment law",
    aliases: ["labor law", "labour law", "flsa", "flsa compliance", "employment legislation"],
    category: "hr",
  },
  {
    id: "learning-and-development",
    canonical: "Learning and development",
    aliases: ["l&d", "training and development"],
    category: "hr",
  },

  /* ---------------------------------------------------------------- */
  /* Sales and marketing                                                */
  /* ---------------------------------------------------------------- */
  {
    id: "lead-generation",
    canonical: "Lead generation",
    aliases: ["lead gen", "prospecting"],
    category: "sales",
  },
  {
    id: "account-management",
    canonical: "Account management",
    aliases: ["key account management", "client account management"],
    category: "sales",
  },
  {
    id: "cold-calling",
    canonical: "Cold calling",
    aliases: ["cold outreach", "outbound calling"],
    category: "sales",
  },
  {
    id: "b2b-sales",
    canonical: "B2B sales",
    aliases: ["business to business sales"],
    category: "sales",
  },
  {
    id: "pipeline-management",
    canonical: "Pipeline management",
    aliases: ["sales pipeline"],
    category: "sales",
  },
  {
    id: "hubspot",
    canonical: "HubSpot",
    aliases: ["hubspot crm"],
    category: "sales",
  },
  {
    id: "content-marketing",
    canonical: "Content marketing",
    aliases: [],
    category: "marketing",
  },
  {
    id: "social-media-marketing",
    canonical: "Social media marketing",
    aliases: ["social media management", "social media strategy"],
    category: "marketing",
  },
  {
    id: "email-marketing",
    canonical: "Email marketing",
    aliases: ["email campaigns", "email marketing campaigns"],
    category: "marketing",
  },
  {
    id: "market-research",
    canonical: "Market research",
    aliases: [],
    category: "marketing",
  },
  {
    id: "brand-management",
    canonical: "Brand management",
    aliases: ["brand strategy"],
    category: "marketing",
  },
  {
    id: "pay-per-click",
    canonical: "Pay-per-click advertising",
    aliases: ["ppc", "google ads", "paid search"],
    category: "marketing",
  },

  /* ---------------------------------------------------------------- */
  /* Engineering, manufacturing and the trades                          */
  /* ---------------------------------------------------------------- */
  {
    id: "solidworks",
    canonical: "SolidWorks",
    aliases: ["solidworks cad"],
    category: "engineering",
  },
  {
    id: "autocad",
    canonical: "AutoCAD",
    aliases: ["autodesk autocad"],
    category: "engineering",
  },
  {
    id: "matlab",
    canonical: "MATLAB",
    aliases: [],
    category: "engineering",
  },
  {
    id: "ansys",
    canonical: "ANSYS",
    aliases: ["ansys mechanical", "ansys fluent"],
    category: "engineering",
  },
  {
    id: "gd-and-t",
    canonical: "GD&T",
    aliases: ["geometric dimensioning and tolerancing"],
    category: "engineering",
  },
  {
    id: "cad",
    canonical: "CAD",
    aliases: ["computer aided design"],
    category: "engineering",
  },
  {
    id: "finite-element-analysis",
    canonical: "Finite element analysis",
    aliases: ["fea"],
    category: "engineering",
  },
  {
    id: "computational-fluid-dynamics",
    canonical: "Computational fluid dynamics",
    aliases: ["cfd"],
    category: "engineering",
  },
  {
    id: "osha",
    canonical: "OSHA",
    aliases: ["osha compliance", "osha 30", "osha 10"],
    category: "engineering",
  },
  {
    id: "preventive-maintenance",
    canonical: "Preventive maintenance",
    aliases: ["preventative maintenance", "planned maintenance"],
    category: "engineering",
  },
  {
    id: "blueprint-reading",
    canonical: "Blueprint reading",
    aliases: ["reading blueprints", "technical drawings", "engineering drawings"],
    category: "engineering",
  },
  {
    id: "lean-manufacturing",
    canonical: "Lean manufacturing",
    aliases: ["lean principles", "kaizen", "5s methodology"],
    category: "engineering",
  },
  {
    id: "six-sigma",
    canonical: "Six Sigma",
    aliases: ["lean six sigma", "six sigma green belt", "six sigma black belt"],
    category: "engineering",
  },
  {
    id: "root-cause-analysis",
    canonical: "Root cause analysis",
    aliases: ["rca", "root cause"],
    category: "engineering",
  },
  {
    id: "quality-control",
    canonical: "Quality control",
    aliases: ["qc", "quality inspection"],
    category: "engineering",
  },
  {
    id: "hvac",
    canonical: "HVAC",
    aliases: [],
    category: "engineering",
  },
  {
    id: "welding",
    canonical: "Welding",
    aliases: ["mig welding", "tig welding"],
    category: "engineering",
  },
  {
    id: "plc-programming",
    canonical: "PLC programming",
    aliases: ["plc", "programmable logic controllers"],
    category: "engineering",
  },
  {
    id: "pmp",
    canonical: "PMP",
    aliases: ["project management professional"],
    category: "engineering",
  },
  {
    id: "prince2",
    canonical: "PRINCE2",
    aliases: ["prince 2"],
    category: "engineering",
  },
];
