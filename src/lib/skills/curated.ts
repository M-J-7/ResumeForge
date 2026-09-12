/**
 * The alias list we own (M3-T1).
 *
 * The risk register lists "ESCO/O*NET license terms changed" with the
 * mitigation "keep the curated alias list independent and owned". This file
 * is that list. Nothing in it is derived from a third-party taxonomy, so a
 * licence change upstream can take `data/skills.json` away without taking
 * the part that does most of the work.
 *
 * ## Why an ingested taxonomy is not enough on its own
 *
 * O*NET's technology list has "Kubernetes" and "JavaScript" as separate
 * entries with no relationship between them and the strings people actually
 * write. A candidate writes "k8s"; a posting writes "Kubernetes". A résumé
 * says "JS"; the requirement says "JavaScript". Without these mappings the
 * matcher reports a missing skill the candidate demonstrably has, which is
 * the single fastest way to lose a user's trust — they can see the word on
 * their own resume.
 *
 * ## Rules for editing
 *
 * - `canonical` is what the UI displays. Get the casing right: "PostgreSQL",
 *   not "Postgresql"; "GraphQL", not "Graphql". Users notice.
 * - `aliases` are matched case-insensitively after normalisation, so there is
 *   no point listing both "k8s" and "K8s".
 * - Do not add an alias that is a common English word on its own. "R" the
 *   language and "r" the letter are indistinguishable after normalisation,
 *   and a false positive here is worse than a miss: it tells someone they
 *   match a requirement they do not.
 */

export interface CuratedSkill {
  /** Stable slug. Never change one; it is the join key into scores. */
  readonly id: string;
  readonly canonical: string;
  readonly aliases: readonly string[];
  readonly category: string;
}

export const CURATED_SKILLS: readonly CuratedSkill[] = [
  /* ---------------------------------------------------------------- */
  /* Languages                                                         */
  /* ---------------------------------------------------------------- */
  {
    id: "javascript",
    canonical: "JavaScript",
    aliases: ["js", "ecmascript", "es6", "es2015", "vanilla js"],
    category: "language",
  },
  {
    id: "typescript",
    canonical: "TypeScript",
    aliases: ["ts"],
    category: "language",
  },
  { id: "python", canonical: "Python", aliases: ["py", "python3"], category: "language" },
  { id: "java", canonical: "Java", aliases: ["java se", "java ee", "j2ee"], category: "language" },
  {
    id: "csharp",
    canonical: "C#",
    aliases: ["c sharp", "csharp", "dotnet c#"],
    category: "language",
  },
  { id: "cpp", canonical: "C++", aliases: ["cpp", "c plus plus"], category: "language" },
  { id: "go", canonical: "Go", aliases: ["golang"], category: "language" },
  { id: "rust", canonical: "Rust", aliases: [], category: "language" },
  { id: "ruby", canonical: "Ruby", aliases: [], category: "language" },
  { id: "php", canonical: "PHP", aliases: [], category: "language" },
  { id: "swift", canonical: "Swift", aliases: [], category: "language" },
  { id: "kotlin", canonical: "Kotlin", aliases: [], category: "language" },
  { id: "scala", canonical: "Scala", aliases: [], category: "language" },
  { id: "sql", canonical: "SQL", aliases: ["structured query language"], category: "language" },
  {
    id: "bash",
    canonical: "Bash",
    aliases: ["shell scripting", "shell script", "zsh"],
    category: "language",
  },

  /* ---------------------------------------------------------------- */
  /* Frontend                                                          */
  /* ---------------------------------------------------------------- */
  { id: "react", canonical: "React", aliases: ["reactjs", "react.js"], category: "frontend" },
  {
    id: "react-native",
    canonical: "React Native",
    aliases: ["rn", "reactnative"],
    category: "mobile",
  },
  { id: "nextjs", canonical: "Next.js", aliases: ["next js", "nextjs"], category: "frontend" },
  { id: "vue", canonical: "Vue.js", aliases: ["vue", "vuejs"], category: "frontend" },
  {
    id: "angular",
    canonical: "Angular",
    aliases: ["angularjs", "angular 2"],
    category: "frontend",
  },
  { id: "svelte", canonical: "Svelte", aliases: ["sveltekit"], category: "frontend" },
  {
    id: "tailwind",
    canonical: "Tailwind CSS",
    aliases: ["tailwind", "tailwindcss"],
    category: "frontend",
  },
  {
    id: "css",
    canonical: "CSS",
    aliases: ["css3", "cascading style sheets"],
    category: "frontend",
  },
  {
    id: "html",
    canonical: "HTML",
    aliases: ["html5", "hypertext markup language"],
    category: "frontend",
  },

  /* ---------------------------------------------------------------- */
  /* Backend and data                                                  */
  /* ---------------------------------------------------------------- */
  {
    id: "nodejs",
    canonical: "Node.js",
    aliases: ["node", "nodejs", "node js"],
    category: "backend",
  },
  { id: "django", canonical: "Django", aliases: [], category: "backend" },
  { id: "flask", canonical: "Flask", aliases: [], category: "backend" },
  {
    id: "spring",
    canonical: "Spring",
    aliases: ["spring boot", "springboot"],
    category: "backend",
  },
  { id: "rails", canonical: "Ruby on Rails", aliases: ["rails", "ror"], category: "backend" },
  {
    id: "dotnet",
    canonical: ".NET",
    aliases: ["dot net", "asp.net", "aspnet", ".net core"],
    category: "backend",
  },
  { id: "graphql", canonical: "GraphQL", aliases: ["graph ql"], category: "backend" },
  {
    id: "rest",
    canonical: "REST APIs",
    /*
     * `"rest"` on its own is deliberately absent, and was removed after it
     * matched.
     *
     * It broke this file's own rule three paragraphs up — no alias that is a
     * common English word — and it broke it in the direction the rule warns
     * about. `skillsInLine` resolves single tokens, so "covered the rest of
     * the region", "patients were on bed rest" and "rest days" each resolved
     * to REST APIs. On a resume that means telling somebody they demonstrate a
     * skill they have never used; on a posting it means inventing a
     * requirement nobody wrote. Found while assembling the §11 corpus, where a
     * teacher's resume came back demonstrating REST APIs.
     *
     * "rest api" and "restful" are unambiguous and stay.
     */
    aliases: ["restful", "rest api", "rest apis", "restful api"],
    category: "backend",
  },
  { id: "grpc", canonical: "gRPC", aliases: [], category: "backend" },
  {
    id: "postgresql",
    canonical: "PostgreSQL",
    aliases: ["postgres", "pg", "psql"],
    category: "database",
  },
  { id: "mysql", canonical: "MySQL", aliases: ["mariadb"], category: "database" },
  { id: "mongodb", canonical: "MongoDB", aliases: ["mongo"], category: "database" },
  { id: "redis", canonical: "Redis", aliases: [], category: "database" },
  {
    id: "elasticsearch",
    canonical: "Elasticsearch",
    aliases: ["elastic search", "elk"],
    category: "database",
  },
  { id: "sqlite", canonical: "SQLite", aliases: [], category: "database" },
  { id: "dynamodb", canonical: "DynamoDB", aliases: ["dynamo db"], category: "database" },
  { id: "kafka", canonical: "Apache Kafka", aliases: ["kafka"], category: "data" },
  { id: "spark", canonical: "Apache Spark", aliases: ["spark", "pyspark"], category: "data" },
  { id: "airflow", canonical: "Apache Airflow", aliases: ["airflow"], category: "data" },
  { id: "dbt", canonical: "dbt", aliases: ["data build tool"], category: "data" },
  { id: "snowflake", canonical: "Snowflake", aliases: [], category: "data" },

  /* ---------------------------------------------------------------- */
  /* Cloud and infrastructure                                          */
  /* ---------------------------------------------------------------- */
  {
    id: "kubernetes",
    canonical: "Kubernetes",
    aliases: ["k8s", "kube", "eks", "gke", "aks"],
    category: "cloud-infrastructure",
  },
  {
    id: "docker",
    canonical: "Docker",
    aliases: ["containerisation", "containerization"],
    category: "cloud-infrastructure",
  },
  {
    id: "aws",
    canonical: "AWS",
    aliases: ["amazon web services"],
    category: "cloud-infrastructure",
  },
  {
    id: "gcp",
    canonical: "Google Cloud Platform",
    aliases: ["gcp", "google cloud"],
    category: "cloud-infrastructure",
  },
  {
    id: "azure",
    canonical: "Microsoft Azure",
    aliases: ["azure"],
    category: "cloud-infrastructure",
  },
  { id: "terraform", canonical: "Terraform", aliases: ["hcl"], category: "cloud-infrastructure" },
  { id: "ansible", canonical: "Ansible", aliases: [], category: "cloud-infrastructure" },
  { id: "helm", canonical: "Helm", aliases: [], category: "cloud-infrastructure" },
  {
    id: "cicd",
    canonical: "CI/CD",
    aliases: ["ci cd", "continuous integration", "continuous delivery", "continuous deployment"],
    category: "practice",
  },
  {
    id: "github-actions",
    canonical: "GitHub Actions",
    aliases: ["gh actions"],
    category: "cloud-infrastructure",
  },
  { id: "jenkins", canonical: "Jenkins", aliases: [], category: "cloud-infrastructure" },
  { id: "prometheus", canonical: "Prometheus", aliases: [], category: "observability" },
  { id: "grafana", canonical: "Grafana", aliases: [], category: "observability" },
  { id: "datadog", canonical: "Datadog", aliases: ["data dog"], category: "observability" },
  {
    id: "opentelemetry",
    canonical: "OpenTelemetry",
    aliases: ["otel", "open telemetry"],
    category: "observability",
  },
  {
    id: "linux",
    canonical: "Linux",
    aliases: ["unix", "ubuntu", "debian"],
    category: "cloud-infrastructure",
  },
  {
    id: "git",
    canonical: "Git",
    aliases: ["version control", "github", "gitlab"],
    category: "tooling",
  },

  /* ---------------------------------------------------------------- */
  /* Machine learning                                                  */
  /* ---------------------------------------------------------------- */
  {
    id: "machine-learning",
    canonical: "Machine Learning",
    aliases: ["ml", "machine-learning"],
    category: "ml",
  },
  {
    id: "deep-learning",
    canonical: "Deep Learning",
    aliases: ["dl", "neural networks"],
    category: "ml",
  },
  { id: "nlp", canonical: "Natural Language Processing", aliases: ["nlp"], category: "ml" },
  { id: "pytorch", canonical: "PyTorch", aliases: ["torch"], category: "ml" },
  { id: "tensorflow", canonical: "TensorFlow", aliases: ["tf", "keras"], category: "ml" },
  {
    id: "scikit-learn",
    canonical: "scikit-learn",
    aliases: ["sklearn", "scikit learn"],
    category: "ml",
  },
  { id: "pandas", canonical: "pandas", aliases: [], category: "data" },
  { id: "numpy", canonical: "NumPy", aliases: [], category: "data" },
  {
    id: "llm",
    canonical: "Large Language Models",
    aliases: ["llms", "llm", "genai", "generative ai"],
    category: "ml",
  },

  /* ---------------------------------------------------------------- */
  /* Practices and ways of working                                     */
  /* ---------------------------------------------------------------- */
  {
    id: "agile",
    canonical: "Agile",
    aliases: ["scrum", "kanban", "agile methodology"],
    category: "practice",
  },
  { id: "tdd", canonical: "Test-Driven Development", aliases: ["tdd"], category: "practice" },
  {
    id: "code-review",
    canonical: "Code Review",
    aliases: ["peer review", "pull request review"],
    category: "practice",
  },
  {
    id: "microservices",
    canonical: "Microservices",
    aliases: ["micro services", "microservice architecture"],
    category: "architecture",
  },
  {
    id: "system-design",
    canonical: "System Design",
    aliases: ["distributed systems", "architecture design"],
    category: "architecture",
  },
  {
    id: "accessibility",
    canonical: "Accessibility",
    aliases: ["a11y", "wcag"],
    category: "practice",
  },
  {
    id: "security",
    canonical: "Security",
    aliases: ["appsec", "infosec", "application security"],
    category: "practice",
  },
  {
    id: "seo",
    canonical: "SEO",
    aliases: ["search engine optimisation", "search engine optimization"],
    category: "marketing",
  },

  /* ---------------------------------------------------------------- */
  /* Business and office tooling                                       */
  /* ---------------------------------------------------------------- */
  {
    id: "excel",
    canonical: "Microsoft Excel",
    aliases: ["excel", "ms excel", "spreadsheets"],
    category: "office",
  },
  {
    id: "powerpoint",
    canonical: "Microsoft PowerPoint",
    aliases: ["powerpoint", "ms powerpoint"],
    category: "office",
  },
  { id: "tableau", canonical: "Tableau", aliases: [], category: "analytics" },
  {
    id: "power-bi",
    canonical: "Power BI",
    aliases: ["powerbi", "microsoft power bi"],
    category: "analytics",
  },
  { id: "figma", canonical: "Figma", aliases: [], category: "design" },
  { id: "jira", canonical: "Jira", aliases: ["atlassian jira"], category: "tooling" },
  { id: "salesforce", canonical: "Salesforce", aliases: ["sfdc"], category: "crm" },
  {
    id: "project-management",
    canonical: "Project Management",
    aliases: ["programme management", "program management"],
    category: "management",
  },
  {
    id: "stakeholder-management",
    canonical: "Stakeholder Management",
    aliases: ["stakeholder engagement"],
    category: "management",
  },
  {
    id: "ab-testing",
    canonical: "A/B Testing",
    aliases: ["a b testing", "split testing", "experimentation"],
    category: "analytics",
  },
];
