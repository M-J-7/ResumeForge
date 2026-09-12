/**
 * Job-description fixtures for the structure parser (M3-T3).
 *
 * ## What these are, and what they are not
 *
 * M3-T3's acceptance says "correct section split on 10 real JDs collected
 * from public postings". These are **not** those. They are ten postings
 * written to reproduce ten distinct structural conventions observed in real
 * postings — markdown headings, ALL CAPS headings, bare colon lines, bold
 * lines, big-tech "Minimum/Preferred Qualifications", agency "Essential /
 * Desirable", startup voice, inline "(nice to have)" qualifiers, a posting
 * with no headings at all, and one buried in boilerplate.
 *
 * Copying ten real postings into a public repository would be republishing
 * someone else's copyrighted text, and inventing ten and calling them real
 * would be worse. So the automated suite covers the *conventions*, and
 * `docs/QA.md` carries the check against genuinely collected postings, with
 * `scripts/parse-jd.mjs` to make running it one command.
 *
 * Each fixture lists marker phrases that must land in a given kind. Markers
 * rather than whole expected structures: an assertion that pins every line
 * fails on any harmless change, and stops being read.
 */

export interface JdFixture {
  name: string;
  /** The structural convention this posting is here to represent. */
  convention: string;
  text: string;
  expect: {
    title?: string | null;
    required?: string[];
    preferred?: string[];
    responsibilities?: string[];
    /** Must carry zero weight — never contributes to a match. */
    ignored?: string[];
  };
}

export const JD_FIXTURES: readonly JdFixture[] = [
  {
    name: "colon-headings",
    convention: "Bare headings terminated with a colon; hyphen bullets.",
    text: `Senior Backend Engineer

Responsibilities:
- Design and operate the payments API used by 40 million customers.
- Mentor two engineers and run the on-call rotation.

Requirements:
- 5+ years building production services in Go or Java.
- Strong grounding in PostgreSQL and query optimisation.

Nice to have:
- Experience with Kafka.
- Exposure to PCI-DSS compliance work.
`,
    expect: {
      title: "Senior Backend Engineer",
      responsibilities: ["payments API", "on-call rotation"],
      required: ["Go or Java", "PostgreSQL"],
      preferred: ["Kafka", "PCI-DSS"],
    },
  },

  {
    name: "markdown-headings",
    convention: "Markdown `##` headings, curly apostrophes, asterisk bullets.",
    text: `# Staff Data Engineer

## About us
We are a Series B company building analytics for hospitals. Our stack is
Snowflake, dbt and Airflow.

## What you’ll do
* Own the ingestion pipelines end to end.
* Partner with clinicians to model new datasets.

## What you’ll need
* Deep SQL, and production experience with dbt.
* A track record of owning data quality, not just moving bytes.

## Bonus points
* Healthcare data experience (HL7, FHIR).
`,
    expect: {
      responsibilities: ["ingestion pipelines", "clinicians"],
      required: ["Deep SQL", "data quality"],
      preferred: ["HL7, FHIR"],
      // The company's own stack asks nothing of the candidate.
      ignored: ["Snowflake, dbt and Airflow"],
    },
  },

  {
    name: "all-caps-headings",
    convention: "ALL CAPS headings with no punctuation; bullet character •.",
    text: `PRODUCT DESIGNER

RESPONSIBILITIES
• Run discovery interviews and turn them into flows.
• Maintain the design system in Figma.

QUALIFICATIONS
• 4+ years designing consumer products.
• A portfolio showing shipped work, not concepts.

PREFERRED QUALIFICATIONS
• Motion design.
• Front-end skills in HTML and CSS.

PERKS & BENEFITS
• 30 days holiday and a learning budget.
`,
    expect: {
      responsibilities: ["discovery interviews", "design system in Figma"],
      required: ["4+ years designing consumer products", "portfolio showing shipped work"],
      preferred: ["Motion design", "HTML and CSS"],
      ignored: ["30 days holiday"],
    },
  },

  {
    name: "big-tech",
    convention: "Minimum / Preferred Qualifications, numbered lists.",
    text: `Software Engineer III, Infrastructure

Minimum Qualifications
1. Bachelor's degree in Computer Science or equivalent practical experience.
2. 3 years of experience with distributed systems.

Preferred Qualifications
1. Experience with Kubernetes at scale.
2. Contributions to open-source infrastructure projects.

About the job
You will join the team responsible for the internal compute platform.
`,
    expect: {
      required: ["Bachelor's degree", "distributed systems"],
      preferred: ["Kubernetes at scale", "open-source infrastructure"],
      responsibilities: ["internal compute platform"],
    },
  },

  {
    name: "startup-voice",
    convention: "Conversational headings: Who we are / What you'll own / Who you are.",
    text: `Founding Engineer

Who we are
Six people, one office, and a product that schedules field technicians.

What you'll own
- The whole backend, from the API to the deploy pipeline.
- Choosing what we build next, with the founders.

Who you are
- You have shipped and operated something end to end.
- You are comfortable with TypeScript and Postgres.

Bonus points if you have
- Worked at a company under 20 people before.

Why join
- Meaningful equity and a four-day week.
`,
    expect: {
      title: "Founding Engineer",
      responsibilities: ["whole backend", "Choosing what we build next"],
      required: ["shipped and operated something", "TypeScript and Postgres"],
      preferred: ["under 20 people"],
      ignored: ["Meaningful equity", "schedules field technicians"],
    },
  },

  {
    name: "bold-headings",
    convention: "Bold markdown lines used as headings, with a legal tail.",
    text: `**Site Reliability Engineer**

**The Role**
Keep a fleet of 400 services healthy and make the on-call rota quieter.

**Requirements**
- Linux internals, and comfort reading a flame graph.
- Terraform, or a real willingness to learn it quickly.

**Desirable**
- Experience running Prometheus at scale.

**Equal Opportunity**
We are an equal opportunity employer and welcome applicants from every
background.
`,
    expect: {
      responsibilities: ["fleet of 400 services"],
      required: ["Linux internals", "Terraform"],
      preferred: ["Prometheus at scale"],
      ignored: ["equal opportunity employer"],
    },
  },

  {
    name: "no-headings",
    convention: "Prose only. Nothing is marked; everything is the opening block.",
    text: `Data Analyst

We are looking for a data analyst to join our commercial team. You will build
dashboards in Looker, answer questions from the sales organisation, and own
the weekly revenue reporting. We would like someone with two years of SQL
experience and the patience to chase down a number that does not reconcile.
`,
    expect: {
      title: "Data Analyst",
      // With no headings, the text is one intro block — which still carries
      // signal, and must not be silently discarded.
      required: [],
    },
  },

  {
    name: "inline-qualifiers",
    convention: "One requirements list where individual items are marked optional.",
    text: `Machine Learning Engineer

Requirements
- Strong Python, and experience training models in PyTorch.
- Familiarity with Ray (nice to have).
- Published research (a plus).
- Experience deploying models to production (required).
`,
    expect: {
      required: ["Strong Python", "deploying models to production"],
      // A section-level classification alone would score these as hard bars.
      preferred: ["Familiarity with Ray", "Published research"],
    },
  },

  {
    name: "agency-style",
    convention: "Recruiter phrasing: The Role / Essential Skills / Desirable Skills / Package.",
    text: `Java Developer - Contract

The Role
Our client, a tier-one bank, needs a Java developer for a 6 month engagement.

Essential Skills
- Java 17 and Spring Boot.
- Experience within financial services.

Desirable Skills
- Kafka.
- Knowledge of FIX protocol.

Package
- GBP 550 per day, inside IR35.

How to apply
Send your CV to the address below.
`,
    expect: {
      responsibilities: ["tier-one bank"],
      required: ["Java 17 and Spring Boot", "financial services"],
      preferred: ["FIX protocol"],
      ignored: ["550 per day", "Send your CV"],
    },
  },

  {
    name: "boilerplate-heavy",
    convention: "Real content sandwiched between company blurb and legal text.",
    text: `Technical Writer

About Us
Founded in 2011, we are the leading provider of workflow software for
laboratories. Our values are curiosity, candour and care.

Our Mission
To make laboratory data useful.

The Opportunity
You will own the developer documentation for our public API.

You should have
- Three years writing technical documentation for developers.
- The ability to read code well enough to test your own examples.

It'd be great if you also have
- Experience with OpenAPI and docs-as-code toolchains.

Benefits
Private healthcare, a home office budget, and 25 days holiday.

Diversity and Inclusion
We are committed to building a team that reflects the world we serve.
`,
    expect: {
      responsibilities: ["developer documentation"],
      required: ["Three years writing technical documentation", "read code well enough"],
      preferred: ["OpenAPI"],
      ignored: [
        "workflow software for",
        "make laboratory data useful",
        "Private healthcare",
        "reflects the world we serve",
      ],
    },
  },
];
