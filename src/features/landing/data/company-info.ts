const insurances = [
  {
    label: "General Liability Insurance",
    coverage: "$1M Coverage",
  },
  {
    label: "Workers' Compensation Insurance",
    coverage: "Full Coverage",
  },
  {
    label: "Professional Liability Insurance",
    coverage: "$1M Coverage",
  },
  {
    label: "Bonded",
    coverage: "Up to $5M",
  },
  {
    label: "Commercial General Liability Insurance",
    coverage: "$10M Coverage",
  },
];

const licenses = [
  {
    type: "B",
    description: "General Building License",
    licenseNumber: "CA Lic. #1004847",
  },
];

const certifications = [
  {
    label: "NARI Certified Professional",
  },
  {
    label: "LEED Accredited Professional",
  },
  {
    label: "OSHA 30-Hour Construction Safety Certification",
  },
  {
    label: "EPA Lead-Safe Certified",
  },
];

const awards = [
  { label: "2023 Best Luxury Home Builder - Local Business Awards" },
  { label: "2022 Excellence in Construction - AGC Chapter" },
  { label: "2021 Customer Choice Award - Home Improvement" },
];

const teamInfo = {
  owners: [
    {
      name: "Oliver Porat",
      title: "Co-founder",
      image: "/oliver-headshot.jpg",
      bio: "Oliver is a licensed contractor with over 20 years of experience in the construction industry. He is a member of the National Association of the Remodeling Industry (NARI) and the Building Performance Institute (BPI).",
    },
    {
      name: "Sean Phil",
      title: "Co-founder",
      image: "/oliver-headshot.jpg",
      bio: "Sean Phil is a licensed contractor with over 20 years of experience in the construction industry. He is a member of the National Association of the Remodeling Industry (NARI) and the Building Performance Institute (BPI).",
    },
  ],
  numEmployees: 25,
};

const contactInfo = [
  {
    label: "Main Office",
    value: "123 Construction Ave, \nTarzana, CA 91335",
    icon: "📍",
  },
  {
    label: "Phone",
    value: "(818) 651-1445",
    icon: "📞",
  },
  {
    label: "Email",
    value: "info@triprosremodeling.com",
    icon: "📧",
  },
];

export const companyInfo = {
  name: "Tri Pros Remodeling",
  logo: "/logo.png",
  yearFounded: 1998,
  numProjects: 520,
  generations: 3,
  clientSatisfaction: 0.98,
  projectsDelivered: 50_000_000,
  contactInfo,
  insurances,
  licenses,
  certifications,
  awards,
  teamInfo,
};
