/** Demo curriculum for land lease community managers — inserted by `seed:seedLandLeaseCurriculum`. */

export type SeedQuestion = {
  id: string;
  question: string;
  type: "multiple_choice";
  options: string[];
  correctAnswer: string;
};

export type SeedAssignment = {
  title: string;
  description: string;
  passingScore: number;
  questions: SeedQuestion[];
};

export type SeedContent = {
  type: "video" | "slideshow" | "link" | "pdf";
  title: string;
  url: string;
  order: number;
  duration?: number;
};

/** References another unit in the seeded curriculum (by course name + unit title). */
export type SeedPrerequisiteRef = {
  courseName: string;
  unitTitle: string;
};

export type SeedUnit = {
  title: string;
  description: string;
  order: number;
  content: SeedContent[];
  /**
   * Optional graded quiz (`contentItems.type === "test"`), inserted before the
   * unit assignment — typical flow: lessons → knowledge check → assignment.
   */
  test?: SeedAssignment;
  assignment: SeedAssignment;
  prerequisites?: SeedPrerequisiteRef[];
};

/** Stable key for wiring prerequisites in seed / sync mutations. */
export function seedUnitKey(courseName: string, unitTitle: string) {
  return `${courseName}::${unitTitle}`;
}

export type SeedCourse = {
  name: string;
  /** Admin courses board: groups this certification with related tracks (filter chips). */
  certificationCategory: string;
  /** Short summary for cards and lists (distinct from full description). */
  summary: string;
  tagline: string;
  description: string;
  thumbnailUrl: string;
  order: number;
  units: SeedUnit[];
};

/** Sample MP4 that works with HTML5 `<video>` (short clip). */
const DEMO_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

/** Public sample PDF for seeded reference items (type `pdf`). */
const SAMPLE_PDF =
  "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf";

function slideDeck(): string {
  return JSON.stringify([
    `https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80&auto=format&fit=crop`,
    `https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80&auto=format&fit=crop`,
    `https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80&auto=format&fit=crop`,
  ]);
}

export const LAND_LEASE_CURRICULUM: SeedCourse[] = [
  {
    name: "Land Lease 101",
    certificationCategory: "Orientation & foundations",
    summary:
      "How land lease communities work in Australia — sites, homes, charges, and operator roles.",
    tagline: "Start here — foundations for new managers",
    description:
      "Orientation to residential land lease communities in Australia: how sites work, who does what, and how legislation shapes daily operations. Includes video intros, reference decks, and short checkpoints.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80&auto=format&fit=crop",
    order: 0,
    units: [
      {
        title: "Understanding the land lease model",
        description:
          "Sites, relocatable homes, recurrent charges, and the operator’s role in keeping communities compliant and liveable.",
        order: 0,
        content: [
          {
            type: "video",
            title: "Your role as a community manager",
            url: DEMO_VIDEO,
            order: 0,
            duration: 180,
          },
          {
            type: "slideshow",
            title: "Site layout & stakeholder map",
            url: slideDeck(),
            order: 1,
          },
          {
            type: "link",
            title: "Land lease resources",
            url: "https://www.ccia.com.au/",
            order: 2,
          },
          {
            type: "pdf",
            title: "Sample fee schedule layout (reference PDF)",
            url: SAMPLE_PDF,
            order: 3,
          },
        ],
        test: {
          title: "Knowledge check — Land lease model",
          description: "Quick recall of how sites and ownership typically work.",
          passingScore: 70,
          questions: [
            {
              id: "ll101-t1",
              question:
                "Recurrent charges in a land lease community usually fund:",
              type: "multiple_choice",
              options: [
                "Only the operator’s unrelated businesses",
                "Shared services and upkeep described in community rules or agreements",
                "Council rates for every private home title",
                "Nothing — they are optional donations",
              ],
              correctAnswer:
                "Shared services and upkeep described in community rules or agreements",
            },
            {
              id: "ll101-t2",
              question:
                "A relocatable home on a leased site is best described as:",
              type: "multiple_choice",
              options: [
                "Always real property merged with the land automatically",
                "Often a dwelling that can be relocated subject to rules and approvals",
                "Illegal in Australian land lease communities",
                "Owned by the state government",
              ],
              correctAnswer:
                "Often a dwelling that can be relocated subject to rules and approvals",
            },
          ],
        },
        assignment: {
          title: "Checkpoint — Land lease basics",
          description: "Confirm you understand core terminology and responsibilities.",
          passingScore: 75,
          questions: [
            {
              id: "ll101-q1",
              question:
                "In a typical land lease community, who usually owns the land under residents’ homes?",
              type: "multiple_choice",
              options: [
                "Each resident owns the freehold land under their home",
                "The community operator (or head lessor) retains land ownership",
                "The local council always owns the land",
                "Ownership alternates every financial year",
              ],
              correctAnswer:
                "The community operator (or head lessor) retains land ownership",
            },
            {
              id: "ll101-q2",
              question:
                "Which goal is most central to a land lease community operator’s compliance role?",
              type: "multiple_choice",
              options: [
                "Maximising short-term letting income only",
                "Maintaining safe systems, fair dealing, and lawful site agreements",
                "Avoiding all contact with residents",
                "Delegating all decisions to contractors without oversight",
              ],
              correctAnswer:
                "Maintaining safe systems, fair dealing, and lawful site agreements",
            },
            {
              id: "ll101-q3",
              question:
                "Why is clear record-keeping important for site agreements and recurrent charges?",
              type: "multiple_choice",
              options: [
                "It is optional and only needed for tax audits",
                "It supports transparency, disputes resolution, and regulatory enquiries",
                "It replaces the need for physical safety inspections",
                "It guarantees residents cannot raise complaints",
              ],
              correctAnswer:
                "It supports transparency, disputes resolution, and regulatory enquiries",
            },
          ],
        },
      },
      {
        title: "Day-to-day operations on site",
        description:
          "Routines for inspections, amenities, contractor coordination, and resident communications.",
        order: 1,
        prerequisites: [
          {
            courseName: "Land Lease 101",
            unitTitle: "Understanding the land lease model",
          },
        ],
        content: [
          {
            type: "video",
            title: "Daily rounds and escalation paths",
            url: DEMO_VIDEO,
            order: 0,
            duration: 240,
          },
          {
            type: "link",
            title: "NSW Fair Trading land lease communities hub",
            url: "https://www.fairtrading.nsw.gov.au/housing-and-property/landlease-communities",
            order: 1,
          },
          {
            type: "pdf",
            title: "Incident log template (sample PDF)",
            url: SAMPLE_PDF,
            order: 2,
          },
        ],
        test: {
          title: "Knowledge check — On-site routines",
          description: "Priorities when triaging everyday operational issues.",
          passingScore: 70,
          questions: [
            {
              id: "ll102-t1",
              question:
                "Before opening a common-area facility after maintenance, you should:",
              type: "multiple_choice",
              options: [
                "Assume it is safe if contractors left quickly",
                "Verify completion, signage removal, and recommissioning checks where relevant",
                "Wait one month regardless of risk",
                "Rely on resident volunteers to certify safety",
              ],
              correctAnswer:
                "Verify completion, signage removal, and recommissioning checks where relevant",
            },
            {
              id: "ll102-t2",
              question:
                "Good practice for resident-facing maintenance updates is to:",
              type: "multiple_choice",
              options: [
                "Share realistic timeframes and known impacts",
                "Promise exact completion dates you cannot control",
                "Avoid all written notices",
                "Only update residents after legal proceedings",
              ],
              correctAnswer:
                "Share realistic timeframes and known impacts",
            },
          ],
        },
        assignment: {
          title: "Checkpoint — Operational priorities",
          description: "Prioritise tasks and escalation in realistic scenarios.",
          passingScore: 80,
          questions: [
            {
              id: "ll102-q1",
              question:
                "A resident reports a tripping hazard on a main road inside the community. What should you do first?",
              type: "multiple_choice",
              options: [
                "Ignore until the next quarterly inspection",
                "Assess and control the hazard, document, and arrange timely repair",
                "Ask the resident to fix it privately",
                "Wait for three identical complaints before acting",
              ],
              correctAnswer:
                "Assess and control the hazard, document, and arrange timely repair",
            },
            {
              id: "ll102-q2",
              question:
                "When coordinating contractors on site, which practice best supports WHS and resident trust?",
              type: "multiple_choice",
              options: [
                "Allow unknown visitors without induction",
                "Induction, permits where required, clear work zones, and communication to residents",
                "Work only after dark to avoid residents",
                "Avoid signage so works look temporary",
              ],
              correctAnswer:
                "Induction, permits where required, clear work zones, and communication to residents",
            },
          ],
        },
      },
    ],
  },
  {
    name: "Compliance & the Act",
    certificationCategory: "Orientation & foundations",
    summary:
      "Statutory duties, disclosure, and records that stand up to scrutiny under Australian land lease law themes.",
    tagline: "Rules, records, and home-site agreements",
    description:
      "Navigate statutory duties, disclosure expectations, and documentation that stands up to scrutiny — aligned with Australian land lease community law themes (state rules still apply in your jurisdiction).",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80&auto=format&fit=crop",
    order: 10,
    units: [
      {
        title: "Statutory framework & operator duties",
        description:
          "High-level obligations: community rules, site costs, sales pathways, and working with fair trading frameworks.",
        order: 0,
        prerequisites: [
          {
            courseName: "Land Lease 101",
            unitTitle: "Understanding the land lease model",
          },
        ],
        content: [
          {
            type: "slideshow",
            title: "Compliance pillars for operators",
            url: slideDeck(),
            order: 0,
          },
          {
            type: "link",
            title: "Residential (Land Lease) Communities Act (NSW)",
            url: "https://legislation.nsw.gov.au/view/html/inforce/current/act-2013-0042",
            order: 1,
          },
          {
            type: "video",
            title: "Proportionate compliance culture",
            url: DEMO_VIDEO,
            order: 2,
            duration: 200,
          },
          {
            type: "pdf",
            title: "Compliance register excerpt (sample PDF)",
            url: SAMPLE_PDF,
            order: 3,
          },
        ],
        test: {
          title: "Knowledge check — Statutory duties",
          description: "Spot the themes regulators expect operators to manage.",
          passingScore: 70,
          questions: [
            {
              id: "cmp-t1",
              question:
                "Community rules and site agreements should generally be:",
              type: "multiple_choice",
              options: [
                "Applied inconsistently to speed things up",
                "Accessible, lawful, and enforced fairly",
                "Hidden from residents until disputes arise",
                "Replaced by verbal-only policies",
              ],
              correctAnswer:
                "Accessible, lawful, and enforced fairly",
            },
            {
              id: "cmp-t2",
              question:
                "When fee schedules change, residents usually need:",
              type: "multiple_choice",
              options: [
                "No information if the change is small",
                "Clear notice aligned with agreements and applicable law",
                "A personal phone call only, with no records",
                "Only social media posts",
              ],
              correctAnswer:
                "Clear notice aligned with agreements and applicable law",
            },
          ],
        },
        assignment: {
          title: "Quiz — Compliance essentials",
          description: "Apply compliance thinking to typical operator decisions.",
          passingScore: 75,
          questions: [
            {
              id: "cmp-q1",
              question:
                "When marketing a home in a land lease community, accuracy in fees and inclusions is important primarily because:",
              type: "multiple_choice",
              options: [
                "It avoids misleading conduct and supports informed resident choices",
                "Marketing copy is never regulated",
                "Only verbal promises matter",
                "Disclosure is optional for secondary sales",
              ],
              correctAnswer:
                "It avoids misleading conduct and supports informed resident choices",
            },
            {
              id: "cmp-q2",
              question:
                "Good records of recurrent charges and fee changes help operators to:",
              type: "multiple_choice",
              options: [
                "Avoid all resident questions permanently",
                "Demonstrate transparency and respond fairly to disputes",
                "Replace written site agreements",
                "Eliminate the need for budgets",
              ],
              correctAnswer:
                "Demonstrate transparency and respond fairly to disputes",
            },
            {
              id: "cmp-q3",
              question:
                "If a regulator requests information about your community, the worst first response is:",
              type: "multiple_choice",
              options: [
                "Provide incomplete files without context",
                "Coordinate a timely, accurate response with legal support if needed",
                "Keep a contemporaneous compliance register",
                "Document what was requested and what was supplied",
              ],
              correctAnswer: "Provide incomplete files without context",
            },
          ],
        },
      },
      {
        title: "Site agreements & disclosure documents",
        description:
          "What belongs in disclosure packs, schedules of fees, and clear communication before residents commit.",
        order: 1,
        prerequisites: [
          {
            courseName: "Compliance & the Act",
            unitTitle: "Statutory framework & operator duties",
          },
        ],
        content: [
          {
            type: "link",
            title: "Disclosure themes (check your state rules)",
            url: "https://www.fairtrading.nsw.gov.au/housing-and-property/landlease-communities",
            order: 0,
          },
          {
            type: "slideshow",
            title: "Disclosure checklist for onboarding teams",
            url: slideDeck(),
            order: 1,
          },
          {
            type: "video",
            title: "Walking through a disclosure pack",
            url: DEMO_VIDEO,
            order: 2,
            duration: 150,
          },
        ],
        test: {
          title: "Knowledge check — Disclosure basics",
          description: "Fair dealing when sharing fees and documents.",
          passingScore: 70,
          questions: [
            {
              id: "cmp2-t1",
              question:
                "If a buyer asks about future fee increases, you should:",
              type: "multiple_choice",
              options: [
                "Point to governing documents and explain known variables honestly",
                "Promise fixed fees forever",
                "Refuse to discuss money",
                "Only answer in a private chat with no records",
              ],
              correctAnswer:
                "Point to governing documents and explain known variables honestly",
            },
            {
              id: "cmp2-t2",
              question:
                "Disclosure documents should typically be:",
              type: "multiple_choice",
              options: [
                "Current, legible, and available in reasonable timeframes",
                "Withheld until after settlement",
                "Replaced by marketing brochures only",
                "Updated only when a resident complains to a regulator",
              ],
              correctAnswer:
                "Current, legible, and available in reasonable timeframes",
            },
          ],
        },
        assignment: {
          title: "Scenario — Disclosure and fairness",
          description: "Choose responses that align with fair dealing principles.",
          passingScore: 80,
          questions: [
            {
              id: "cmp2-q1",
              question:
                "A prospective buyer asks whether recurrent charges will rise. The best practice is to:",
              type: "multiple_choice",
              options: [
                "Point to published schedules, explain variables, and avoid guarantees you cannot support",
                "Promise no increases ever",
                "Decline to discuss fees until after settlement",
                "Give only verbal estimates with no documents",
              ],
              correctAnswer:
                "Point to published schedules, explain variables, and avoid guarantees you cannot support",
            },
          ],
        },
      },
    ],
  },
  {
    name: "Site Safety & WHS",
    certificationCategory: "Operations & safety",
    summary:
      "Practical WHS for shared roads, amenities, worksites, and emergencies on occupied communities.",
    tagline: "Hazards, contractors, and resident wellbeing",
    description:
      "Practical WHS habits for shared roads, amenities, worksites, and emergencies — tailored for managers coordinating teams and vendors on occupied land lease communities.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=80&auto=format&fit=crop",
    order: 20,
    units: [
      {
        title: "Risk identification and common hazards",
        description:
          "From trip hazards to pool fencing and vehicle movements — scanning the site methodically.",
        order: 0,
        prerequisites: [
          {
            courseName: "Compliance & the Act",
            unitTitle: "Statutory framework & operator duties",
          },
        ],
        content: [
          {
            type: "video",
            title: "Hazard scanning on a busy site",
            url: DEMO_VIDEO,
            order: 0,
            duration: 220,
          },
          {
            type: "slideshow",
            title: "Photo examples — before & after controls",
            url: slideDeck(),
            order: 1,
          },
          {
            type: "link",
            title: "WHS consultation overview (Safe Work Australia)",
            url: "https://www.safeworkaustralia.gov.au/safety-topic/hazards",
            order: 2,
          },
        ],
        test: {
          title: "Knowledge check — Hazard scanning",
          description: "Recognise proportionate responses to common site hazards.",
          passingScore: 70,
          questions: [
            {
              id: "whs-t1",
              question:
                "A leaking pipe near a footpath should be treated as:",
              type: "multiple_choice",
              options: [
                "Low priority until someone falls",
                "A potential slip/trip risk to isolate and repair with documentation",
                "Only the resident’s problem",
                "Something to fix only in business hours next month",
              ],
              correctAnswer:
                "A potential slip/trip risk to isolate and repair with documentation",
            },
            {
              id: "whs-t2",
              question:
                "Temporary controls (signage, barriers) are used to:",
              type: "multiple_choice",
              options: [
                "Reduce risk while permanent fixes are arranged",
                "Replace all permanent repairs",
                "Confuse contractors",
                "Avoid notifying anyone",
              ],
              correctAnswer:
                "Reduce risk while permanent fixes are arranged",
            },
          ],
        },
        assignment: {
          title: "Quiz — Hazard controls",
          description: "Pick proportionate controls for reported hazards.",
          passingScore: 75,
          questions: [
            {
              id: "whs-q1",
              question:
                "A contractor plans hot work near a carport. The minimum control mindset should include:",
              type: "multiple_choice",
              options: [
                "Permits/fire watch as required, clear flammables, extinguishers, and communication",
                "Proceeding quickly because residents are away",
                "Relying on luck and hose availability",
                "No controls if the job is under 10 minutes",
              ],
              correctAnswer:
                "Permits/fire watch as required, clear flammables, extinguishers, and communication",
            },
            {
              id: "whs-q2",
              question:
                "Residents should receive timely notice of disruptive works primarily to:",
              type: "multiple_choice",
              options: [
                "Reduce surprises, manage access, and support cooperation",
                "Eliminate all noise complaints by law",
                "Replace permit requirements",
                "Avoid contractor inductions",
              ],
              correctAnswer:
                "Reduce surprises, manage access, and support cooperation",
            },
          ],
        },
      },
      {
        title: "Contractors, SWMS, and verification",
        description:
          "Checking insurances, safe work methods, and site rules — without becoming the contractor’s safety officer.",
        order: 1,
        prerequisites: [
          {
            courseName: "Site Safety & WHS",
            unitTitle: "Risk identification and common hazards",
          },
        ],
        content: [
          {
            type: "link",
            title: "Managing contractor risks (Safe Work Australia)",
            url: "https://www.safeworkaustralia.gov.au/safety-topic/managing-risk/managing-risks-plant",
            order: 0,
          },
          {
            type: "video",
            title: "Gates, speed limits, and heavy vehicles",
            url: DEMO_VIDEO,
            order: 1,
            duration: 160,
          },
          {
            type: "pdf",
            title: "Contractor induction checklist (sample PDF)",
            url: SAMPLE_PDF,
            order: 2,
          },
        ],
        test: {
          title: "Knowledge check — Contractor verification",
          description: "Due diligence without taking on the contractor’s WHS duties.",
          passingScore: 70,
          questions: [
            {
              id: "whs2-t1",
              question:
                "Operators should request evidence of suitable insurance because:",
              type: "multiple_choice",
              options: [
                "It supports risk transfer and due diligence expectations",
                "It removes all operator liability automatically",
                "It is never necessary for small jobs",
                "Only lawyers may hold insurance certificates",
              ],
              correctAnswer:
                "It supports risk transfer and due diligence expectations",
            },
            {
              id: "whs2-t2",
              question:
                "A SWMS or safe work method is primarily the responsibility of:",
              type: "multiple_choice",
              options: [
                "The party conducting the high-risk work, with coordination from the site",
                "Residents only",
                "The operator alone for every screw turned",
                "No one if the job is under budget",
              ],
              correctAnswer:
                "The party conducting the high-risk work, with coordination from the site",
            },
          ],
        },
        assignment: {
          title: "Checkpoint — Contractor oversight",
          description: "Boundary between operator coordination and contractor responsibility.",
          passingScore: 80,
          questions: [
            {
              id: "whs2-q1",
              question:
                "Operators should verify contractors have appropriate insurance and inductions because:",
              type: "multiple_choice",
              options: [
                "It supports due diligence and reduces unmanaged risk to residents and the business",
                "It transfers all WHS liability to residents",
                "Insurance is optional for any sub-contractor",
                "Inductions are only for internal staff",
              ],
              correctAnswer:
                "It supports due diligence and reduces unmanaged risk to residents and the business",
            },
          ],
        },
      },
    ],
  },
  {
    name: "Resident Experience & Fair Dealing",
    certificationCategory: "Residents & experience",
    summary:
      "Communication, complaints, and fair dealing — the human side of compliant operations.",
    tagline: "Communication, complaints, and trust",
    description:
      "Professional tone, inclusive practice, de-escalation, and transparent complaint pathways — the human side of compliant operations.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80&auto=format&fit=crop",
    order: 30,
    units: [
      {
        title: "Resident communications that work",
        description:
          "Newsletters, notice boards, digital channels, and difficult conversations with clarity and respect.",
        order: 0,
        prerequisites: [
          {
            courseName: "Land Lease 101",
            unitTitle: "Day-to-day operations on site",
          },
        ],
        content: [
          {
            type: "slideshow",
            title: "Templates for notices and updates",
            url: slideDeck(),
            order: 0,
          },
          {
            type: "video",
            title: "Delivering unwelcome fee news",
            url: DEMO_VIDEO,
            order: 1,
            duration: 190,
          },
          {
            type: "link",
            title: "Inclusive communication tips (Australian Human Rights Commission)",
            url: "https://humanrights.gov.au/",
            order: 2,
          },
        ],
        test: {
          title: "Knowledge check — Clear communications",
          description: "Tone and channels that support trust.",
          passingScore: 70,
          questions: [
            {
              id: "rx-t1",
              question:
                "When announcing an unpopular change, leading with:",
              type: "multiple_choice",
              options: [
                "Facts, reasons, timelines, and review pathways is usually best practice",
                "Threats and ultimatums only",
                "Jargon with no summary",
                "Silence until complaints peak",
              ],
              correctAnswer:
                "Facts, reasons, timelines, and review pathways is usually best practice",
            },
            {
              id: "rx-t2",
              question:
                "Accessibility for notices can include:",
              type: "multiple_choice",
              options: [
                "Multiple channels and plain language where practical",
                "Email-only with tiny fonts",
                "Verbal-only with no records",
                "Posting once on a locked door",
              ],
              correctAnswer:
                "Multiple channels and plain language where practical",
            },
          ],
        },
        assignment: {
          title: "Quiz — Communication standards",
          description: "Choose language and channels that build trust.",
          passingScore: 75,
          questions: [
            {
              id: "rx-q1",
              question:
                "When residents are angry about a fee change, your first aim in writing should be:",
              type: "multiple_choice",
              options: [
                "Clear facts, timelines, rights of review, and respectful tone",
                "Legal threats only",
                "Ignoring emotion entirely with jargon",
                "Deleting emails to reset the conversation",
              ],
              correctAnswer:
                "Clear facts, timelines, rights of review, and respectful tone",
            },
          ],
        },
      },
      {
        title: "Complaints, disputes, and documentation",
        description:
          "Fair internal processes, timelines, notes, and when to escalate externally.",
        order: 1,
        prerequisites: [
          {
            courseName: "Resident Experience & Fair Dealing",
            unitTitle: "Resident communications that work",
          },
        ],
        content: [
          {
            type: "link",
            title: "Internal dispute handling themes",
            url: "https://www.fairtrading.nsw.gov.au/",
            order: 0,
          },
          {
            type: "slideshow",
            title: "Complaint log fields & quality of notes",
            url: slideDeck(),
            order: 1,
          },
          {
            type: "pdf",
            title: "Complaint acknowledgement template (sample PDF)",
            url: SAMPLE_PDF,
            order: 2,
          },
        ],
        test: {
          title: "Knowledge check — Complaint handling",
          description: "Process, notes, and fairness.",
          passingScore: 70,
          questions: [
            {
              id: "rx2-t1",
              question:
                "Contemporaneous notes of complaints help because they:",
              type: "multiple_choice",
              options: [
                "Support fair review, continuity of staff, and factual timelines",
                "Guarantee the operator always wins disputes",
                "Replace the need to speak with residents",
                "Should never be shared internally",
              ],
              correctAnswer:
                "Support fair review, continuity of staff, and factual timelines",
            },
            {
              id: "rx2-t2",
              question:
                "Escalation to external bodies may be appropriate when:",
              type: "multiple_choice",
              options: [
                "Internal processes are exhausted or serious issues require it",
                "A resident sends a first email",
                "Never — operators should block all external contact",
                "Only after three years regardless of severity",
              ],
              correctAnswer:
                "Internal processes are exhausted or serious issues require it",
            },
          ],
        },
        assignment: {
          title: "Scenario — Handling repeated complaints",
          description: "Balance empathy, process, and consistency.",
          passingScore: 80,
          questions: [
            {
              id: "rx2-q1",
              question:
                "The same resident raises multiple related issues. The best approach is usually to:",
              type: "multiple_choice",
              options: [
                "Tie issues into one tracked thread, document outcomes, and apply policy consistently",
                "Block them from all communication",
                "Answer differently each time to speed closure",
                "Ignore older issues once a new one appears",
              ],
              correctAnswer:
                "Tie issues into one tracked thread, document outcomes, and apply policy consistently",
            },
          ],
        },
      },
    ],
  },
  {
    name: "Commercials, Fees & Asset Care",
    certificationCategory: "Commercial & assets",
    summary:
      "Recurrent charges, reserves, and explaining value — keeping the community financially sustainable.",
    tagline: "Budgets, transparency, and sustainable upkeep",
    description:
      "Recurrent charges, reserves, capital planning, and explaining value to residents — keeping the asset and community financially sustainable.",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80&auto=format&fit=crop",
    order: 40,
    units: [
      {
        title: "Fee structures residents can understand",
        description:
          "Plain-language breakdowns, what pays for what, and how indexation works in practice.",
        order: 0,
        prerequisites: [
          {
            courseName: "Land Lease 101",
            unitTitle: "Understanding the land lease model",
          },
        ],
        content: [
          {
            type: "video",
            title: "Visible value from recurrent charges",
            url: DEMO_VIDEO,
            order: 0,
            duration: 210,
          },
          {
            type: "slideshow",
            title: "Sample fee breakdown visuals",
            url: slideDeck(),
            order: 1,
          },
          {
            type: "link",
            title: "ASIC — avoiding misleading statements (general reading)",
            url: "https://www.asic.gov.au/",
            order: 2,
          },
        ],
        test: {
          title: "Knowledge check — Fee transparency",
          description: "Avoid misleading summaries when discussing money.",
          passingScore: 70,
          questions: [
            {
              id: "fin-t1",
              question:
                "When projecting future charges, you should:",
              type: "multiple_choice",
              options: [
                "State assumptions and avoid implying certainty you cannot support",
                "Lock in dollar amounts for decades verbally",
                "Hide indexation clauses",
                "Only discuss fees if residents waive rights",
              ],
              correctAnswer:
                "State assumptions and avoid implying certainty you cannot support",
            },
            {
              id: "fin-t2",
              question:
                "A reserve or sinking fund is typically for:",
              type: "multiple_choice",
              options: [
                "Planned major repairs and renewals over time",
                "Personal bonuses for managers",
                "Unrelated investments only",
                "Optional gifts to residents",
              ],
              correctAnswer:
                "Planned major repairs and renewals over time",
            },
          ],
        },
        assignment: {
          title: "Quiz — Fee communications",
          description: "Avoid misleading summaries when explaining charges.",
          passingScore: 75,
          questions: [
            {
              id: "fin-q1",
              question:
                "When summarising future fee movements, operators should:",
              type: "multiple_choice",
              options: [
                "Use assumptions stated clearly, avoid implying certainty where variables exist",
                "Guarantee specific dollar amounts forever",
                "Hide CPI mechanics",
                "Only discuss fees verbally",
              ],
              correctAnswer:
                "Use assumptions stated clearly, avoid implying certainty where variables exist",
            },
          ],
        },
      },
      {
        title: "Maintenance planning and pride of place",
        description:
          "Scheduling amenities, roads, and open space so the community feels cared for year-round.",
        order: 1,
        prerequisites: [
          {
            courseName: "Commercials, Fees & Asset Care",
            unitTitle: "Fee structures residents can understand",
          },
        ],
        content: [
          {
            type: "link",
            title: "General asset management reading",
            url: "https://www.ipwea.org/",
            order: 0,
          },
          {
            type: "slideshow",
            title: "12-month works calendar template",
            url: slideDeck(),
            order: 1,
          },
          {
            type: "video",
            title: "Balancing amenity upgrades with risk reduction",
            url: DEMO_VIDEO,
            order: 2,
            duration: 175,
          },
        ],
        test: {
          title: "Knowledge check — Maintenance priorities",
          description: "Risk, amenity, and budget trade-offs.",
          passingScore: 70,
          questions: [
            {
              id: "fin2-t1",
              question:
                "If playground surfacing fails impact tests, you should usually:",
              type: "multiple_choice",
              options: [
                "Close or restrict the area until made safe, then remediate",
                "Wait for peak season to end regardless of injury risk",
                "Rely on resident supervision only",
                "Document nothing until someone is hurt",
              ],
              correctAnswer:
                "Close or restrict the area until made safe, then remediate",
            },
            {
              id: "fin2-t2",
              question:
                "A 12-month works calendar helps by:",
              type: "multiple_choice",
              options: [
                "Coordinating contractors, budgets, and resident communications",
                "Eliminating all reactive maintenance",
                "Replacing statutory inspections",
                "Hiding capex from owners",
              ],
              correctAnswer:
                "Coordinating contractors, budgets, and resident communications",
            },
          ],
        },
        assignment: {
          title: "Checkpoint — Prioritising Capex",
          description: "Choose a rational sequence when funds are limited.",
          passingScore: 80,
          questions: [
            {
              id: "fin2-q1",
              question:
                "If playground equipment fails a safety inspection and another project is purely cosmetic, you should usually:",
              type: "multiple_choice",
              options: [
                "Address safety risk first, document, then schedule cosmetic work",
                "Do cosmetic first for photos",
                "Wait until the next financial year regardless",
                "Remove inspections from the calendar",
              ],
              correctAnswer:
                "Address safety risk first, document, then schedule cosmetic work",
            },
          ],
        },
      },
    ],
  },
];
