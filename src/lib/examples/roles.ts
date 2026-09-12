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
  readonly resume: ResumeDocument;
}

export const ROLE_EXAMPLES: readonly RoleExample[] = [
  {
    slug: "software-developer",
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
];

export function getRoleExample(slug: string): RoleExample | null {
  return ROLE_EXAMPLES.find((example) => example.slug === slug) ?? null;
}

export const EXAMPLE_SLUGS: readonly string[] = ROLE_EXAMPLES.map((example) => example.slug);
