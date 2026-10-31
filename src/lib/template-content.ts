import type { FaqItem } from "./faq";

/** Dates track public copy, not the date the application happens to build. */
export const TEMPLATE_PAGE_UPDATED = "2026-10-31";
export const HOME_PAGE_UPDATED = "2026-10-31";

export const TEMPLATE_AUDIENCES = [
  {
    title: "For freshers and students",
    template: "campus",
    label: "Campus",
    body: "Put education, internships and academic projects before a short work history. Describe your own contribution to each project and the tools you used; an empty experience section does not need invented jobs.",
    guide: "/guides/resume-format-for-freshers",
    guideLabel: "Resume format for freshers",
  },
  {
    title: "For experienced professionals",
    template: "atlas",
    label: "Atlas",
    body: "Start with your recent relevant employment. Keep job titles, employers and dates easy to find, then use bullets to explain your contribution and results. Give older, less relevant work less space.",
    guide: "/guides/how-long-should-a-resume-be",
    guideLabel: "Choose a useful resume length",
  },
  {
    title: "For a simple, readable resume",
    template: "plainspoken",
    label: "Plainspoken",
    body: "Choose a restrained design when you want the content to lead. Keep standard headings and enough space between sections. A simple layout still needs specific evidence of the work you can do.",
    guide: "/guides/two-column-resume-ats",
    guideLabel: "What our one-column and two-column test found",
  },
  {
    title: "For career changers",
    template: "pivot",
    label: "Pivot",
    body: "Lead with relevant skills, then show where you used them in your employment or projects. Keep your work history and dates visible. Use the target job description to choose relevant evidence, without adding skills you do not have.",
    guide: "/guides/career-change-resume",
    guideLabel: "Write a career-change resume",
  },
] as const;

export const TEMPLATE_FAQ: readonly FaqItem[] = [
  {
    question: "Where can I download a free ATS-friendly resume template?",
    answer:
      "Every template in this gallery has Word and PDF download buttons. Those files contain a fictional sample resume you can replace with your own details. To fill in the template online instead, choose Use this template, enter your information in the builder and download your completed resume. Both routes are free, without an account or a watermark.",
  },
  {
    question: "Which resume template should a fresher with no experience choose?",
    answer:
      "Campus is a starting point for education, internships and projects. A fresher can explain a project using its goal, their own contribution, the tools used and a result they can support. Leave out sections that have nothing to say. A template arranges your information; it does not supply experience or qualifications you have not earned.",
    link: {
      href: "/guides/resume-format-for-freshers",
      label: "See the fresher format and examples",
    },
  },
  {
    question: "Can I edit the downloaded template in Microsoft Word?",
    answer:
      "Yes. Download Word to get an editable .docx file, then replace the sample name, contact details, employers and bullets with your own. Keep standard section headings and check page breaks after editing. You can also use the online builder to keep the document's spacing consistent and export a new Word file whenever you need one.",
  },
  {
    question: "Should I download my resume as PDF or Word?",
    answer:
      "Follow the employer's stated file requirements first. A text-based PDF preserves the page layout; a Word file remains easy to edit and gives a parser structured text and headings. This builder exports both, so you can choose the format an application accepts. Check the actual file before sending it, especially if you edited a downloaded Word template.",
    link: { href: "/guides/resume-file-format", label: "When to send PDF, DOCX or plain text" },
  },
  {
    question: "Does an ATS-friendly template guarantee that my application is selected?",
    answer:
      "No template can guarantee selection. Here, ATS-friendly describes a single column of real text with readable fonts and standard headings, so information can be recovered without reading a picture or a decorative sidebar. Employers use different systems and requirements. Your qualifications, application answers and relevance to the job still matter. Use the checker to inspect what is recovered from your own file.",
    link: { href: "/check", label: "Check the text recovered from your resume" },
  },
  {
    question: "Can I use these templates as an ATS CV maker?",
    answer:
      "Yes, for the job-application document often called a CV in the UK, India and other markets. Choose the appropriate paper size and include the experience, education and skills relevant to the role. An academic CV with a full publication record has a different purpose from a short employment resume, so follow the institution's instructions about content and length.",
    link: {
      href: "/guides/cv-vs-resume-vs-biodata",
      label: "CV, resume and biodata: the differences",
    },
  },
];
