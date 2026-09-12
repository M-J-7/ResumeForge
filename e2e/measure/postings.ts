/**
 * Ten job postings, one per role example, for the QA §11 measured pass.
 *
 * ## Why these are invented
 *
 * `QA.md` refuses to commit real job postings, for the reason
 * `src/lib/examples/roles.ts` gives for inventing its resumes: republishing
 * somebody else's document is a copyright problem, and a test fixture is a bad
 * place to have one. Check 6 in `QA.md` — "JD section split on ten real
 * postings" — is a separate, still-manual check about *parsing* real-world
 * formatting. This is not that check. §11 asks for ten enhancement proposals
 * across different roles, read by a person, with the refusal rate counted, and
 * for that a posting has to be realistic in its *requirements* rather than
 * authentic in its prose.
 *
 * ## Written against the skill vocabulary, not against plausibility
 *
 * The first version of this file was written the way a person writes a
 * posting: "month-end close", "patient care", "diary management". Seven of the
 * ten roles then composed an evidence paragraph that was the composer's
 * *placeholder* — "Nothing in that posting was recognised…" — and the pass
 * spent its time measuring a model rewriting an error message.
 *
 * The match engine resolves terms against `data/skills.json` (O*NET software
 * names) plus `src/lib/skills/curated.ts` (90 terms we own). A requirement is
 * `demonstrated` only when it is in that vocabulary and named **in a bullet** —
 * a skills-list mention is reported separately as "in your skills list but no
 * bullet shows you using it", and does not feed the composer.
 *
 * That second condition is the binding one, and it is severe: across all ten of
 * these example resumes, exactly two bullets name a term the vocabulary knows.
 * `Go`, in the software developer's "Rebuilt the ingestion path in Go", and
 * `dbt`, in the data analyst's "rebuilding it in dbt and Looker". Every other
 * bullet in every other resume is written the way this product's own guidance
 * tells people to write bullets — outcomes and numbers, not tool names — and
 * none of them can produce an evidence paragraph.
 *
 * So `present` is drawn from what a *bullet* demonstrates, and `absent` from
 * terms that are in the vocabulary and not in that resume, which is what makes
 * a guardrail refusal meaningful rather than accidental.
 *
 * ## Three roles are deliberately left unmatchable
 *
 * `registered-nurse`, `teacher` and `administrative-assistant` demonstrate
 * **nothing** in that vocabulary — it is a technology vocabulary, and their
 * resumes are not technology resumes. Their postings are written the way a
 * person would write them, and the placeholder they produce is recorded as a
 * finding rather than engineered away. Removing them would hide the fact that
 * a third of these roles cannot get an evidence paragraph at all.
 */

export interface MeasurementPosting {
  /** `slug` of the entry in `ROLE_EXAMPLES` this posting is written against. */
  readonly slug: string;
  readonly company: string;
  readonly roleTitle: string;
  /** Vocabulary terms this resume demonstrates. Expected to match. */
  readonly present: readonly string[];
  /** Vocabulary terms it does not. A proposal claiming one must be refused. */
  readonly absent: readonly string[];
  /** True where the resume demonstrates nothing the vocabulary knows. */
  readonly expectsPlaceholder?: boolean;
  readonly text: string;
}

export const MEASUREMENT_POSTINGS: readonly MeasurementPosting[] = [
  {
    slug: "software-developer",
    company: "Northwind Logistics",
    roleTitle: "Senior Backend Engineer",
    // `Go` is the only term this resume demonstrates *in a bullet* ("Rebuilt the
    // ingestion path in Go"), and a bullet is what `demonstrated` requires. The
    // rest are in its skills list, which the match engine reports separately as
    // "in your skills list but no bullet shows you using it".
    present: ["Go"],
    absent: ["Rust", "Datadog", "Elasticsearch", "Kubernetes"],
    text: `Senior Backend Engineer

We move freight for regional carriers, and the platform is the part that never gets to be down.

What you will do
- Own services end to end, from the schema to the on-call page
- Write Go, which is what most of the platform is
- Take latency out of paths that have grown faster than anybody planned for

What we are looking for
- Five or more years writing Go in production
- Rust for the parts where Go is not the right tool
- Datadog for instrumentation
- Elasticsearch behind our search
- Kubernetes
`,
  },
  {
    slug: "registered-nurse",
    company: "Lakeside General Hospital",
    roleTitle: "Charge Nurse, Medical-Surgical",
    present: [],
    absent: [],
    expectsPlaceholder: true,
    text: `Charge Nurse — Medical-Surgical

A 22-bed medical-surgical unit with a stable core team and a high acuity mix.

The role
- Run the shift: assignments, admissions, escalation
- Triage and reassess deteriorating patients
- Medication administration and reconciliation on a busy round

Requirements
- Current registration and three or more years on a medical-surgical unit
- Demonstrated patient care leadership on shift
- Telemetry and wound care
- ACLS
`,
  },
  {
    slug: "accountant",
    company: "Harbour & Vale",
    roleTitle: "Financial Accountant",
    present: ["Microsoft Excel", "Power BI"],
    absent: ["Tableau", "SQL"],
    text: `Financial Accountant

A mid-sized group finance team: five entities, one shared ledger, a published close deadline.

What the job is
- Own the month-end close for two entities
- Build the reporting pack in Power BI that the board actually reads
- Model the awkward parts in Microsoft Excel, and be able to defend every cell

What we need
- A qualified accountant with a clean close behind them
- Advanced Microsoft Excel
- Power BI
- Tableau
- SQL against the warehouse, so you are not waiting on an analyst
`,
  },
  {
    slug: "data-analyst",
    company: "Meridian Retail Group",
    roleTitle: "Senior Data Analyst",
    // `dbt` is the one term a bullet names ("rebuilding it in dbt and Looker").
    present: ["dbt"],
    absent: ["Tableau", "Apache Spark", "Machine Learning", "Snowflake"],
    text: `Senior Data Analyst

Commercial analytics for a retail estate of 180 stores.

You will
- Answer trading questions in SQL faster than the weekly pack can
- Own the transformation layer in dbt on top of Snowflake
- Build the Power BI dashboards the category teams open every morning
- Write Python where a query stops being the right tool

We are looking for
- dbt, which is where our transformation layer lives
- Tableau
- Apache Spark
- Snowflake
- Machine Learning for the forecasting work
`,
  },
  {
    slug: "project-manager",
    company: "Calder Infrastructure",
    roleTitle: "Senior Project Manager",
    present: ["Project Management"],
    absent: ["Jira", "Microsoft Project", "Salesforce"],
    text: `Senior Project Manager

Capital delivery for utilities clients. Programmes of £5m to £20m.

The work
- Own the schedule and the critical path, and be honest about both
- Project management across a stakeholder group that does not report to you
- Run the risk register as a live document rather than a quarterly ritual

Essential
- Project management of comparable programmes end to end
- Jira for delivery tracking
- Microsoft Project for the schedule
- Salesforce, because the commercial team lives in it
`,
  },
  {
    slug: "teacher",
    company: "Ashfield Academy",
    roleTitle: "Second in Department, Mathematics",
    present: [],
    absent: [],
    expectsPlaceholder: true,
    text: `Second in Mathematics

An 11-16 academy with a settled department and a rising cohort.

Responsibilities
- Curriculum sequencing across Key Stage 3 and 4
- Assessment design and the data that follows it
- Targeted intervention for the borderline group

We are looking for
- A strong classroom practitioner with whole-department impact
- Curriculum design experience
- Assessment and intervention you can show worked
- A-level Further Maths teaching
`,
  },
  {
    slug: "sales-representative",
    company: "Fenwick Instruments",
    roleTitle: "Territory Account Manager",
    present: ["Salesforce"],
    absent: ["Tableau", "Microsoft Excel", "Jira"],
    text: `Territory Account Manager

Scientific instruments into university and hospital labs. Long cycles, technical buyers.

The role
- Carry a territory quota and build the pipeline that gets you there
- Keep Salesforce current enough that the forecast means something
- Work alongside applications specialists on technical evaluations

Requirements
- Consistent quota attainment in a comparable cycle
- Salesforce
- Tableau for territory analysis
- Microsoft Excel modelling for total-cost proposals
- Jira, because implementations are tracked with the delivery team
`,
  },
  {
    slug: "customer-service-representative",
    company: "Brightline Utilities",
    roleTitle: "Customer Service Representative",
    present: ["Salesforce"],
    absent: ["Jira", "Microsoft Excel"],
    text: `Customer Service Representative

Billing and account queries for a domestic energy supplier.

Day to day
- Handle inbound calls on billing, meter reads and payment plans
- Work the queue in Salesforce and leave notes the next person can use
- Resolve complaints inside the regulator's deadlines

What we need
- Experience in a high-volume contact centre
- Salesforce
- Jira for raising defects to the billing team
- Microsoft Excel for the weekly reconciliation
`,
  },
  {
    slug: "administrative-assistant",
    company: "Pemberton Chambers",
    roleTitle: "Administrative Assistant",
    present: [],
    absent: [],
    expectsPlaceholder: true,
    text: `Administrative Assistant

Support for a set of chambers. Six barristers, one clerk, a great deal of paper.

The role
- Diary management across six people and a court list
- Minutes for the weekly practice meeting
- Expenses, travel and the reconciliation that follows

We are looking for
- Diary management under pressure
- Accurate minutes taken live
- Audio typing at speed
- Case management software
`,
  },
  {
    slug: "graduate-no-experience",
    company: "Orrell Digital",
    roleTitle: "Graduate Developer",
    present: ["JavaScript", "Java", "Python", "React", "PostgreSQL", "Git", "Linux"],
    absent: ["AWS", "Kubernetes", "Docker"],
    text: `Graduate Developer

Our graduate intake. We expect you to have written code, not to have shipped a product.

You will
- Pair with an engineer for your first three months
- Work in JavaScript and React across a small internal product
- Use Git the way a team does, not the way a coursework submission does

What we are looking for
- JavaScript, Java or Python from coursework, projects or a placement
- React
- PostgreSQL
- Git in a shared repository
- Linux
- AWS
- Kubernetes
- Docker
`,
  },
];
