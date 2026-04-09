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
  assignment: SeedAssignment;
  prerequisites?: SeedPrerequisiteRef[];
};

/** Stable key for wiring prerequisites in seed / sync mutations. */
export function seedUnitKey(courseName: string, unitTitle: string) {
  return `${courseName}::${unitTitle}`;
}

export type SeedCourse = {
  name: string;
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
            title: "Welcome — your role as a community manager",
            url: DEMO_VIDEO,
            order: 0,
            duration: 180,
          },
          {
            type: "slideshow",
            title: "Deck: site layout & stakeholder map",
            url: slideDeck(),
            order: 1,
          },
          {
            type: "link",
            title: "Reading — CCIA land lease resources",
            url: "https://www.ccia.com.au/",
            order: 2,
          },
        ],
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
            title: "Walkthrough — daily rounds and escalation paths",
            url: DEMO_VIDEO,
            order: 0,
            duration: 240,
          },
          {
            type: "link",
            title: "NSW Fair Trading — land lease communities hub",
            url: "https://www.fairtrading.nsw.gov.au/housing-and-property/landlease-communities",
            order: 1,
          },
        ],
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
            title: "Deck: compliance pillars for operators",
            url: slideDeck(),
            order: 0,
          },
          {
            type: "link",
            title: "Reference — Residential (Land Lease) Communities Act (NSW)",
            url: "https://legislation.nsw.gov.au/view/html/inforce/current/act-2013-0042",
            order: 1,
          },
          {
            type: "video",
            title: "Briefing — proportionate compliance culture",
            url: DEMO_VIDEO,
            order: 2,
            duration: 200,
          },
        ],
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
            title: "Guidance — disclosure themes (check your state rules)",
            url: "https://www.fairtrading.nsw.gov.au/housing-and-property/landlease-communities",
            order: 0,
          },
          {
            type: "slideshow",
            title: "Deck: disclosure checklist for onboarding teams",
            url: slideDeck(),
            order: 1,
          },
        ],
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
            title: "Toolbox style — hazard scanning on a busy site",
            url: DEMO_VIDEO,
            order: 0,
            duration: 220,
          },
          {
            type: "slideshow",
            title: "Deck: photo examples — before & after controls",
            url: slideDeck(),
            order: 1,
          },
        ],
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
            title: "Safe Work Australia — managing contractor risks",
            url: "https://www.safeworkaustralia.gov.au/safety-topic/managing-risk/managing-risks-plant",
            order: 0,
          },
          {
            type: "video",
            title: "Short talk — gates, speed limits, and heavy vehicles",
            url: DEMO_VIDEO,
            order: 1,
            duration: 160,
          },
        ],
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
            title: "Deck: templates for notices and updates",
            url: slideDeck(),
            order: 0,
          },
          {
            type: "video",
            title: "Scenario replay — delivering unwelcome fee news",
            url: DEMO_VIDEO,
            order: 1,
            duration: 190,
          },
        ],
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
            title: "Reference — internal dispute handling themes",
            url: "https://www.fairtrading.nsw.gov.au/",
            order: 0,
          },
          {
            type: "slideshow",
            title: "Deck: complaint log fields & quality of notes",
            url: slideDeck(),
            order: 1,
          },
        ],
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
            title: "Explainer — visible value from recurrent charges",
            url: DEMO_VIDEO,
            order: 0,
            duration: 210,
          },
          {
            type: "slideshow",
            title: "Deck: sample fee breakdown visuals",
            url: slideDeck(),
            order: 1,
          },
        ],
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
            title: "Asset management reading (general)",
            url: "https://www.ipwea.org/",
            order: 0,
          },
          {
            type: "slideshow",
            title: "Deck: 12-month works calendar template",
            url: slideDeck(),
            order: 1,
          },
        ],
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
