/**
 * The example resumes (P36).
 *
 * ## The direct answer to a 500-example moat
 *
 * A competitor ranks on 500+ examples across 20 industries. Sixteen will not
 * out-rank that on count, and trying to would mean generating them — which
 * D8 forbids, and which produces the thin pages that rank once and disappoint
 * forever. What sixteen *can* do is be genuinely better on each query: a real
 * resume, the plain text a parser gets out of it, and an explanation of the
 * specific choices in it.
 *
 * §10.4b doubled the set from eight, and the eight it added were chosen for
 * where the demand actually is rather than for variety. The original set
 * skewed professional and technical; "customer service resume example" and
 * "administrative assistant resume example" are asked far more often than any
 * of them, and were answered here by nothing. Growing further is more of the
 * same work — each page is one query, and the machinery is done.
 *
 * The set grows by adding entries here. Nothing else changes: the route, the
 * sitemap and the tests all read this array.
 *
 * ## Everything here is invented, and says so
 *
 * These are not anyone's resumes. Names, employers and numbers are made up —
 * a real one could not be published for the same reason `QA.md` refuses to
 * commit job postings, doubled by it being someone's personal data. Every
 * page says so in as many words.
 *
 * ## What makes each one worth reading
 *
 * `notes` is the part a generated example cannot have: three or four
 * observations about *why* this resume is shaped the way it is, tied to
 * something on the page. That is the content, and the resume is its
 * illustration — not the other way around.
 */

import type { ResumeDocument } from "@/lib/resume/schema";
import { contact, exampleResume, project, role, skills, study } from "./build";

export interface RoleExample {
  /** URL segment. Stable — it is the page's identity in search results. */
  readonly slug: string;
  /** How the role is named in the heading. */
  readonly role: string;
  /** The title fed to `phrasesForTitle`, so scaffolds and related roles match. */
  readonly occupationTitle: string;
  /** Industry grouping, for the index page. */
  readonly field: string;
  /** One line under the heading. */
  readonly summary: string;
  /** Three or four observations about this specific resume. */
  readonly notes: readonly { readonly title: string; readonly body: string }[];
  /**
   * The hiring market whose conventions it follows, when it follows one:
   * `IN` for CGPA and percentages, amounts in lakh and A4; `US` for Letter
   * and US titles. Absent for the examples that suit either. Shown on the
   * page, because a reader applying elsewhere should know which choices to
   * translate.
   */
  readonly market?: "IN" | "US";
  readonly resume: ResumeDocument;
  /**
   * When what this page says last changed, as YYYY-MM-DD. It is the sitemap's
   * `lastmod`, the Article's `dateModified` and the "Updated" line on the
   * page. `content-dates.test.ts` pins a hash of the content beside it, so the
   * content cannot change without somebody deciding what this should say.
   */
  readonly updated: string;
}

export const ROLE_EXAMPLES: readonly RoleExample[] = [
  {
    slug: "software-developer",
    updated: "2026-09-10",
    role: "Software Developer",
    occupationTitle: "Software Developers",
    field: "Technology",
    summary:
      "Six years of backend work, written so the results are readable without knowing the systems.",
    notes: [
      {
        title: "Every bullet names a number the reader can picture",
        body: "“p99 from 1.4s to 210ms” means something to a hiring manager who has never seen this codebase. “Improved performance” does not, and it is the same amount of typing.",
      },
      {
        title: "The technology list is grouped, not a wall",
        body: "Two groups of four to six. A single row of thirty things reads as a keyword dump, and a reader skims past it — which loses the four that mattered.",
      },
      {
        title: "No proficiency bars",
        body: "A parser cannot read a slider and a recruiter does not believe one. If a skill is on the list, be ready to be asked about it.",
      },
    ],
    resume: exampleResume({
      slug: "software-developer",
      contact: contact({
        fullName: "Devika Menon",
        email: "devika@example.com",
        phone: "+91 80 4567 8901",
        location: "Bengaluru, India",
      }),
      summary:
        "Backend engineer with six years on payments and data infrastructure. Most recently took a settlement pipeline from 40 minutes to under 6 while it doubled in volume.",
      experience: [
        role({
          id: "sd-1",
          title: "Senior Backend Engineer",
          organization: "Northwind Payments",
          location: "Bengaluru, India",
          from: "2022-04",
          bullets: [
            "Cut settlement processing from 40 minutes to 6 by replacing nightly batches with an event-driven pipeline.",
            "Led the migration of 2.1 billion ledger rows with zero downtime and no reconciliation breaks.",
            "Reduced on-call pages 62% by replacing threshold alerts with error-budget burn rates.",
            "Mentored four engineers, two of whom now own services end to end.",
          ],
        }),
        role({
          id: "sd-2",
          title: "Backend Engineer",
          organization: "Corvid Labs",
          location: "Pune, India",
          from: "2019-07",
          to: "2022-03",
          bullets: [
            "Rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.",
            "Introduced contract testing across 11 services, cutting integration failures from 18 a month to 3.",
          ],
        }),
      ],
      education: [
        study({
          id: "sd-edu",
          institution: "College of Engineering Pune",
          credential: "BTech",
          field: "Computer Science",
          location: "Pune, India",
          from: "2015-08",
          to: "2019-05",
          result: "8.6 CGPA",
        }),
      ],
      skillGroups: [
        skills("sd-sk-1", "Languages", ["Go", "Python", "TypeScript", "SQL"]),
        skills("sd-sk-2", "Infrastructure", [
          "Kubernetes",
          "Terraform",
          "AWS",
          "Kafka",
          "Postgres",
        ]),
      ],
    }),
  },

  {
    slug: "registered-nurse",
    updated: "2026-09-10",
    role: "Registered Nurse",
    occupationTitle: "Registered Nurses",
    field: "Healthcare",
    summary: "Clinical work written with the volume and the outcome together, and licences first.",
    notes: [
      {
        title: "The licence is in the document, not implied",
        body: "For a regulated role it is the first filter, human or automated. It belongs where it can be read: in the body text, with the issuing body and the state.",
      },
      {
        title: "Patient volume gives the roles their scale",
        body: "“32-bed unit” and “ratio of 1:4” tell a charge nurse more about the work than the unit's name does.",
      },
      {
        title: "Outcomes, not duties",
        body: "Every nurse administers medication. Reducing falls by 41% on a specific unit is the thing that distinguishes one application from forty.",
      },
    ],
    resume: exampleResume({
      slug: "registered-nurse",
      contact: contact({
        fullName: "Alina Okoro",
        email: "alina@example.com",
        phone: "+1 216 555 0148",
        location: "Cleveland, OH",
      }),
      summary:
        "Registered nurse with nine years in acute medical-surgical care, including four as a charge nurse on a 32-bed unit. RN licence, Ohio, active through 2028.",
      experience: [
        role({
          id: "rn-1",
          title: "Charge Nurse, Medical-Surgical",
          organization: "Lakeside Regional Hospital",
          location: "Cleveland, OH",
          from: "2021-02",
          bullets: [
            "Ran a 32-bed unit across night shift at a 1:4 ratio, coordinating 11 staff and admissions from three services.",
            "Cut patient falls 41% over eighteen months by rewriting the hourly rounding protocol and auditing it weekly.",
            "Reduced discharge delays from an average of 4.2 hours to 90 minutes by moving pharmacy review earlier.",
            "Precepted 14 new graduates, of whom 12 remained on the unit past their first year.",
          ],
        }),
        role({
          id: "rn-2",
          title: "Staff Nurse, Medical-Surgical",
          organization: "St. Brendan's Hospital",
          location: "Akron, OH",
          from: "2016-06",
          to: "2021-01",
          bullets: [
            "Carried a 5-patient assignment on a high-acuity unit with a 96% medication-administration accuracy audit result.",
            "Served on the sepsis committee that took time-to-antibiotic from 71 minutes to 44.",
          ],
        }),
      ],
      education: [
        study({
          id: "rn-edu",
          institution: "Case Western Reserve University",
          credential: "BSN",
          field: "Nursing",
          location: "Cleveland, OH",
          from: "2012-08",
          to: "2016-05",
        }),
      ],
      skillGroups: [
        skills("rn-sk-1", "Clinical", [
          "Acute med-surg",
          "Telemetry",
          "Wound care",
          "IV therapy",
          "Sepsis protocols",
        ]),
        skills("rn-sk-2", "Credentials", ["RN (Ohio)", "BLS", "ACLS", "Epic"]),
      ],
    }),
  },

  {
    slug: "accountant",
    updated: "2026-09-10",
    role: "Accountant",
    occupationTitle: "Accountants and Auditors",
    field: "Finance",
    summary: "A traditional field, written traditionally — and quantified anyway.",
    notes: [
      {
        title: "Conservative formatting is the right call here",
        body: "Law, finance and academia expect a serif and a plain layout. The Chancery template exists for this, and departing from it is the thing people notice.",
      },
      {
        title: "The close is the unit of work, so it is the unit of measurement",
        body: "“Month-end close from 11 days to 6” is the sentence a controller is scanning for.",
      },
      {
        title: "Software is named because it is a real filter",
        body: "NetSuite and SAP are genuine screening criteria in this field, unlike the generic “Microsoft Office” line that appears on every resume and screens nobody.",
      },
    ],
    resume: exampleResume({
      slug: "accountant",
      contact: contact({
        fullName: "Martin Whelan",
        email: "martin@example.com",
        phone: "+353 1 555 0173",
        location: "Dublin, Ireland",
      }),
      summary:
        "Qualified accountant with seven years in industry, focused on close, controls and audit readiness for mid-market manufacturers.",
      experience: [
        role({
          id: "ac-1",
          title: "Financial Accountant",
          organization: "Ardmore Manufacturing",
          location: "Dublin, Ireland",
          from: "2021-09",
          bullets: [
            "Cut month-end close from 11 working days to 6 by automating intercompany reconciliation in NetSuite.",
            "Prepared the group audit file that closed with zero adjustments for three consecutive years.",
            "Identified €340k of duplicate supplier payments across four entities and recovered €290k of it.",
            "Rebuilt the fixed-asset register covering 2,400 items after a decade of spreadsheet drift.",
          ],
        }),
        role({
          id: "ac-2",
          title: "Audit Senior",
          organization: "Kearney & Doyle",
          location: "Cork, Ireland",
          from: "2018-01",
          to: "2021-08",
          bullets: [
            "Led audit fieldwork on 14 clients a year with revenues from €4m to €80m, supervising teams of three.",
            "Closed 46 prior-year control findings across the portfolio within two cycles.",
          ],
        }),
      ],
      education: [
        study({
          id: "ac-edu",
          institution: "University College Cork",
          credential: "BComm",
          field: "Accounting",
          location: "Cork, Ireland",
          from: "2014-09",
          to: "2017-06",
          result: "First Class Honours",
        }),
      ],
      skillGroups: [
        skills("ac-sk-1", "Reporting", [
          "IFRS",
          "Group consolidation",
          "Statutory accounts",
          "VAT",
        ]),
        skills("ac-sk-2", "Systems", ["NetSuite", "SAP", "Power BI", "Advanced Excel"]),
        skills("ac-sk-3", "Credentials", ["ACA (Chartered Accountants Ireland)"]),
      ],
      settings: { fontPair: "classic", headerStyle: "centered" },
    }),
  },

  {
    slug: "data-analyst",
    updated: "2026-09-10",
    role: "Data Analyst",
    occupationTitle: "Data Scientists",
    field: "Technology",
    summary: "Analysis is worth a bullet when a decision came out of it — every one here does.",
    notes: [
      {
        title: "Each analysis names what changed as a result",
        body: "“Built a churn model” is a task. “Built the churn model that redirected £1.2m of retention spend” is a result, and it is the same project.",
      },
      {
        title: "The tools are listed once, not repeated per role",
        body: "Repeating SQL under every job is the keyword-stuffing pattern the match engine penalises, and a human reader discounts it the same way.",
      },
      {
        title: "A project section carries the work an employer did not pay for",
        body: "Public, checkable, and often the most specific evidence on a mid-career analyst's resume.",
      },
    ],
    resume: exampleResume({
      slug: "data-analyst",
      contact: contact({
        fullName: "Tomás Herrera",
        email: "tomas@example.com",
        phone: "+44 20 7946 0912",
        location: "Manchester, UK",
      }),
      summary:
        "Analyst working on retention and pricing for subscription businesses. Five years turning messy operational data into decisions somebody actually took.",
      experience: [
        role({
          id: "da-1",
          title: "Senior Data Analyst",
          organization: "Halden Retail Group",
          location: "Manchester, UK",
          from: "2022-01",
          bullets: [
            "Built the churn model that redirected £1.2m of annual retention spend away from customers who were never going to leave.",
            "Cut the weekly trading report from 6 hours of manual work to 20 minutes by rebuilding it in dbt and Looker.",
            "Ran the pricing test across 340 stores that raised margin 2.4 points with no measurable volume loss.",
          ],
        }),
        role({
          id: "da-2",
          title: "Data Analyst",
          organization: "Brightline Insurance",
          location: "Leeds, UK",
          from: "2019-09",
          to: "2021-12",
          bullets: [
            "Found the claims-routing error costing £180k a year that four teams had each assumed was somebody else's.",
            "Rebuilt 23 legacy reports onto one warehouse model, retiring three conflicting definitions of “active customer”.",
          ],
        }),
      ],
      education: [
        study({
          id: "da-edu",
          institution: "University of Sheffield",
          credential: "BSc",
          field: "Mathematics and Statistics",
          location: "Sheffield, UK",
          from: "2015-09",
          to: "2018-06",
          result: "2:1",
        }),
      ],
      skillGroups: [
        skills("da-sk-1", "Analysis", ["SQL", "Python", "dbt", "Experiment design", "Forecasting"]),
        skills("da-sk-2", "Reporting", ["Looker", "Power BI", "Snowflake"]),
      ],
      projects: [
        project({
          id: "da-proj",
          name: "uk-retail-footfall",
          role: "Author",
          url: "https://github.com/example/uk-retail-footfall",
          from: "2023-02",
          to: "2023-08",
          bullets: [
            "Open dataset and notebook series on high-street footfall, cited in two local-government planning reports.",
          ],
        }),
      ],
    }),
  },

  {
    slug: "project-manager",
    updated: "2026-09-10",
    role: "Project Manager",
    occupationTitle: "Project Management Specialists",
    field: "Operations",
    summary: "Scope, budget and date on every project, because those are the three questions.",
    notes: [
      {
        title: "Three numbers per project",
        body: "How big, how much, and did it land on time. A project manager's resume that omits any of the three invites the reader to assume the worst.",
      },
      {
        title: "“Coordinated” and “facilitated” do not appear",
        body: "They describe attendance. The lint engine flags them, and it is right to: the interesting verb is what changed because you were coordinating.",
      },
      {
        title: "The certification is listed with its issuer",
        body: "PMP means something; “certified project professional” means nothing without knowing who certified it.",
      },
    ],
    resume: exampleResume({
      slug: "project-manager",
      contact: contact({
        fullName: "Grace Adeyemi",
        email: "grace@example.com",
        phone: "+1 312 555 0166",
        location: "Chicago, IL",
      }),
      summary:
        "Project manager delivering infrastructure and systems work in regulated environments. Eleven years, and nothing over £2m has slipped a quarter.",
      experience: [
        role({
          id: "pm-1",
          title: "Senior Project Manager",
          organization: "Meridian Utilities",
          location: "Chicago, IL",
          from: "2020-05",
          bullets: [
            "Delivered a $14m metering rollout across 240,000 customers, six weeks early and 4% under budget.",
            "Recovered a stalled billing migration by rescoping to three releases; the first shipped in nine weeks.",
            "Ran the vendor selection that cut annual maintenance spend from $2.1m to $1.4m across two contracts.",
          ],
        }),
        role({
          id: "pm-2",
          title: "Project Manager",
          organization: "Kestrel Systems",
          location: "Milwaukee, WI",
          from: "2015-03",
          to: "2020-04",
          bullets: [
            "Delivered 19 client implementations averaging $600k, with 17 accepted on the first submission.",
            "Introduced the weekly risk review that took average issue age from 34 days to 9.",
          ],
        }),
      ],
      education: [
        study({
          id: "pm-edu",
          institution: "University of Illinois",
          credential: "BS",
          field: "Industrial Engineering",
          location: "Urbana, IL",
          from: "2010-08",
          to: "2014-05",
        }),
      ],
      skillGroups: [
        skills("pm-sk-1", "Delivery", [
          "Scope and change control",
          "Vendor management",
          "Risk registers",
          "Stage gating",
        ]),
        skills("pm-sk-2", "Credentials", ["PMP (Project Management Institute)", "PRINCE2"]),
      ],
    }),
  },

  {
    slug: "teacher",
    updated: "2026-09-10",
    role: "Teacher",
    occupationTitle: "Secondary School Teachers, Except Special and Career/Technical Education",
    field: "Education",
    summary: "Cohort sizes, subjects and results — the three things a head of department checks.",
    notes: [
      {
        title: "Cohort size makes the rest legible",
        body: "“Raised attainment” means one thing across 18 students and another across 180. Say which.",
      },
      {
        title: "Pastoral and curriculum work counts as work",
        body: "Running a department's scheme of work is a real deliverable, and it is what separates a candidate from a competent classroom teacher.",
      },
      {
        title: "The qualification is stated plainly, with the awarding body",
        body: "Teaching is regulated, and the certificate is a filter before anything else on the page is read.",
      },
    ],
    resume: exampleResume({
      slug: "teacher",
      contact: contact({
        fullName: "Priya Nair",
        email: "priya@example.com",
        phone: "+44 161 555 0134",
        location: "Leeds, UK",
      }),
      summary:
        "Secondary mathematics teacher, eight years, including three as second in department. QTS awarded 2017.",
      experience: [
        role({
          id: "te-1",
          title: "Second in Department, Mathematics",
          organization: "Ashfield Academy",
          location: "Leeds, UK",
          from: "2021-09",
          bullets: [
            "Taught 180 students across Key Stage 3 to A-level, with Progress 8 for the cohort moving from −0.2 to +0.4.",
            "Rewrote the Key Stage 3 scheme of work now used by all six teachers in the department.",
            "Raised A-level uptake from 22 students to 41 over three years by running a Year 11 bridging programme.",
            "Mentored three trainee teachers, all of whom passed their induction year.",
          ],
        }),
        role({
          id: "te-2",
          title: "Mathematics Teacher",
          organization: "Whitmoor High School",
          location: "Bradford, UK",
          from: "2017-09",
          to: "2021-08",
          bullets: [
            "Taught five classes of roughly 28 across Key Stage 3 and 4, with 78% achieving grade 4 or above.",
            "Ran the intervention group that moved 19 of 24 borderline students up a grade.",
          ],
        }),
      ],
      education: [
        study({
          id: "te-edu-1",
          institution: "University of Leeds",
          credential: "PGCE",
          field: "Secondary Mathematics",
          location: "Leeds, UK",
          from: "2016-09",
          to: "2017-07",
        }),
        study({
          id: "te-edu-2",
          institution: "University of Warwick",
          credential: "BSc",
          field: "Mathematics",
          location: "Coventry, UK",
          from: "2013-09",
          to: "2016-06",
          result: "2:1",
        }),
      ],
      skillGroups: [
        skills("te-sk-1", "Teaching", [
          "Key Stage 3–5 mathematics",
          "Curriculum design",
          "Intervention planning",
          "Assessment moderation",
        ]),
        skills("te-sk-2", "Credentials", ["QTS", "Safeguarding (Level 3)"]),
      ],
    }),
  },

  {
    slug: "sales-representative",
    updated: "2026-09-10",
    role: "Sales Representative",
    occupationTitle:
      "Sales Representatives, Wholesale and Manufacturing, Except Technical and Scientific Products",
    field: "Sales",
    summary: "Quota, attainment, and what was actually sold — stated without hedging.",
    notes: [
      {
        title: "Quota attainment is a percentage against a named number",
        body: "“Exceeded targets” is unverifiable. “118% of a $2.4m quota” can be discussed in an interview, which is the point of putting it there.",
      },
      {
        title: "Named accounts, where they can be named",
        body: "A logo a reader recognises does more than three adjectives. Where an account cannot be named, its size can.",
      },
      {
        title: "The cycle length says what kind of selling this is",
        body: "A nine-month enterprise cycle and a two-week transactional one are different jobs, and a sales manager screens on which one you have done.",
      },
    ],
    resume: exampleResume({
      slug: "sales-representative",
      contact: contact({
        fullName: "Daniel Osei",
        email: "daniel@example.com",
        phone: "+1 646 555 0117",
        location: "New York, NY",
      }),
      summary:
        "B2B sales in industrial supply, seven years. Consistently over quota on a nine-month average cycle in a territory built from scratch.",
      experience: [
        role({
          id: "sr-1",
          title: "Territory Account Manager",
          organization: "Halloway Industrial",
          location: "New York, NY",
          from: "2021-03",
          bullets: [
            "Closed 118% of a $2.4m quota in 2024 and 106% in 2023, on an average nine-month cycle.",
            "Opened the northeast territory from zero to 34 active accounts worth $1.8m in recurring revenue.",
            "Won a $640k three-year contract against two incumbent suppliers by rebuilding the total-cost case.",
            "Retained 94% of account value through a 9% list-price increase.",
          ],
        }),
        role({
          id: "sr-2",
          title: "Inside Sales Representative",
          organization: "Brightpath Supply",
          location: "Newark, NJ",
          from: "2018-06",
          to: "2021-02",
          bullets: [
            "Carried 140 accounts and grew the book from $700k to $1.1m over two years.",
            "Cut quote turnaround from three days to same-day, lifting quote-to-order conversion from 21% to 33%.",
          ],
        }),
      ],
      education: [
        study({
          id: "sr-edu",
          institution: "Rutgers University",
          credential: "BA",
          field: "Communications",
          location: "New Brunswick, NJ",
          from: "2014-09",
          to: "2018-05",
        }),
      ],
      skillGroups: [
        skills("sr-sk-1", "Selling", [
          "Territory development",
          "Contract negotiation",
          "Total-cost analysis",
          "Account retention",
        ]),
        skills("sr-sk-2", "Systems", ["Salesforce", "HubSpot", "Gong"]),
      ],
    }),
  },

  {
    slug: "graduate-no-experience",
    updated: "2026-09-10",
    role: "Graduate with no work experience",
    occupationTitle: "Software Developers",
    field: "Early career",
    summary:
      "The hardest case, and the one most examples skip: a first resume with no employment history at all.",
    notes: [
      {
        title: "Projects lead, and Experience is absent rather than empty",
        body: "A section with nothing under it advertises the gap. Leaving it out and leading with evidence does not — and the builder reorders the steps this way when you say you have no experience yet.",
      },
      {
        title: "Coursework and competitions are quantified like jobs",
        body: "“Placed 12th of 340 teams” is a number, and numbers are what most first resumes lack. The hackathon that did not win still had a scale.",
      },
      {
        title: "It is one page and does not pad",
        body: "A short honest resume beats a long one stretched with “Microsoft Word” and “hard-working team player”. There is nothing here that a reader would skip.",
      },
      {
        title: "The teaching-assistant work counts",
        body: "Paid or not, it is a role with a scope, a duration and an outcome — which is the definition the Experience section actually uses.",
      },
    ],
    resume: exampleResume({
      slug: "graduate-no-experience",
      contact: contact({
        fullName: "Rohan Bhatt",
        email: "rohan@example.com",
        phone: "+91 20 5555 0184",
        location: "Pune, India",
      }),
      summary:
        "Final-year information technology student. Built and shipped three projects that other people use, and taught first-year programming for two semesters.",
      experience: [],
      education: [
        study({
          id: "gr-edu",
          institution: "College of Engineering Pune",
          credential: "BTech",
          field: "Information Technology",
          location: "Pune, India",
          from: "2022-08",
          to: "2026-05",
          result: "8.7 CGPA",
        }),
      ],
      skillGroups: [
        skills("gr-sk-1", "Languages", ["Java", "Python", "JavaScript", "SQL"]),
        skills("gr-sk-2", "Tools", ["React", "PostgreSQL", "Git", "Linux"]),
      ],
      projects: [
        project({
          id: "gr-p1",
          name: "Campus Placement Portal",
          role: "Team Lead",
          from: "2024-01",
          to: "2024-05",
          bullets: [
            "Built a placement portal used by 900 students across 14 departments in its first semester.",
            "Cut shortlisting time from three days to under an hour by automating eligibility filtering.",
          ],
        }),
        project({
          id: "gr-p2",
          name: "Teaching Assistant, Programming Fundamentals",
          role: "Department of IT",
          from: "2024-08",
          to: "2025-04",
          bullets: [
            "Ran weekly lab sessions for 60 first-year students across two semesters and marked 340 submissions.",
            "Wrote the debugging guide the department now issues to all 240 incoming students each year.",
          ],
        }),
        project({
          id: "gr-p3",
          name: "Inter-college Hackathon",
          role: "Backend",
          from: "2025-02",
          to: "2025-02",
          bullets: [
            "Placed 12th of 340 teams in 36 hours with a transit-delay predictor built on open GTFS feeds.",
          ],
        }),
      ],
      settings: { headerStyle: "centered", headingStyle: "accent-bar" },
    }),
  },

  /* --------------------------------------------------------------------- */
  /* Added in §10.4b — the roles the first eight left out entirely.         */
  /*                                                                        */
  /* The original set skewed professional and technical, which is not where */
  /* the search demand is: "customer service resume example" and            */
  /* "administrative assistant resume example" are asked far more often     */
  /* than any of the eight above, and were answered here by nothing. Each   */
  /* of these is a long-tail landing page for one query, and each is held   */
  /* to the same bar by `examples.test.ts` — a valid document, no lint       */
  /* finding above `info`, and every bullet satisfying the bullet coach.    */
  /* --------------------------------------------------------------------- */

  {
    slug: "customer-service-representative",
    updated: "2026-09-10",
    role: "Customer Service Representative",
    occupationTitle: "Customer Service Representatives",
    field: "Operations",
    summary:
      "Support work written with the volume and the outcome together, so the scale of it is readable.",
    notes: [
      {
        title: "Volume is what makes support work legible",
        body: "“Handled customer enquiries” could be four a day or four hundred. “Resolved 60–80 contacts a day” tells a hiring manager what kind of operation you came from, which is the first thing they want to know.",
      },
      {
        title: "The metrics are the ones the team already tracked",
        body: "CSAT, first-contact resolution, average handle time. Naming the measure your employer used is stronger than inventing a percentage, and you can be asked about it without difficulty.",
      },
      {
        title: "One bullet is about the process, not the queue",
        body: "Every support resume lists tickets closed. The macro rewrite is what separates somebody who worked the queue from somebody who improved it.",
      },
    ],
    resume: exampleResume({
      slug: "customer-service-representative",
      contact: contact({
        fullName: "Marcus Bell",
        email: "marcus.bell@example.com",
        phone: "(216) 555-0148",
        location: "Cleveland, OH",
      }),
      summary:
        "Support specialist with five years in high-volume retail and SaaS queues. Most recently raised first-contact resolution from 61% to 78% while handling 70 contacts a day.",
      experience: [
        role({
          id: "csr-1",
          title: "Senior Customer Service Representative",
          organization: "Harborline Retail",
          location: "Cleveland, OH",
          from: "2022-02",
          bullets: [
            "Resolved 60 to 80 contacts a day across chat, email and phone while holding CSAT at 4.7 out of 5.",
            "Raised first-contact resolution from 61% to 78% by rewriting the 40 most-used response macros.",
            "Cut average handle time from 9 minutes to 6 by building a decision tree for the top 12 refund cases.",
            "Trained 9 seasonal hires who reached full queue volume in 2 weeks instead of the usual 4.",
          ],
        }),
        role({
          id: "csr-2",
          title: "Customer Support Associate",
          organization: "Rivertown Outfitters",
          location: "Akron, OH",
          from: "2020-06",
          to: "2022-01",
          bullets: [
            "Cleared a 1,400-ticket backlog in 6 weeks by triaging on refund value rather than on arrival order.",
            "Reduced repeat contacts on shipping questions 35% by rewriting the tracking email with the carrier link first.",
          ],
        }),
      ],
      education: [
        study({
          id: "csr-edu",
          institution: "Cuyahoga Community College",
          credential: "Associate of Applied Business",
          field: "Business Administration",
          location: "Cleveland, OH",
          from: "2018-08",
          to: "2020-05",
          result: "3.6 GPA",
        }),
      ],
      skillGroups: [
        skills("csr-sk-1", "Support platforms", [
          "Zendesk",
          "Salesforce Service Cloud",
          "Intercom",
        ]),
        skills("csr-sk-2", "Strengths", [
          "De-escalation",
          "Written communication",
          "Refund and returns policy",
          "Spanish (conversational)",
        ]),
      ],
    }),
  },

  {
    slug: "administrative-assistant",
    updated: "2026-09-10",
    role: "Administrative Assistant",
    occupationTitle: "Secretaries and Administrative Assistants",
    field: "Operations",
    summary:
      "Coordination work written as outcomes rather than as a list of duties, which is the hard part of this one.",
    notes: [
      {
        title: "This is the role most often written as a job description",
        body: "“Responsible for scheduling, filing and correspondence” describes the post, not the person in it. Every bullet here names something that changed because this person was doing the job.",
      },
      {
        title: "Money and hours are the two units available",
        body: "Administrative work rarely has a revenue number attached, so the honest measures are time saved and cost avoided. Both are countable, and both survive being asked about.",
      },
      {
        title: "The software list is short on purpose",
        body: "Listing every Microsoft product is a keyword dump. Four tools you actually run day to day reads as competence; fifteen reads as padding.",
      },
    ],
    resume: exampleResume({
      slug: "administrative-assistant",
      contact: contact({
        fullName: "Priya Raghunathan",
        email: "priya.r@example.com",
        phone: "+44 161 496 0113",
        location: "Manchester, UK",
      }),
      summary:
        "Administrative professional supporting a 40-person office and three directors. Most recently cut the monthly expense close from 5 days to 2 by moving receipts off paper.",
      experience: [
        role({
          id: "aa-1",
          title: "Executive Assistant",
          organization: "Calder & Wren",
          location: "Manchester, UK",
          from: "2021-09",
          bullets: [
            "Managed calendars for 3 directors, protecting 6 hours of focus time each a week by batching internal meetings.",
            "Cut the monthly expense close from 5 days to 2 by replacing paper receipts with a phone-capture workflow.",
            "Saved £14,000 a year on travel by moving 60% of bookings to a negotiated corporate rate.",
            "Onboarded 22 new starters, reducing first-week IT tickets from 4 per person to under 1.",
          ],
        }),
        role({
          id: "aa-2",
          title: "Office Administrator",
          organization: "Pendle Surveying",
          location: "Bolton, UK",
          from: "2019-03",
          to: "2021-08",
          bullets: [
            "Reorganised 9 years of project files into a searchable index, cutting document retrieval from 20 minutes to 2.",
            "Reduced stationery and print spend 28% by consolidating orders to one supplier and a monthly cycle.",
          ],
        }),
      ],
      education: [
        study({
          id: "aa-edu",
          institution: "Manchester Metropolitan University",
          credential: "BA (Hons)",
          field: "Business Management",
          location: "Manchester, UK",
          from: "2015-09",
          to: "2018-06",
          result: "2:1",
        }),
      ],
      skillGroups: [
        skills("aa-sk-1", "Systems", ["Microsoft 365", "Concur", "Xero", "SharePoint"]),
        skills("aa-sk-2", "Strengths", [
          "Diary management",
          "Minute taking",
          "Supplier negotiation",
          "Onboarding coordination",
        ]),
      ],
    }),
  },

  {
    slug: "marketing-manager",
    updated: "2026-09-10",
    role: "Marketing Manager",
    occupationTitle: "Marketing Managers",
    field: "Marketing",
    summary:
      "Campaign work with the spend beside the result, because one without the other means nothing.",
    notes: [
      {
        title: "A result without its spend is not a result",
        body: "“Grew signups 40%” is unreadable on its own — on what budget, from what base? Naming both is what turns a claim into evidence, and it is what a marketing director will ask first.",
      },
      {
        title: "Channels are named, not implied",
        body: "“Multi-channel campaigns” tells a reader nothing. Paid search, lifecycle email and partnerships are three different jobs, and the resume should say which of them this person actually did.",
      },
      {
        title: "One bullet is about something that was stopped",
        body: "Killing a channel that was not paying back is a marketing decision, and a rarer one to be able to point at than another launch.",
      },
    ],
    resume: exampleResume({
      slug: "marketing-manager",
      contact: contact({
        fullName: "Elena Vasquez",
        email: "elena.vasquez@example.com",
        phone: "(512) 555-0197",
        location: "Austin, TX",
      }),
      summary:
        "Growth marketer running acquisition and lifecycle for a $9M ARR B2B product. Most recently cut blended cost per acquisition from $310 to $185 while doubling monthly signups.",
      experience: [
        role({
          id: "mm-1",
          title: "Marketing Manager",
          organization: "Fernbrook Software",
          location: "Austin, TX",
          from: "2022-05",
          bullets: [
            "Cut blended cost per acquisition from $310 to $185 on a $70,000 monthly budget by shifting spend from display to paid search.",
            "Doubled monthly trial signups from 900 to 1,850 in 3 quarters without increasing total spend.",
            "Raised trial-to-paid conversion from 9% to 14% by rebuilding the 6-email onboarding sequence around one action.",
            "Ended a $12,000-a-month sponsorship channel after a 4-month holdout test showed no measurable lift.",
          ],
        }),
        role({
          id: "mm-2",
          title: "Demand Generation Specialist",
          organization: "Kestrel Analytics",
          location: "Austin, TX",
          from: "2019-08",
          to: "2022-04",
          bullets: [
            "Grew organic sessions from 22,000 to 61,000 a month by publishing 40 pages targeted at one query each.",
            "Built the first attribution model in the company, which reallocated 30% of budget away from two channels.",
          ],
        }),
      ],
      education: [
        study({
          id: "mm-edu",
          institution: "University of Texas at Austin",
          credential: "BS",
          field: "Marketing",
          location: "Austin, TX",
          from: "2015-08",
          to: "2019-05",
          result: "3.7 GPA",
        }),
      ],
      skillGroups: [
        skills("mm-sk-1", "Channels", ["Paid search", "Lifecycle email", "SEO", "Partnerships"]),
        skills("mm-sk-2", "Tools", ["HubSpot", "Google Ads", "GA4", "Looker", "SQL"]),
      ],
    }),
  },

  {
    slug: "human-resources-manager",
    updated: "2026-09-10",
    role: "Human Resources Manager",
    occupationTitle: "Human Resources Managers",
    field: "Operations",
    summary:
      "People work quantified without reducing anybody to a number, which is the line this one walks.",
    notes: [
      {
        title: "Retention and time-to-hire are the two honest metrics",
        body: "Both are measured by the business already, both are affected by what HR does, and neither requires claiming credit for something a manager did. That is a narrow enough set to be believable.",
      },
      {
        title: "The compliance bullet names the framework",
        body: "“Ensured compliance” is unverifiable. Naming the regulation and the audit outcome is a fact somebody can check with a reference call.",
      },
      {
        title: "No bullet claims to have improved culture",
        body: "It is the most common line on an HR resume and the least checkable. What is here instead is the participation rate and what changed as a result of it.",
      },
    ],
    resume: exampleResume({
      slug: "human-resources-manager",
      contact: contact({
        fullName: "Daniel Okonkwo",
        email: "d.okonkwo@example.com",
        phone: "(404) 555-0172",
        location: "Atlanta, GA",
      }),
      summary:
        "HR manager for a 320-person manufacturer across three sites. Most recently cut first-year turnover from 34% to 19% by rebuilding the first 90 days.",
      experience: [
        role({
          id: "hrm-1",
          title: "Human Resources Manager",
          organization: "Ridgeway Manufacturing",
          location: "Atlanta, GA",
          from: "2021-03",
          bullets: [
            "Cut first-year turnover from 34% to 19% across 320 staff by restructuring the first 90 days around a named buddy and two check-ins.",
            "Reduced time-to-hire for skilled trades from 58 days to 31 by pre-screening against 4 must-have criteria instead of 11.",
            "Passed a Department of Labor wage-and-hour audit with zero findings after correcting 140 misclassified timesheets.",
            "Raised benefits enrollment from 62% to 88% by running 6 on-shift sessions instead of one email.",
          ],
        }),
        role({
          id: "hrm-2",
          title: "HR Generalist",
          organization: "Peachtree Logistics",
          location: "Marietta, GA",
          from: "2018-01",
          to: "2021-02",
          bullets: [
            "Closed 45 employee relations cases a year with only 3 escalations, documenting every one to a single standard.",
            "Cut payroll correction volume 40% by moving 180 hourly staff onto a single timekeeping system.",
          ],
        }),
      ],
      education: [
        study({
          id: "hrm-edu",
          institution: "Georgia State University",
          credential: "BBA",
          field: "Human Resource Management",
          location: "Atlanta, GA",
          from: "2013-08",
          to: "2017-12",
          result: "3.5 GPA",
        }),
      ],
      skillGroups: [
        skills("hrm-sk-1", "Systems", ["Workday", "ADP Workforce Now", "Greenhouse"]),
        skills("hrm-sk-2", "Areas", [
          "Employee relations",
          "FLSA compliance",
          "Benefits administration",
          "Compensation banding",
        ]),
      ],
    }),
  },

  {
    slug: "financial-analyst",
    updated: "2026-09-10",
    role: "Financial Analyst",
    occupationTitle: "Financial and Investment Analysts",
    field: "Finance",
    summary:
      "Analysis written so the decision it informed is visible, not just the model that produced it.",
    notes: [
      {
        title: "The model is not the achievement; what it changed is",
        body: "“Built a three-statement model” is a task. “Which showed the acquisition was 20% overpriced, and it was renegotiated” is the reason anybody wanted the model.",
      },
      {
        title: "Accuracy is quoted as variance, because that is how it is measured",
        body: "Forecast quality has a standard unit. Using it signals that this person has been held to it, which a general claim about accuracy does not.",
      },
      {
        title: "The certification is in the document, not implied",
        body: "CFA progress is a fact with a date. Leaving it to be inferred from the skills list wastes the strongest single line on a junior finance resume.",
      },
    ],
    resume: exampleResume({
      slug: "financial-analyst",
      contact: contact({
        fullName: "Hannah Lindqvist",
        email: "h.lindqvist@example.com",
        phone: "+46 8 555 0134",
        location: "Stockholm, Sweden",
      }),
      summary:
        "FP&A analyst supporting a €240M revenue distribution business. Most recently brought quarterly forecast variance from 11% to under 4%.",
      experience: [
        role({
          id: "fa-1",
          title: "Senior Financial Analyst",
          organization: "Nordvik Distribution",
          location: "Stockholm, Sweden",
          from: "2022-01",
          bullets: [
            "Brought quarterly revenue forecast variance from 11% to 3.8% by rebuilding the model around 5 demand drivers.",
            "Identified €1.9M of annual margin leakage in freight recharges, of which €1.4M was recovered in the following year.",
            "Cut the monthly reporting cycle from 9 days to 4 by automating 14 manual reconciliations in SQL.",
            "Modelled a €30M acquisition that closed 18% below the opening ask after the synergy case was re-based.",
          ],
        }),
        role({
          id: "fa-2",
          title: "Financial Analyst",
          organization: "Bergstrom Retail Group",
          location: "Gothenburg, Sweden",
          from: "2019-09",
          to: "2021-12",
          bullets: [
            "Produced the weekly trading pack for 62 stores, cutting its preparation time from 2 days to 4 hours.",
            "Built a store-level contribution model that led to 3 closures and a €700,000 improvement in operating profit.",
          ],
        }),
      ],
      education: [
        study({
          id: "fa-edu",
          institution: "Stockholm School of Economics",
          credential: "MSc",
          field: "Finance",
          location: "Stockholm, Sweden",
          from: "2017-08",
          to: "2019-06",
          result: "Distinction",
        }),
      ],
      skillGroups: [
        skills("fa-sk-1", "Analysis", [
          "Three-statement modelling",
          "Variance analysis",
          "Valuation",
        ]),
        skills("fa-sk-2", "Tools", ["Excel", "SQL", "Power BI", "SAP", "Anaplan"]),
      ],
    }),
  },

  {
    slug: "mechanical-engineer",
    updated: "2026-09-10",
    role: "Mechanical Engineer",
    occupationTitle: "Mechanical Engineers",
    field: "Engineering",
    summary:
      "Design work written with the constraint it was solved under, which is what engineering judgement looks like on paper.",
    notes: [
      {
        title: "A constraint makes a result meaningful",
        body: "“Reduced weight 18%” is good. “Reduced weight 18% while holding the same fatigue life” is engineering, and it is the version a hiring engineer can evaluate.",
      },
      {
        title: "Standards are named",
        body: "ASME, ISO and the specific test regime are the vocabulary of the field. Naming them is not keyword stuffing when the work was genuinely done to them.",
      },
      {
        title: "The tool list separates CAD from analysis",
        body: "Drawing a part and predicting how it fails are different competences. A single row containing both invites the wrong assumption in either direction.",
      },
    ],
    resume: exampleResume({
      slug: "mechanical-engineer",
      contact: contact({
        fullName: "Tomás Ferreira",
        email: "t.ferreira@example.com",
        phone: "+351 21 555 0166",
        location: "Lisbon, Portugal",
      }),
      summary:
        "Mechanical design engineer working on rotating equipment for industrial pumps. Most recently took 18% out of an impeller assembly's mass without changing its fatigue life.",
      experience: [
        role({
          id: "me-1",
          title: "Mechanical Design Engineer",
          organization: "Almada Fluid Systems",
          location: "Lisbon, Portugal",
          from: "2021-06",
          bullets: [
            "Reduced impeller assembly mass 18% while holding the same rated fatigue life, verified by 2 million-cycle rig testing.",
            "Cut warranty returns on a pump seal from 4.2% to 0.9% by re-specifying the elastomer and the groove tolerance.",
            "Took 6 weeks out of a 20-week development cycle by replacing 3 physical prototypes with validated CFD runs.",
            "Released 40 drawings to ASME Y14.5 with zero rework requests from the machine shop over 2 years.",
          ],
        }),
        role({
          id: "me-2",
          title: "Graduate Mechanical Engineer",
          organization: "Setúbal Heavy Engineering",
          location: "Setúbal, Portugal",
          from: "2019-09",
          to: "2021-05",
          bullets: [
            "Investigated 11 field failures of a gearbox housing and traced 8 of them to a single casting porosity defect.",
            "Redesigned a lifting fixture that cut assembly line changeover from 45 minutes to 12.",
          ],
        }),
      ],
      education: [
        study({
          id: "me-edu",
          institution: "Instituto Superior Técnico",
          credential: "MEng",
          field: "Mechanical Engineering",
          location: "Lisbon, Portugal",
          from: "2014-09",
          to: "2019-07",
          result: "17/20",
        }),
      ],
      skillGroups: [
        skills("me-sk-1", "Design", [
          "SolidWorks",
          "GD&T to ASME Y14.5",
          "Sheet metal",
          "Casting design",
        ]),
        skills("me-sk-2", "Analysis", ["ANSYS Mechanical", "Fatigue analysis", "CFD", "MATLAB"]),
      ],
    }),
  },

  {
    slug: "graphic-designer",
    updated: "2026-09-10",
    role: "Graphic Designer",
    occupationTitle: "Graphic Designers",
    field: "Creative",
    summary:
      "A creative resume that stays single-column and plain, because the portfolio is where the design goes.",
    notes: [
      {
        title: "The resume is not the portfolio",
        body: "A two-column resume with a colour block and an icon set is the one place a designer's craft actively works against them: it is the document that has to survive a parser. The work lives at the link.",
      },
      {
        title: "Design work has numbers too",
        body: "Turnaround, asset volume, conversion on a redesigned page. Naming them separates a designer who ships from one who presents.",
      },
      {
        title: "The system bullet is the senior one",
        body: "Anyone can produce assets. Building the component library that let six other people produce them consistently is the thing a design lead is hiring for.",
      },
    ],
    resume: exampleResume({
      slug: "graphic-designer",
      contact: contact({
        fullName: "Ines Delacroix",
        email: "ines.delacroix@example.com",
        phone: "+33 4 55 50 01 22",
        location: "Lyon, France",
      }),
      summary:
        "Brand and product designer working across print and digital for consumer retail. Most recently built a component library that cut campaign asset turnaround from 6 days to 2.",
      experience: [
        role({
          id: "gd-1",
          title: "Senior Graphic Designer",
          organization: "Maison Verrier",
          location: "Lyon, France",
          from: "2021-11",
          bullets: [
            "Cut campaign asset turnaround from 6 days to 2 by building a 40-component library the whole team works from.",
            "Redesigned the product page template, raising add-to-basket rate from 3.1% to 4.4% across 900 listings.",
            "Produced 3 seasonal campaigns a year spanning 120 assets each, delivered on schedule for 8 consecutive quarters.",
            "Reduced print production cost 22% by consolidating 14 packaging sizes down to 6.",
          ],
        }),
        role({
          id: "gd-2",
          title: "Graphic Designer",
          organization: "Atelier Rive",
          location: "Grenoble, France",
          from: "2019-02",
          to: "2021-10",
          bullets: [
            "Delivered brand identities for 9 small businesses, 7 of which are still using the system unchanged.",
            "Cut studio revision rounds from an average of 5 to 2 by presenting 3 defined directions instead of 8 variations.",
          ],
        }),
      ],
      education: [
        study({
          id: "gd-edu",
          institution: "École Émile Cohl",
          credential: "Diplôme",
          field: "Graphic Design",
          location: "Lyon, France",
          from: "2015-09",
          to: "2018-06",
          result: "Mention bien",
        }),
      ],
      skillGroups: [
        skills("gd-sk-1", "Tools", [
          "Figma",
          "Illustrator",
          "InDesign",
          "Photoshop",
          "After Effects",
        ]),
        skills("gd-sk-2", "Practice", [
          "Design systems",
          "Typography",
          "Print production",
          "Packaging",
        ]),
      ],
    }),
  },

  {
    slug: "retail-store-manager",
    updated: "2026-09-10",
    role: "Retail Store Manager",
    occupationTitle: "First-Line Supervisors of Retail Sales Workers",
    field: "Operations",
    summary:
      "Store management written as a P&L, because that is what the role is once you are running one.",
    notes: [
      {
        title: "A store is a small business, and the resume should read like it",
        body: "Sales, margin, shrink, labour cost and staff retention are the five numbers a district manager looks at. A resume that names them is speaking the language of the job being applied for.",
      },
      {
        title: "Comparable growth, not raw sales",
        body: "“Grew sales 12%” could be a new store opening into empty demand. “12% comparable growth against a district average of 4%” is a claim about this manager rather than about the market.",
      },
      {
        title: "Staff turnover is the bullet most managers leave out",
        body: "It is the number that most predicts whether the next store will run well, and it is entirely within a store manager's control.",
      },
    ],
    resume: exampleResume({
      slug: "retail-store-manager",
      contact: contact({
        fullName: "Grace Mwangi",
        email: "grace.mwangi@example.com",
        phone: "+61 3 5550 0184",
        location: "Melbourne, Australia",
      }),
      summary:
        "Store manager running a A$4.2M homewares site with 26 staff. Most recently delivered 12% comparable sales growth against a district average of 4%.",
      experience: [
        role({
          id: "rsm-1",
          title: "Store Manager",
          organization: "Kingsley Home",
          location: "Melbourne, Australia",
          from: "2021-07",
          bullets: [
            "Delivered 12% comparable sales growth on a A$4.2M site against a district average of 4%.",
            "Cut stock shrink from 1.8% to 0.7% of sales by moving high-value lines behind a single counted checkpoint.",
            "Reduced staff turnover from 48% to 21% across 26 employees by fixing the roster 3 weeks ahead.",
            "Held labour cost at 9.4% of sales through a 30% December volume increase by rostering to hourly footfall.",
          ],
        }),
        role({
          id: "rsm-2",
          title: "Assistant Store Manager",
          organization: "Barwon Living",
          location: "Geelong, Australia",
          from: "2018-10",
          to: "2021-06",
          bullets: [
            "Ran the click-and-collect launch, taking it from 0 to 18% of store revenue in 14 months.",
            "Improved mystery-shop scores from 71 to 92 by coaching 4 supervisors on a single opening script.",
          ],
        }),
      ],
      education: [
        study({
          id: "rsm-edu",
          institution: "RMIT University",
          credential: "Diploma",
          field: "Retail Management",
          location: "Melbourne, Australia",
          from: "2016-02",
          to: "2018-06",
          result: "Credit average",
        }),
      ],
      skillGroups: [
        skills("rsm-sk-1", "Operations", [
          "P&L management",
          "Rostering and labour cost",
          "Inventory and shrink control",
          "Visual merchandising",
        ]),
        skills("rsm-sk-2", "Systems", ["Retail Express", "Deputy", "Excel"]),
      ],
    }),
  },

  /* --------------------------------------------------------------------- */
  /* Written for applications in India (ROADMAP Phase 3, 2026-09-29).       */
  /*                                                                        */
  /* The first India batch: the searches with the most demand and the least */
  /* useful answers — a fresher engineer, a commerce graduate, an MBA       */
  /* fresher and a BPO support executive. Each follows the conventions an   */
  /* Indian recruiter expects (CGPA or percentage on the degree line,       */
  /* amounts in lakh, A4) and says so, and each note says what to change    */
  /* for an application abroad. Held to the same bar as every example.      */
  /* --------------------------------------------------------------------- */

  {
    slug: "software-engineer-fresher",
    updated: "2026-09-29",
    market: "IN",
    role: "Software Engineer (Fresher)",
    occupationTitle: "Software Developers",
    field: "Early career",
    summary:
      "A final-year engineering student with one internship and two projects people use — the most common first resume in India, written to be read.",
    notes: [
      {
        title: "One internship is enough to lead with",
        body: "Two months at a payments start-up, with a failure rate it moved and tests that caught real bugs, says more than a list of courses. It goes first because it is the closest thing to the job.",
      },
      {
        title: "CGPA is on the degree line, once",
        body: "Campus recruiters often filter on 10th and 12th marks too. If a company's form asks for them, add one line under education; otherwise the degree result is the one that matters, and repeating school marks spends a line on the least recent thing you have done.",
      },
      {
        title: "No photo, date of birth or declaration",
        body: "Most private employers in India no longer expect them, and none of them says anything about the work. Government and PSU applications that want a declaration or a date of birth ask for it on their own form — fill it there.",
      },
      {
        title: "Projects carry users and numbers",
        body: "“Used by 1,200 residents” and “national finals” are scale. A project described only by its tech stack reads as a tutorial followed to the end.",
      },
    ],
    resume: exampleResume({
      slug: "software-engineer-fresher",
      contact: contact({
        fullName: "Ananya Iyer",
        email: "ananya@example.com",
        phone: "+91 80 5555 0142",
        location: "Bengaluru, India",
      }),
      summary:
        "Final-year BTech computer science student with a backend internship at a payments start-up and two deployed projects. Looking for a first software engineering role on a product team.",
      experience: [
        role({
          id: "sef-r1",
          title: "Software Engineering Intern",
          organization: "Finvo Payments",
          location: "Bengaluru, India",
          from: "2025-05",
          to: "2025-07",
          bullets: [
            "Cut failed UPI payout retries from 4.1% to 0.6% by adding idempotency keys to the settlement service.",
            "Wrote 38 integration tests with Jest that caught two reconciliation bugs before the August release.",
          ],
        }),
      ],
      education: [
        study({
          id: "sef-edu",
          institution: "Nandi Institute of Technology",
          credential: "BTech",
          field: "Computer Science and Engineering",
          location: "Bengaluru, India",
          from: "2022-08",
          to: "2026-05",
          result: "8.4 CGPA",
        }),
      ],
      skillGroups: [
        skills("sef-sk-1", "Languages", ["Java", "Python", "JavaScript", "SQL"]),
        skills("sef-sk-2", "Tools", ["Spring Boot", "React", "PostgreSQL", "Git", "Docker"]),
      ],
      projects: [
        project({
          id: "sef-p1",
          name: "Hostel Mess Feedback App",
          role: "Solo developer",
          from: "2024-08",
          to: "2024-11",
          bullets: [
            "Built a feedback app with React Native and Firebase used by 1,200 residents across four hostels, raising weekly responses from 40 to 310.",
          ],
        }),
        project({
          id: "sef-p2",
          name: "Smart India Hackathon",
          role: "Machine learning",
          from: "2024-12",
          to: "2024-12",
          bullets: [
            "Reached the national finals with a crop-disease classifier trained on 18,000 labelled leaf images.",
          ],
        }),
      ],
      settings: { headerStyle: "centered", headingStyle: "accent-bar" },
    }),
  },

  {
    slug: "bcom-fresher",
    updated: "2026-09-29",
    market: "IN",
    role: "B.Com Fresher",
    occupationTitle: "Bookkeeping, Accounting, and Auditing Clerks",
    field: "Early career",
    summary:
      "A commerce graduate's first resume, built on a six-month internship at a CA firm — GST returns, reconciliations and month-end work, each with a number.",
    notes: [
      {
        title: "The internship reads like a job, because it was one",
        body: "Twenty-two clients' GST returns filed on time is a workload, and it is written as one. An internship described as “assisted with accounts” would say nothing an employer can use.",
      },
      {
        title: "Tally and GST are in the bullets, not only the skills list",
        body: "A skills line is a claim; a bullet that files returns in Tally Prime is evidence. The keyword scanner here marks exactly that difference — “demonstrated” against “listed only”.",
      },
      {
        title: "Use the result your university issues",
        body: "Percentage or CGPA, whichever is on your marksheet, stated once on the degree line. Converting one into the other invites a question you do not need.",
      },
      {
        title: "Amounts in lakh are right for an Indian employer",
        body: "“₹4.2 lakh” is how a finance team here talks. For an application abroad, write the same figure in thousands in the local currency, or drop the amount and keep the count.",
      },
    ],
    resume: exampleResume({
      slug: "bcom-fresher",
      contact: contact({
        fullName: "Karan Mehta",
        email: "karan@example.com",
        phone: "+91 22 5555 0197",
        location: "Mumbai, India",
      }),
      summary:
        "Commerce graduate with a six-month internship at a chartered accountancy firm, preparing GST returns and bank reconciliations for small businesses. Works in Tally Prime and Excel every day.",
      experience: [
        role({
          id: "bcf-r1",
          title: "Accounts Intern",
          organization: "Shah & Rao Associates",
          location: "Mumbai, India",
          from: "2025-06",
          to: "2025-12",
          bullets: [
            "Prepared monthly GST returns for 22 small-business clients with Tally Prime, filing every return before the 20th.",
            "Reconciled 14 months of bank statements for a textile trader by matching 3,100 entries, clearing a ₹4.2 lakh difference.",
            "Cut month-end closing for three retail clients from nine days to five by building an accruals template in Excel.",
          ],
        }),
      ],
      education: [
        study({
          id: "bcf-edu",
          institution: "Ghatkopar College of Commerce",
          credential: "BCom",
          field: "Accounting and Finance",
          location: "Mumbai, India",
          from: "2022-06",
          to: "2025-05",
          result: "72%",
        }),
      ],
      skillGroups: [
        skills("bcf-sk-1", "Accounting", [
          "GST returns",
          "TDS",
          "Bank reconciliation",
          "Accounts payable",
        ]),
        skills("bcf-sk-2", "Tools", ["Tally Prime", "Excel (pivot tables, XLOOKUP)", "Zoho Books"]),
      ],
      settings: { fontPair: "classic", headingStyle: "rule" },
    }),
  },

  {
    slug: "mba-fresher",
    updated: "2026-09-29",
    market: "IN",
    role: "MBA Fresher",
    occupationTitle: "Sales Managers",
    field: "Early career",
    summary:
      "An MBA graduate with two years of bank operations before business school and a rural-sales internship — the pre-MBA work is the strongest thing on the page.",
    notes: [
      {
        title: "Pre-MBA work goes in Experience, with numbers",
        body: "Two years of cutting account-opening time at a bank is real management evidence. Freshers with work before their MBA often bury it under the degree; it belongs where a recruiter looks for work.",
      },
      {
        title: "The internship is described by what changed",
        body: "Mapping 180 outlets and lifting a pilot cluster's orders by 23% is a result a sales head can picture. “Worked on a rural distribution project” is not.",
      },
      {
        title: "Two degrees, one page",
        body: "The MBA and the undergraduate degree each get one line with a result. Specialisation goes in brackets rather than a separate section.",
      },
      {
        title: "The target role is in the summary, once",
        body: "“Brand or sales-management trainee” tells a campus recruiter which shortlist to put this on. Saying it once is enough; a cover letter can say why.",
      },
    ],
    resume: exampleResume({
      slug: "mba-fresher",
      contact: contact({
        fullName: "Sneha Kulkarni",
        email: "sneha@example.com",
        phone: "+91 20 5555 0163",
        location: "Pune, India",
      }),
      summary:
        "MBA (Marketing) graduate with two years in a co-operative bank's branch operations and a summer internship in consumer-goods rural sales. Looking for a brand or sales-management trainee role.",
      experience: [
        role({
          id: "mbf-r1",
          title: "Summer Intern, Rural Sales",
          organization: "Sundar Consumer Products",
          location: "Nashik, India",
          from: "2024-04",
          to: "2024-06",
          bullets: [
            "Mapped 180 retail outlets across 11 villages with a field survey, finding 46 that stocked no company product.",
            "Lifted weekly orders from the pilot cluster by 23% in six weeks by bundling slow-moving SKUs with the two best sellers.",
          ],
        }),
        role({
          id: "mbf-r2",
          title: "Operations Officer",
          organization: "Deccan Co-operative Bank",
          location: "Pune, India",
          from: "2021-07",
          to: "2023-05",
          bullets: [
            "Reduced account-opening turnaround from five days to two by moving KYC checks to the branch counter.",
            "Trained 9 new joiners on the core banking system with a checklist the region later adopted for 30 branches.",
          ],
        }),
      ],
      education: [
        study({
          id: "mbf-edu-1",
          institution: "Pune Institute of Management Studies",
          credential: "MBA",
          field: "Marketing",
          location: "Pune, India",
          from: "2023-06",
          to: "2025-04",
          result: "7.9 CGPA",
        }),
        study({
          id: "mbf-edu-2",
          institution: "Fergusson Valley College",
          credential: "BBA",
          location: "Pune, India",
          from: "2018-06",
          to: "2021-05",
          result: "74%",
        }),
      ],
      skillGroups: [
        skills("mbf-sk-1", "Marketing and sales", [
          "Market research",
          "Distribution planning",
          "Trade promotions",
        ]),
        skills("mbf-sk-2", "Tools", ["Excel", "Power BI"]),
        skills("mbf-sk-3", "Languages", ["English", "Marathi", "Hindi"]),
      ],
    }),
  },

  {
    slug: "bpo-customer-support",
    updated: "2026-09-29",
    market: "IN",
    role: "BPO Customer Support Executive",
    occupationTitle: "Customer Service Representatives",
    field: "Operations",
    summary:
      "Three years on an international voice process, a promotion, and the metrics that decide every BPO shortlist — quality score, handle time, first-call resolution.",
    notes: [
      {
        title: "Metrics are the job, so they are the bullets",
        body: "Quality score, average handle time and first-call resolution are what a team leader is measured on and what an operations manager scans for. Each bullet here carries one.",
      },
      {
        title: "Process and shift are stated plainly",
        body: "“International voice process” and night-shift availability are real filters in BPO hiring. Saying them in the summary saves a recruiter a phone call to ask.",
      },
      {
        title: "The promotion shows as two roles at one employer",
        body: "Executive, then senior executive, each with its own dates. A single entry would hide the step up, which is the most persuasive fact on the page.",
      },
      {
        title: "Languages are listed as languages",
        body: "English, Hindi and Urdu, in their own group. For support roles they are skills an employer pays for, not a personal detail.",
      },
    ],
    resume: exampleResume({
      slug: "bpo-customer-support",
      contact: contact({
        fullName: "Imran Shaikh",
        email: "imran@example.com",
        phone: "+91 40 5555 0128",
        location: "Hyderabad, India",
      }),
      summary:
        "Customer support executive with three years on an international voice process for a US telecom client, promoted to senior executive in 2024. Available for night shifts.",
      experience: [
        role({
          id: "bpo-r1",
          title: "Senior Customer Support Executive",
          organization: "Charminar Global Services",
          location: "Hyderabad, India",
          from: "2024-01",
          bullets: [
            "Held a 94% quality score across 1,100 audited calls in 2025 by rewriting the billing queue's call checklist.",
            "Cut average handle time from 7.8 to 6.1 minutes with a shortcut sheet the team of 14 now uses.",
          ],
        }),
        role({
          id: "bpo-r2",
          title: "Customer Support Executive",
          organization: "Charminar Global Services",
          location: "Hyderabad, India",
          from: "2022-06",
          to: "2023-12",
          bullets: [
            "Resolved 62% of billing disputes on the first call by learning the client's refund rules ahead of the training schedule.",
            "Retained 38 customers who asked to cancel in one quarter through plan downgrades rather than credits.",
          ],
        }),
      ],
      education: [
        study({
          id: "bpo-edu",
          institution: "Osmania University",
          credential: "BCom",
          location: "Hyderabad, India",
          from: "2019-06",
          to: "2022-05",
          result: "68%",
        }),
      ],
      skillGroups: [
        skills("bpo-sk-1", "Support", [
          "Voice process",
          "Billing disputes",
          "De-escalation",
          "Retention offers",
        ]),
        skills("bpo-sk-2", "Tools", ["Salesforce Service Cloud", "Zendesk", "Excel"]),
        skills("bpo-sk-3", "Languages", ["English (fluent)", "Hindi", "Urdu"]),
      ],
    }),
  },

  /* --------------------------------------------------------------------- */
  /* Written for applications in the United States (2026-09-29).            */
  /*                                                                        */
  /* The first US batch: hourly and certified roles with enormous search    */
  /* demand and a sea of thin answers. US conventions throughout — Letter,  */
  /* city and state only, the reserved 555-01xx numbers, certifications     */
  /* named with their issuing body or state.                                */
  /* --------------------------------------------------------------------- */

  {
    slug: "cashier",
    updated: "2026-09-29",
    market: "US",
    role: "Cashier",
    occupationTitle: "Cashiers",
    field: "Retail and hospitality",
    summary:
      "A cashier's resume with the numbers a store manager actually checks — drawers, speed, voids — and a promotion to head cashier that the layout makes visible.",
    notes: [
      {
        title: "A cashier's numbers are drawers, speed and voids",
        body: "Balanced drawers, items a minute and mis-scans are what a front-end manager is measured on, so they are what a hiring manager scans for. “Friendly and reliable” is on every other application in the pile.",
      },
      {
        title: "Head cashier is a promotion, so it is its own role",
        body: "Two entries at one store, each with its own dates, show the step up. Folding them together would hide the most persuasive fact on the page.",
      },
      {
        title: "Bilingual is a skill, listed where it can be found",
        body: "Spanish goes in its own line under Languages. Stores that need it search for it, and a sentence in the summary is easier to miss.",
      },
      {
        title: "US conventions: Letter, city and state",
        body: "No street address, photo or date of birth — US employers do not expect them, and many prefer not to see them. The page is Letter-sized, which is what an American printer and ATS assume.",
      },
    ],
    resume: exampleResume({
      slug: "cashier",
      contact: contact({
        fullName: "Maria Delgado",
        email: "maria@example.com",
        phone: "(614) 555-0142",
        location: "Columbus, OH",
      }),
      summary:
        "Cashier with three years at a high-volume grocery store, promoted to head cashier and trusted with opening and closing the front end. Bilingual in English and Spanish.",
      experience: [
        role({
          id: "csh-r1",
          title: "Head Cashier",
          organization: "Fairway Fresh Market",
          location: "Columbus, OH",
          from: "2024-03",
          bullets: [
            "Balanced 9 registers at close with zero variance on 212 of 220 shifts in 2025 by recounting drawers at shift change.",
            "Trained 11 new cashiers on the POS system with a one-page checklist, halving their first-week voids.",
          ],
        }),
        role({
          id: "csh-r2",
          title: "Cashier",
          organization: "Fairway Fresh Market",
          location: "Columbus, OH",
          from: "2023-01",
          to: "2024-02",
          bullets: [
            "Scanned 28 items a minute at peak with mis-scans under 1% on monthly audits.",
            "Raised loyalty-card sign-ups at one register from 12 to 37 a week by offering the card at every checkout.",
          ],
        }),
      ],
      education: [
        study({
          id: "csh-edu",
          institution: "Westland High School",
          credential: "High School Diploma",
          location: "Columbus, OH",
          from: "2018-08",
          to: "2022-05",
        }),
      ],
      skillGroups: [
        skills("csh-sk-1", "Register", [
          "Cash handling",
          "POS systems",
          "Returns and exchanges",
          "Opening and closing",
        ]),
        skills("csh-sk-2", "Languages", ["English", "Spanish"]),
      ],
      settings: { pageSize: "LETTER" },
    }),
  },

  {
    slug: "medical-assistant",
    updated: "2026-09-29",
    market: "US",
    role: "Medical Assistant",
    occupationTitle: "Medical Assistants",
    field: "Healthcare",
    summary:
      "A certified medical assistant two years into a busy family practice — patient volume, lab quality and a referral backlog cleared, with the credential stated first.",
    notes: [
      {
        title: "The certification is named with its body",
        body: "“CMA (AAMA)” and “BLS (American Heart Association)” are what a practice manager checks before anything else. Naming the issuing body answers the next question before it is asked.",
      },
      {
        title: "Patient volume gives the work its scale",
        body: "Thirty patients a day across three providers says what kind of clinic this was. A bullet that only lists duties — rooming, vitals, injections — says what every medical assistant does.",
      },
      {
        title: "The externship is experience",
        body: "It had a supervisor, a scope and a result — 160 venipunctures at 92% first-stick — so it goes under Experience, where it counts, rather than under Education.",
      },
    ],
    resume: exampleResume({
      slug: "medical-assistant",
      contact: contact({
        fullName: "Jasmine Carter",
        email: "jasmine@example.com",
        phone: "(404) 555-0117",
        location: "Atlanta, GA",
      }),
      summary:
        "Certified Medical Assistant (CMA) with two years in a busy family practice, rooming 30 patients a day and handling phlebotomy, vital signs and EHR charting.",
      experience: [
        role({
          id: "mda-r1",
          title: "Medical Assistant",
          organization: "Peachtree Family Medicine",
          location: "Atlanta, GA",
          from: "2024-06",
          bullets: [
            "Roomed 30 patients a day across three providers by preparing charts in athenaOne the evening before.",
            "Cut the clinic's lab redraw rate from 6% to 2% with a tube-labeling check at the draw station.",
            "Scheduled 140 referrals a month through the insurance portal, clearing a three-week backlog in 10 days.",
          ],
        }),
        role({
          id: "mda-r2",
          title: "Medical Assistant Extern",
          organization: "Midtown Community Clinic",
          location: "Atlanta, GA",
          from: "2024-02",
          to: "2024-05",
          bullets: [
            "Performed 160 venipunctures under supervision with a first-stick success rate of 92%.",
          ],
        }),
      ],
      education: [
        study({
          id: "mda-edu",
          institution: "Metro Atlanta Career Institute",
          credential: "Medical Assisting Diploma",
          location: "Atlanta, GA",
          from: "2023-08",
          to: "2024-05",
        }),
      ],
      skillGroups: [
        skills("mda-sk-1", "Certifications", ["CMA (AAMA)", "BLS (American Heart Association)"]),
        skills("mda-sk-2", "Clinical", ["Phlebotomy", "Vital signs", "EKG", "Injections"]),
        skills("mda-sk-3", "Systems", ["athenaOne", "Electronic health records"]),
      ],
      settings: { pageSize: "LETTER" },
    }),
  },

  {
    slug: "warehouse-associate",
    updated: "2026-09-29",
    market: "US",
    role: "Warehouse Associate",
    occupationTitle: "Laborers and Freight, Stock, and Material Movers, Hand",
    field: "Logistics",
    summary:
      "Four years in a distribution center, written the way a warehouse manager reads — pick rate against target, accuracy, and certifications named with the equipment.",
    notes: [
      {
        title: "Rate is the number that matters, so it leads",
        body: "185 units an hour against a target of 150 is the first thing a shift supervisor wants to know. Put it in the first bullet, with the target, so the number means something.",
      },
      {
        title: "Certifications are named with the equipment",
        body: "“Forklift certified” leaves the obvious question open. Sit-down or stand-up reach truck is what decides which job you can do on day one.",
      },
      {
        title: "Safety is shown, not claimed",
        body: "Training eight new hires and adding a scan-to-verify step are safety and quality work with a result. “Safety-conscious” is a claim every applicant makes.",
      },
    ],
    resume: exampleResume({
      slug: "warehouse-associate",
      contact: contact({
        fullName: "Tyler Brooks",
        email: "tyler@example.com",
        phone: "(901) 555-0163",
        location: "Memphis, TN",
      }),
      summary:
        "Warehouse associate with four years in a regional distribution center, certified on sit-down forklifts and stand-up reach trucks. Consistently above rate on picking.",
      experience: [
        role({
          id: "wha-r1",
          title: "Warehouse Associate II",
          organization: "Riverbend Distribution",
          location: "Memphis, TN",
          from: "2023-04",
          bullets: [
            "Picked 185 units an hour against a 150 target through 2025 by batching orders by aisle on the RF scanner.",
            "Cut mis-ships on the pack-out line from 1.2% to 0.3% by adding a scan-to-verify step.",
            "Trained 8 new hires on forklift safety with a walk-through the site now uses for every start.",
          ],
        }),
        role({
          id: "wha-r2",
          title: "Warehouse Associate",
          organization: "Riverbend Distribution",
          location: "Memphis, TN",
          from: "2021-06",
          to: "2023-03",
          bullets: [
            "Unloaded 14 trailers a shift with the dock team, keeping trailer dwell time under 40 minutes.",
          ],
        }),
      ],
      education: [
        study({
          id: "wha-edu",
          institution: "Southside High School",
          credential: "High School Diploma",
          location: "Memphis, TN",
          from: "2017-08",
          to: "2021-05",
        }),
      ],
      skillGroups: [
        skills("wha-sk-1", "Equipment", [
          "Sit-down forklift (certified)",
          "Stand-up reach truck (certified)",
          "RF scanner",
          "Pallet jack",
        ]),
        skills("wha-sk-2", "Safety", ["OSHA 10", "Lockout/tagout"]),
      ],
      settings: { pageSize: "LETTER" },
    }),
  },

  {
    slug: "certified-nursing-assistant",
    updated: "2026-09-29",
    market: "US",
    role: "Certified Nursing Assistant",
    occupationTitle: "Nursing Assistants",
    field: "Healthcare",
    summary:
      "A CNA on a long-term care unit, with resident load, charting quality and a falls reduction — the state certification stated with the state.",
    notes: [
      {
        title: "The certification is stated with the state",
        body: "CNA certification is issued by a state, and a facility checks its own state's registry. “CNA (Michigan)” answers that; “Certified Nursing Assistant” alone does not.",
      },
      {
        title: "Resident load gives the shift its size",
        body: "Twelve residents a shift on a 40-bed unit tells a director of nursing what you are used to. It is the CNA equivalent of a nurse's patient ratio.",
      },
      {
        title: "A short career still gets numbers",
        body: "Under two years in, there is still a falls count, an audit result and an injury rate to point to. Care work is measured; say how.",
      },
    ],
    resume: exampleResume({
      slug: "certified-nursing-assistant",
      contact: contact({
        fullName: "Aaliyah Johnson",
        email: "aaliyah@example.com",
        phone: "(313) 555-0138",
        location: "Detroit, MI",
      }),
      summary:
        "Certified Nursing Assistant on a 40-bed long-term care unit, caring for 12 residents a shift on days. Michigan-certified, with BLS current.",
      experience: [
        role({
          id: "cna-r1",
          title: "Certified Nursing Assistant",
          organization: "Maple Grove Care Center",
          location: "Detroit, MI",
          from: "2024-01",
          bullets: [
            "Cared for 12 residents a shift with bathing, feeding and mobility support, with no pressure injuries on the unit for 14 months.",
            "Charted vital signs for 24 residents twice a shift in PointClickCare with no late entries on quarterly audits.",
            "Reduced day-shift resident falls from five a month to one by adding a bed-alarm check to every round.",
          ],
        }),
      ],
      education: [
        study({
          id: "cna-edu",
          institution: "Detroit Health Careers Institute",
          credential: "Nurse Aide Training Program",
          location: "Detroit, MI",
          from: "2023-09",
          to: "2023-12",
        }),
      ],
      skillGroups: [
        skills("cna-sk-1", "Certifications", ["CNA (Michigan)", "BLS"]),
        skills("cna-sk-2", "Care", [
          "Activities of daily living",
          "Vital signs",
          "Infection control",
          "Dementia care",
        ]),
        skills("cna-sk-3", "Systems", ["PointClickCare"]),
      ],
      settings: { pageSize: "LETTER" },
    }),
  },

  /* --------------------------------------------------------------------- */
  /* Second batch, India and the US (2026-09-30).                           */
  /*                                                                        */
  /* Two experienced Indian roles with heavy portal search — a Java         */
  /* developer three years in and a plant HR executive — and two US roles   */
  /* with large demand: a certified pharmacy technician and a front-desk    */
  /* receptionist. Same bar as every example: lint-clean, the coach         */
  /* answered on every bullet, invented names and numbers.                  */
  /* --------------------------------------------------------------------- */

  {
    slug: "java-developer",
    updated: "2026-09-30",
    market: "IN",
    role: "Java Developer",
    occupationTitle: "Software Developers",
    field: "Technology",
    summary:
      "A Java developer three years into a product career in Pune — Spring Boot services, with the latency, throughput and incident numbers an engineering manager asks about.",
    notes: [
      {
        title: "The stack lives inside the bullets",
        body: "Spring Boot, Kafka and PostgreSQL appear in sentences that say what they did, so the skills list is backed by evidence. A portal search for “Spring Boot” finds the word either way; an interviewer can only ask about the bullet.",
      },
      {
        title: "Numbers an engineering manager recognises",
        body: "Latency, throughput, incidents and test coverage are how backend work is measured. “Worked on microservices” would describe a hundred other profiles in the same search.",
      },
      {
        title: "Notice period and CTC stay on the portal",
        body: "They are filter fields on Naukri and similar sites, and a resume is forwarded far beyond the recruiter who needed them. Fill them in where the portal asks, not on the page.",
      },
      {
        title: "Education shrinks to one line",
        body: "Three years in, the degree and CGPA stay, while school marks and the final-year project make way for the work. A campus resume and an experienced one are different documents.",
      },
    ],
    resume: exampleResume({
      slug: "java-developer",
      contact: contact({
        fullName: "Rohan Kulkarni",
        email: "rohan@example.com",
        phone: "+91 20 5555 0187",
        location: "Pune, India",
      }),
      summary:
        "Java developer with three years on order and payment services for a B2B commerce platform. Builds Spring Boot services on Kafka and PostgreSQL, and is on call for them.",
      experience: [
        role({
          id: "jvd-r1",
          title: "Software Engineer II",
          organization: "Tradewind Commerce",
          location: "Pune, India",
          from: "2024-04",
          bullets: [
            "Cut p95 latency on the order-placement API from 820 ms to 190 ms by replacing per-item database calls with one batched PostgreSQL query.",
            "Rebuilt invoice generation on Kafka consumers, raising throughput from 40 to 300 invoices a minute during month-end peaks.",
            "Reduced production incidents on the payments service from 9 a quarter to 2 by adding contract tests and idempotent retries.",
          ],
        }),
        role({
          id: "jvd-r2",
          title: "Software Engineer",
          organization: "Tradewind Commerce",
          location: "Pune, India",
          from: "2022-07",
          to: "2024-03",
          bullets: [
            "Built the GST e-invoicing integration in Spring Boot that now registers 45,000 invoices a month with the government portal.",
            "Wrote 160 JUnit and Testcontainers tests for the catalogue service, lifting line coverage from 38% to 81%.",
          ],
        }),
      ],
      education: [
        study({
          id: "jvd-edu",
          institution: "Deccan College of Engineering",
          credential: "BE",
          field: "Computer Engineering",
          location: "Pune, India",
          from: "2018-08",
          to: "2022-05",
          result: "8.1 CGPA",
        }),
      ],
      skillGroups: [
        skills("jvd-sk-1", "Languages", ["Java", "SQL", "Kotlin"]),
        skills("jvd-sk-2", "Frameworks and tools", [
          "Spring Boot",
          "Kafka",
          "PostgreSQL",
          "Redis",
          "Docker",
          "Kubernetes",
          "JUnit",
          "Testcontainers",
        ]),
      ],
    }),
  },

  {
    slug: "hr-executive",
    updated: "2026-09-30",
    market: "IN",
    role: "HR Executive",
    occupationTitle: "Human Resources Specialists",
    field: "Operations",
    summary:
      "An HR executive two years into a manufacturing plant role — hiring, induction, statutory compliance and payroll inputs, each with the number a plant HR head checks.",
    notes: [
      {
        title: "Compliance becomes evidence when it has a count",
        body: "PF and ESI returns are routine, so the bullet says what changed: every filing on time for a full year, after clearing a backlog. Routine done reliably is worth saying once, with its scale.",
      },
      {
        title: "Hiring is measured in volume and days",
        body: "Positions closed and days to fill are how a plant judges recruitment, and they answer an interviewer's first question before it is asked.",
      },
      {
        title: "The tools are named where they were used",
        body: "Naukri RMS and greytHR appear in the bullets as well as the skills list. A portal search finds the name; an interviewer gets something specific to ask about.",
      },
      {
        title: "The MBA stays, the school marks go",
        body: "Two years into the job, the postgraduate degree remains on one line and the 10th and 12th rows are gone. The work is now the stronger evidence.",
      },
    ],
    resume: exampleResume({
      slug: "hr-executive",
      contact: contact({
        fullName: "Sneha Pillai",
        email: "sneha@example.com",
        phone: "+91 44 5555 0123",
        location: "Chennai, India",
      }),
      summary:
        "HR executive with two years at an automotive components plant of 650 people, covering recruitment, induction, statutory compliance and payroll inputs.",
      experience: [
        role({
          id: "hre-r1",
          title: "HR Executive",
          organization: "Sriram Auto Components",
          location: "Chennai, India",
          from: "2024-06",
          bullets: [
            "Closed 140 shop-floor and staff positions in 2025, cutting average time to fill from 38 days to 21 by screening on Naukri RMS against a fixed checklist.",
            "Filed all 24 monthly PF and ESI returns on time for 650 employees in 2025, after clearing a four-month backlog in the first quarter.",
            "Rebuilt the induction programme as a two-day plan with a named buddy, lowering 90-day attrition among new operators from 24% to 11%.",
          ],
        }),
        role({
          id: "hre-r2",
          title: "HR Trainee",
          organization: "Sriram Auto Components",
          location: "Chennai, India",
          from: "2023-12",
          to: "2024-05",
          bullets: [
            "Reconciled biometric attendance into greytHR for 3 payroll cycles, resolving 210 mismatches before each payroll cut-off.",
          ],
        }),
      ],
      education: [
        study({
          id: "hre-edu",
          institution: "Coromandel School of Management",
          credential: "MBA",
          field: "Human Resource Management",
          location: "Chennai, India",
          from: "2022-07",
          to: "2024-05",
          result: "7.9 CGPA",
        }),
      ],
      skillGroups: [
        skills("hre-sk-1", "HR operations", [
          "Recruitment",
          "Induction",
          "PF and ESI compliance",
          "Payroll inputs",
          "Employee records",
        ]),
        skills("hre-sk-2", "Tools", ["Naukri RMS", "greytHR", "Excel", "Google Workspace"]),
      ],
    }),
  },

  {
    slug: "pharmacy-technician",
    updated: "2026-09-30",
    market: "US",
    role: "Pharmacy Technician",
    occupationTitle: "Pharmacy Technicians",
    field: "Healthcare",
    summary:
      "A certified pharmacy technician's resume from a busy retail pharmacy — prescription volume, accuracy, and the insurance work that keeps the pickup line moving.",
    notes: [
      {
        title: "Certification and registration come first",
        body: "PTCB certification and the state board registration are screening requirements, so they are in the first line of the summary. A hiring pharmacist checks them before reading anything else.",
      },
      {
        title: "Volume and accuracy, not duties",
        body: "Prescriptions filled a day, the error rate on audits and rejected claims resolved are what a pharmacy manager is measured on. “Assisted the pharmacist” describes every applicant.",
      },
      {
        title: "Insurance work earns its own bullet",
        body: "Fixing rejected claims and chasing prior authorizations saves the pharmacist time, and it is a real reason to choose one technician over another, so it gets a number.",
      },
      {
        title: "US conventions: Letter, city and state",
        body: "No street address, photo or date of birth. The page is set on Letter paper, and the state of registration is spelled out because a multi-state employer checks it.",
      },
    ],
    resume: exampleResume({
      slug: "pharmacy-technician",
      contact: contact({
        fullName: "Jasmine Carter",
        email: "jasmine@example.com",
        phone: "(602) 555-0163",
        location: "Phoenix, AZ",
      }),
      summary:
        "PTCB-certified pharmacy technician with three years in a high-volume retail pharmacy, registered with the Arizona State Board of Pharmacy.",
      experience: [
        role({
          id: "pht-r1",
          title: "Certified Pharmacy Technician",
          organization: "Desert Bloom Pharmacy",
          location: "Phoenix, AZ",
          from: "2023-08",
          bullets: [
            "Filled 280 prescriptions a day for pharmacist verification with a 0.2% error rate on quarterly audits.",
            "Resolved 60 rejected insurance claims a week by correcting billing codes and requesting prior authorizations, cutting the average wait at pickup by 10 minutes.",
            "Reorganized will-call bins by pickup date, reducing return-to-stock work from 6 hours a week to 2.",
          ],
        }),
        role({
          id: "pht-r2",
          title: "Pharmacy Technician Trainee",
          organization: "Desert Bloom Pharmacy",
          location: "Phoenix, AZ",
          from: "2022-11",
          to: "2023-07",
          bullets: [
            "Counted and packaged 150 prescriptions a day under supervision, then passed the PTCB exam on the first attempt in July 2023.",
          ],
        }),
      ],
      education: [
        study({
          id: "pht-edu",
          institution: "Saguaro Community College",
          credential: "Pharmacy Technician Certificate",
          location: "Phoenix, AZ",
          from: "2022-01",
          to: "2022-10",
        }),
      ],
      skillGroups: [
        skills("pht-sk-1", "Pharmacy", [
          "Prescription filling",
          "Insurance billing",
          "Prior authorizations",
          "Inventory control",
          "Controlled substance counts",
        ]),
        skills("pht-sk-2", "Systems", ["PioneerRx", "Pyxis", "Microsoft Excel"]),
      ],
      settings: { pageSize: "LETTER" },
    }),
  },

  {
    slug: "receptionist",
    updated: "2026-09-30",
    market: "US",
    role: "Receptionist",
    occupationTitle: "Receptionists and Information Clerks",
    field: "Operations",
    summary:
      "A front-desk resume from a busy dental practice and a property office — calls, scheduling, no-shows and payments, written as the numbers an office manager watches.",
    notes: [
      {
        title: "The front desk is measured in calls and empty chairs",
        body: "Calls answered, appointments booked and the no-show rate are what an office manager watches each week. A bullet that moves one of them says more than “greeted patients warmly”.",
      },
      {
        title: "Software is named, because postings name it",
        body: "Dentrix, RingCentral and Microsoft 365 appear because front-desk postings ask for them by name, and a recruiter's search for one should find this resume.",
      },
      {
        title: "Two desks, two kinds of work",
        body: "A dental practice and a property office ask for different things, so each role keeps the bullets that show its own work rather than repeating “answered phones” twice.",
      },
      {
        title: "US conventions: Letter, city and state",
        body: "No street address, photo or date of birth — US employers do not expect them. The page is set on Letter paper.",
      },
    ],
    resume: exampleResume({
      slug: "receptionist",
      contact: contact({
        fullName: "Taylor Brooks",
        email: "taylor@example.com",
        phone: "(919) 555-0178",
        location: "Raleigh, NC",
      }),
      summary:
        "Front-desk receptionist with four years across a six-chair dental practice and a property management office, handling 90 calls a day, scheduling and patient payments.",
      experience: [
        role({
          id: "rcp-r1",
          title: "Front Desk Receptionist",
          organization: "Oakwood Family Dental",
          location: "Raleigh, NC",
          from: "2023-02",
          bullets: [
            "Answered 90 calls a day and scheduled 6 dental chairs in Dentrix, keeping 2 emergency slots open every day of the week.",
            "Cut the no-show rate from 14% to 6% by replacing a single reminder call with a text two days ahead and a call the day before.",
            "Reduced balances more than 60 days overdue from $18,000 to $7,500 in a year by collecting co-pays and balances at checkout.",
          ],
        }),
        role({
          id: "rcp-r2",
          title: "Receptionist",
          organization: "Capitol Property Group",
          location: "Raleigh, NC",
          from: "2021-06",
          to: "2023-01",
          bullets: [
            "Logged 40 maintenance requests a week from 300 rental units into the work-order system, routing each to a technician within 2 hours.",
            "Rebuilt the package log in Microsoft 365, ending the 15 lost-package complaints the office had averaged each quarter.",
          ],
        }),
      ],
      education: [
        study({
          id: "rcp-edu",
          institution: "Capital Area Community College",
          credential: "Certificate",
          field: "Office Administration",
          location: "Raleigh, NC",
          from: "2020-08",
          to: "2021-05",
        }),
      ],
      skillGroups: [
        skills("rcp-sk-1", "Front desk", [
          "Multi-line phones",
          "Appointment scheduling",
          "Patient check-in",
          "Payment collection",
          "Insurance verification",
        ]),
        skills("rcp-sk-2", "Software", ["Dentrix", "RingCentral", "Microsoft 365"]),
      ],
      settings: { pageSize: "LETTER" },
    }),
  },
];

export function getRoleExample(slug: string): RoleExample | null {
  return ROLE_EXAMPLES.find((example) => example.slug === slug) ?? null;
}

export const EXAMPLE_SLUGS: readonly string[] = ROLE_EXAMPLES.map((example) => example.slug);
